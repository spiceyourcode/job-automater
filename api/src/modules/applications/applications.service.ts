import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  applications,
  jobs,
  profiles,
  type Application,
} from "../../db/schema/index.js";
import { enqueueGenerateDocs } from "../../lib/queue.js";
import { getPresignedGetUrl, uploadObject } from "../../lib/s3.js";
import type { CreateApplicationBody } from "./applications.schema.js";

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

function toPublic(app: Application) {
  return {
    id: app.id,
    jobId: app.jobId,
    status: app.status,
    cvVersion: app.cvVersion,
    tailoredCvContent: app.tailoredCvContent,
    coverLetterContent: app.coverLetterContent,
    tailoredCvUrl: app.tailoredCvUrl,
    coverLetterUrl: app.coverLetterUrl,
    bulletTraces: app.bulletTraces,
    documentsReviewedAt: app.documentsReviewedAt,
    generationModel: app.generationModel,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    /** Apply is blocked until review (P3.2 / HG-4 precursor). */
    canApply: app.documentsReviewedAt != null && app.status === "draft",
  };
}

async function getOwned(
  userId: string,
  id: string,
): Promise<Application> {
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  if (!row) throw new ApplicationError("Application not found", 404);
  return row;
}

export async function listApplications(userId: string) {
  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt));
  return { applications: rows.map(toPublic) };
}

export async function getApplication(userId: string, id: string) {
  const app = await getOwned(userId, id);
  const [job] = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
    })
    .from(jobs)
    .where(and(eq(jobs.id, app.jobId), eq(jobs.userId, userId)))
    .limit(1);
  return { application: toPublic(app), job: job ?? null };
}

/**
 * Create draft application for a job and enqueue GenerateDocs.
 * Status remains `draft` (P3.3).
 */
export async function createApplication(
  userId: string,
  body: CreateApplicationBody,
) {
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, body.jobId), eq(jobs.userId, userId)))
    .limit(1);
  if (!job) throw new ApplicationError("Job not found", 404);

  const [profile] = await db
    .select({ cvVersion: profiles.cvVersion })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const [existing] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        eq(applications.jobId, body.jobId),
      ),
    )
    .limit(1);

  let app: Application;
  if (existing) {
    const [updated] = await db
      .update(applications)
      .set({
        status: "draft",
        documentsReviewedAt: null,
        tailoredCvContent: null,
        coverLetterContent: null,
        bulletTraces: [],
        updatedAt: new Date(),
      })
      .where(eq(applications.id, existing.id))
      .returning();
    if (!updated) throw new ApplicationError("Failed to reset application", 400);
    app = updated;
  } else {
    const [created] = await db
      .insert(applications)
      .values({
        userId,
        jobId: body.jobId,
        cvVersion: profile?.cvVersion ?? 1,
        status: "draft",
      })
      .returning();
    if (!created) throw new ApplicationError("Failed to create application", 400);
    app = created;
  }

  try {
    await enqueueGenerateDocs({
      application_id: app.id,
      user_id: userId,
      job_id: body.jobId,
    });
  } catch {
    throw new ApplicationError("Failed to enqueue document generation", 503);
  }

  return { application: toPublic(app), status: "generating" as const };
}

export async function regenerateDocuments(userId: string, id: string) {
  const app = await getOwned(userId, id);
  await db
    .update(applications)
    .set({
      documentsReviewedAt: null,
      tailoredCvContent: null,
      coverLetterContent: null,
      bulletTraces: [],
      status: "draft",
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  try {
    await enqueueGenerateDocs({
      application_id: app.id,
      user_id: userId,
      job_id: app.jobId,
    });
  } catch {
    throw new ApplicationError("Failed to enqueue document generation", 503);
  }
  return { status: "generating" as const };
}

/** Mark documents reviewed — unlocks Apply (still no submit without P4 approve). */
export async function markDocumentsReviewed(userId: string, id: string) {
  const app = await getOwned(userId, id);
  if (!app.tailoredCvContent || !app.coverLetterContent) {
    throw new ApplicationError("Documents not ready for review", 400);
  }

  // Persist text artifacts to MinIO for download URLs
  const cvKey = `applications/${userId}/${id}/tailored-cv.md`;
  const clKey = `applications/${userId}/${id}/cover-letter.md`;
  await uploadObject({
    key: cvKey,
    body: Buffer.from(app.tailoredCvContent, "utf8"),
    contentType: "text/markdown; charset=utf-8",
  });
  await uploadObject({
    key: clKey,
    body: Buffer.from(app.coverLetterContent, "utf8"),
    contentType: "text/markdown; charset=utf-8",
  });

  const [updated] = await db
    .update(applications)
    .set({
      documentsReviewedAt: new Date(),
      tailoredCvUrl: cvKey,
      coverLetterUrl: clKey,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new ApplicationError("Application not found", 404);
  return { application: toPublic(updated) };
}

export async function getDocumentDownloadUrl(
  userId: string,
  id: string,
  kind: "cv" | "cl",
) {
  const app = await getOwned(userId, id);
  const key = kind === "cv" ? app.tailoredCvUrl : app.coverLetterUrl;
  if (!key) throw new ApplicationError("Document not available", 404);
  const url = await getPresignedGetUrl(key, 600);
  return { url };
}
