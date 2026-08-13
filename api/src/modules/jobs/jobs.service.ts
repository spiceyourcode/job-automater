import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { jobs, jobScores, savedJobs } from "../../db/schema/index.js";
import { enqueueMatchScore } from "../../lib/queue.js";
import { assertPublicHttpUrl } from "../../lib/safe-url.js";
import type { ImportJobBody, ListJobsQuery } from "./jobs.schema.js";

export class JobError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "JobError";
  }
}

function toPublicJob(
  job: typeof jobs.$inferSelect,
  score: typeof jobScores.$inferSelect | null,
  isSaved = false,
) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    isRemote: job.isRemote,
    remoteType: job.remoteType,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod,
    description: job.description,
    requirements: job.requirements,
    applicationUrl: job.applicationUrl,
    source: job.source,
    sourceUrl: job.sourceUrl,
    tags: job.tags,
    status: job.status,
    isDuplicate: job.isDuplicate,
    collectedAt: job.collectedAt,
    postedAt: job.postedAt,
    isSaved,
    score: score
      ? {
          overall: Number(score.overallScore),
          skillMatch: score.skillMatch != null ? Number(score.skillMatch) : null,
          experienceMatch:
            score.experienceMatch != null
              ? Number(score.experienceMatch)
              : null,
          locationMatch:
            score.locationMatch != null ? Number(score.locationMatch) : null,
          salaryMatch:
            score.salaryMatch != null ? Number(score.salaryMatch) : null,
          cultureMatch:
            score.cultureMatch != null ? Number(score.cultureMatch) : null,
          reasoning: score.reasoning,
          matchedSkills: score.matchedSkills,
          missingSkills: score.missingSkills,
          weights: score.weights,
          scoredAt: score.scoredAt,
        }
      : null,
  };
}

/**
 * List jobs for the authenticated user only (IDOR-safe).
 * Owns jobs + job_scores (HG-6 job domain).
 */
export async function listJobs(userId: string, query: ListJobsQuery) {
  const conditions = [eq(jobs.userId, userId)];

  if (!query.includeDuplicates) {
    conditions.push(eq(jobs.isDuplicate, false));
  }
  if (query.remoteOnly) {
    conditions.push(eq(jobs.isRemote, true));
  }
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(
      or(ilike(jobs.title, term), ilike(jobs.company, term))!,
    );
  }

  const rows = await db
    .select({
      job: jobs,
      score: jobScores,
      savedId: savedJobs.id,
    })
    .from(jobs)
    .leftJoin(
      jobScores,
      and(eq(jobScores.jobId, jobs.id), eq(jobScores.userId, userId)),
    )
    .leftJoin(
      savedJobs,
      and(eq(savedJobs.jobId, jobs.id), eq(savedJobs.userId, userId)),
    )
    .where(and(...conditions))
    .orderBy(
      query.sort === "date"
        ? desc(jobs.collectedAt)
        : sql`COALESCE(${jobScores.overallScore}, 0) DESC`,
    )
    .limit(query.limit);

  let items = rows.map((r) =>
    toPublicJob(r.job, r.score, Boolean(r.savedId)),
  );
  if (query.minScore != null) {
    items = items.filter(
      (j) => j.score != null && j.score.overall >= query.minScore!,
    );
  }

  return { jobs: items, total: items.length };
}

export async function getJob(userId: string, id: string) {
  const [row] = await db
    .select({
      job: jobs,
      score: jobScores,
    })
    .from(jobs)
    .leftJoin(
      jobScores,
      and(eq(jobScores.jobId, jobs.id), eq(jobScores.userId, userId)),
    )
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .limit(1);

  if (!row) throw new JobError("Job not found", 404);
  const [saved] = await db
    .select({ id: savedJobs.id })
    .from(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, id)))
    .limit(1);
  return { job: toPublicJob(row.job, row.score, Boolean(saved)) };
}

function titleFromUrl(url: URL): { title: string; company: string } {
  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+/g, " ").trim();
  const title =
    path.length > 1
      ? path.slice(0, 200).replace(/[-_]/g, " ").trim()
      : `Job at ${host}`;
  return { title: title || `Job at ${host}`, company: host };
}

/**
 * Manual URL import — user-scoped only (IDOR: never visible to others).
 * Fetches public URL metadata when possible; always inserts owned job row.
 */
export async function importJob(userId: string, body: ImportJobBody) {
  const parsedUrl = await assertPublicHttpUrl(body.url);
  const href = parsedUrl.toString();
  const sourceId = createHash("sha256").update(href).digest("hex").slice(0, 64);
  const source = body.sourceType?.trim() || "manual";

  const [existing] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.source, source),
        eq(jobs.sourceId, sourceId),
      ),
    )
    .limit(1);
  if (existing) {
    return {
      job: toPublicJob(existing, null, false),
      taskId: null as string | null,
      deduped: true,
    };
  }

  let title: string;
  let company: string;
  let description: string | null = null;
  try {
    const res = await fetch(href, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "JobAutomater/1.0 job-import" },
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = m?.[1]?.replace(/\s+/g, " ").trim().slice(0, 500);
      const derived = titleFromUrl(parsedUrl);
      title = pageTitle || derived.title;
      company = derived.company;
      description = pageTitle ? `Imported from ${href}` : null;
    } else {
      const derived = titleFromUrl(parsedUrl);
      title = derived.title;
      company = derived.company;
    }
  } catch {
    const derived = titleFromUrl(parsedUrl);
    title = derived.title;
    company = derived.company;
  }

  const [created] = await db
    .insert(jobs)
    .values({
      userId,
      source,
      sourceId,
      sourceUrl: href,
      applicationUrl: href,
      company,
      title,
      description,
      status: "new",
    })
    .returning();

  if (!created) throw new JobError("Failed to import job", 400);

  const taskId = randomUUID();
  try {
    await enqueueMatchScore({
      job_ids: [created.id],
      user_id: userId,
    });
  } catch {
    // Job row exists; scoring can be retried via POST /jobs/:id/score later
  }

  return {
    job: toPublicJob(created, null, false),
    taskId,
    deduped: false,
  };
}

/** Similar jobs for the same user only — never cross-user (IDOR). */
export async function listSimilarJobs(
  userId: string,
  jobId: string,
  limit: number,
) {
  const [seed] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  if (!seed) throw new JobError("Job not found", 404);

  const titleTerm = `%${seed.title.split(/\s+/).slice(0, 3).join("%")}%`;
  const rows = await db
    .select({
      job: jobs,
      score: jobScores,
    })
    .from(jobs)
    .leftJoin(
      jobScores,
      and(eq(jobScores.jobId, jobs.id), eq(jobScores.userId, userId)),
    )
    .where(
      and(
        eq(jobs.userId, userId),
        ne(jobs.id, jobId),
        eq(jobs.isDuplicate, false),
        or(eq(jobs.company, seed.company), ilike(jobs.title, titleTerm)),
      ),
    )
    .orderBy(sql`COALESCE(${jobScores.overallScore}, 0) DESC`)
    .limit(limit);

  return {
    jobs: rows.map((r) => toPublicJob(r.job, r.score)),
  };
}

export async function saveJob(userId: string, jobId: string) {
  const [owned] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  if (!owned) throw new JobError("Job not found", 404);

  await db
    .insert(savedJobs)
    .values({ userId, jobId })
    .onConflictDoNothing();

  return { success: true as const };
}

export async function unsaveJob(userId: string, jobId: string) {
  const result = await db
    .delete(savedJobs)
    .where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId)))
    .returning({ id: savedJobs.id });
  if (result.length === 0) {
    // Confirm ownership of job for consistent 404 (no IDOR leak)
    const [owned] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
      .limit(1);
    if (!owned) throw new JobError("Job not found", 404);
  }
  return { success: true as const };
}
