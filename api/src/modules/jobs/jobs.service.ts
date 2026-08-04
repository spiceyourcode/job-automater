import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { jobs, jobScores } from "../../db/schema/index.js";
import type { ListJobsQuery } from "./jobs.schema.js";

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
    })
    .from(jobs)
    .leftJoin(
      jobScores,
      and(eq(jobScores.jobId, jobs.id), eq(jobScores.userId, userId)),
    )
    .where(and(...conditions))
    .orderBy(
      query.sort === "date"
        ? desc(jobs.collectedAt)
        : sql`COALESCE(${jobScores.overallScore}, 0) DESC`,
    )
    .limit(query.limit);

  let items = rows.map((r) => toPublicJob(r.job, r.score));
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
  return { job: toPublicJob(row.job, row.score) };
}
