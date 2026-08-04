import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  applications,
  jobs,
  profiles,
  type Application,
} from "../../db/schema/index.js";
import {
  enqueueGenerateDocs,
  enqueueSubmitApplication,
} from "../../lib/queue.js";
import { getPresignedGetUrl, uploadObject } from "../../lib/s3.js";
import type {
  CreateApplicationBody,
  PipelineStage,
  UpdateStageBody,
} from "./applications.schema.js";
import {
  STAGE_TO_STATUS,
  statusToStage,
} from "./applications.schema.js";

/** Contract state machine: draft → pending_approval → approved → submitted */
const APPROVABLE_STATUSES = new Set(["draft"]);

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
  const reviewed = app.documentsReviewedAt != null;
  const canApprove =
    reviewed &&
    APPROVABLE_STATUSES.has(app.status) &&
    Boolean(app.tailoredCvContent && app.coverLetterContent);
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
    approvedAt: app.approvedAt,
    submittedAt: app.submittedAt,
    submittedVia: app.submittedVia,
    submitError: app.submitError,
    pipelineStage: statusToStage(app.status),
    generationModel: app.generationModel,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    /** Approve/Apply blocked until review (P3.2); submit only after approve (HG-4). */
    canApply: canApprove,
    canApprove,
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
    .select({
      app: applications,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt));

  return {
    applications: rows.map(({ app, jobTitle, jobCompany }) => ({
      ...toPublic(app),
      jobTitle: jobTitle ?? "Unknown role",
      jobCompany: jobCompany ?? "Unknown company",
    })),
  };
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
        approvedAt: null,
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
      approvedAt: null,
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

/**
 * P4.1 / HG-4: draft → pending_approval → approved, then enqueue submit.
 * Submit is never enqueued without approved_at.
 */
export async function approveApplication(userId: string, id: string) {
  const app = await getOwned(userId, id);

  if (!app.documentsReviewedAt) {
    throw new ApplicationError("Documents must be reviewed before approval", 400);
  }
  if (!app.tailoredCvContent || !app.coverLetterContent) {
    throw new ApplicationError("Documents not ready for approval", 400);
  }
  if (!APPROVABLE_STATUSES.has(app.status)) {
    throw new ApplicationError(
      `Cannot approve application in status '${app.status}'`,
      409,
    );
  }

  // Intermediate pending_approval (contract state machine)
  await db
    .update(applications)
    .set({ status: "pending_approval", updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  const approvedAt = new Date();
  const [updated] = await db
    .update(applications)
    .set({
      status: "approved",
      approvedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated?.approvedAt) {
    throw new ApplicationError("Failed to approve application", 400);
  }

  try {
    await enqueueSubmitApplication({
      application_id: updated.id,
      user_id: userId,
      approved_at: updated.approvedAt.toISOString(),
    });
  } catch {
    // Roll back to pending_approval so user can retry — never leave approved
    // without a queue payload that carries approved_at.
    await db
      .update(applications)
      .set({
        status: "pending_approval",
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, id), eq(applications.userId, userId)));
    throw new ApplicationError("Failed to enqueue submission", 503);
  }

  return { application: toPublic(updated), status: "approved" as const };
}

/**
 * P4.4 — move application across Kanban stages (AppFlow §2.4).
 * Drafts cannot enter the pipeline until they leave draft.
 */
export async function updateApplicationStage(
  userId: string,
  id: string,
  body: UpdateStageBody,
) {
  const app = await getOwned(userId, id);
  if (statusToStage(app.status) === null && app.status === "draft") {
    throw new ApplicationError(
      "Draft applications are not on the pipeline yet",
      400,
    );
  }

  const nextStatus = STAGE_TO_STATUS[body.stage as PipelineStage];
  const [updated] = await db
    .update(applications)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new ApplicationError("Application not found", 404);
  return { application: toPublic(updated) };
}
