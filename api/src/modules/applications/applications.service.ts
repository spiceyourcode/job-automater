import { and, desc, eq, gte, notInArray, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  applications,
  jobScores,
  jobs,
  profiles,
  type Application,
} from "../../db/schema/index.js";
import {
  enqueueGenerateDocs,
  enqueueSubmitApplication,
} from "../../lib/queue.js";
import { getPresignedGetUrl, uploadObject } from "../../lib/s3.js";
import { buildApplicationZip, textToAtsPdf } from "../../lib/ats-pdf.js";
import type {
  BulkGenerateBody,
  CreateApplicationBody,
  PipelineStage,
  RegenerateSectionBody,
  SetTemplateBody,
  UpdateBulletsBody,
  UpdateStageBody,
} from "./applications.schema.js";
import {
  STAGE_TO_STATUS,
  statusToStage,
} from "./applications.schema.js";

/** Contract state machine: draft → pending_approval → approved → submitted */
const APPROVABLE_STATUSES = new Set(["draft"]);

export type BulletTracePublic = {
  text: string;
  chunkId: string;
  section: string;
  status: "accepted" | "rejected" | "pending";
};

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 503,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

/** Normalize worker snake_case / API camelCase; drop untraced (HG-9). */
export function normalizeBulletTraces(raw: unknown): BulletTracePublic[] {
  if (!Array.isArray(raw)) return [];
  const out: BulletTracePublic[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const text = String(t.text ?? "").trim();
    const chunkId = String(t.chunkId ?? t.chunk_id ?? "").trim();
    const section = String(t.section ?? "").trim() || "experience";
    if (text.length < 8 || !chunkId) continue;
    const status =
      t.status === "accepted" || t.status === "rejected" ? t.status : "pending";
    out.push({ text, chunkId, section, status });
  }
  return out;
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
    bulletTraces: normalizeBulletTraces(app.bulletTraces),
    documentsReviewedAt: app.documentsReviewedAt,
    approvedAt: app.approvedAt,
    submittedAt: app.submittedAt,
    submittedVia: app.submittedVia,
    submitError: app.submitError,
    pipelineStage: statusToStage(app.status),
    generationModel: app.generationModel,
    cvTemplate: app.cvTemplate,
    clTemplate: app.clTemplate,
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

/**
 * P9.3 / FR-DG-06: queue GenerateDocs for top N scored matches.
 * Creates draft applications only — never enqueues submit (HG-4).
 */
export async function bulkGenerateDocuments(
  userId: string,
  body: BulkGenerateBody,
) {
  const existing = await db
    .select({ jobId: applications.jobId })
    .from(applications)
    .where(eq(applications.userId, userId));
  const existingIds = existing.map((r) => r.jobId);

  const scoreFilter =
    body.minScore != null
      ? gte(jobScores.overallScore, String(body.minScore))
      : undefined;

  const candidates = await db
    .select({
      jobId: jobs.id,
      overall: jobScores.overallScore,
    })
    .from(jobs)
    .innerJoin(
      jobScores,
      and(eq(jobScores.jobId, jobs.id), eq(jobScores.userId, userId)),
    )
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.isDuplicate, false),
        existingIds.length > 0 ? notInArray(jobs.id, existingIds) : undefined,
        scoreFilter,
      ),
    )
    .orderBy(sql`${jobScores.overallScore} DESC NULLS LAST`)
    .limit(body.limit);

  const [profile] = await db
    .select({ cvVersion: profiles.cvVersion })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const queued: Array<{ applicationId: string; jobId: string }> = [];
  for (const row of candidates) {
    const [created] = await db
      .insert(applications)
      .values({
        userId,
        jobId: row.jobId,
        cvVersion: profile?.cvVersion ?? 1,
        status: "draft",
      })
      .returning({ id: applications.id, jobId: applications.jobId });
    if (!created) continue;
    try {
      await enqueueGenerateDocs({
        application_id: created.id,
        user_id: userId,
        job_id: created.jobId,
      });
      queued.push({ applicationId: created.id, jobId: created.jobId });
    } catch {
      await db
        .delete(applications)
        .where(eq(applications.id, created.id));
    }
  }

  return {
    queued,
    count: queued.length,
    status: "generating" as const,
    /** Explicit HG-4 signal for tests/clients */
    submitEnqueued: false as const,
  };
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

/**
 * Switch CV/CL template and regenerate docs (layout only — HG-9 re-validated).
 * Clears review/approve so Apply stays gated until re-review.
 */
export async function setApplicationTemplate(
  userId: string,
  id: string,
  body: SetTemplateBody,
) {
  const app = await getOwned(userId, id);
  const clTemplate = body.clTemplate ?? body.cvTemplate;

  const [updated] = await db
    .update(applications)
    .set({
      cvTemplate: body.cvTemplate,
      clTemplate,
      documentsReviewedAt: null,
      approvedAt: null,
      tailoredCvContent: null,
      coverLetterContent: null,
      bulletTraces: [],
      status: "draft",
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new ApplicationError("Application not found", 404);

  try {
    await enqueueGenerateDocs({
      application_id: app.id,
      user_id: userId,
      job_id: app.jobId,
    });
  } catch {
    throw new ApplicationError("Failed to enqueue document generation", 503);
  }

  return {
    application: toPublic(updated),
    status: "generating" as const,
  };
}

/**
 * Persist accept/reject on each bullet (HG-9: every trace must have chunkId).
 * Does not unlock Apply — Confirm review still required.
 */
export async function updateBulletTraces(
  userId: string,
  id: string,
  body: UpdateBulletsBody,
) {
  await getOwned(userId, id);
  const normalized = normalizeBulletTraces(body.traces);
  if (normalized.length !== body.traces.length) {
    throw new ApplicationError(
      "Every bullet must include text and chunkId (HG-9)",
      400,
    );
  }

  const [updated] = await db
    .update(applications)
    .set({
      bulletTraces: normalized,
      documentsReviewedAt: null,
      approvedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new ApplicationError("Application not found", 404);
  return { application: toPublic(updated) };
}

/**
 * Regenerate one section; keep accepted bullets from other/same sections.
 */
export async function regenerateSection(
  userId: string,
  id: string,
  body: RegenerateSectionBody,
) {
  const app = await getOwned(userId, id);
  const section = body.section.trim().toLowerCase();
  const current = normalizeBulletTraces(app.bulletTraces);
  const accepted = current.filter(
    (t) => t.status === "accepted" && t.section.toLowerCase() !== section,
  );
  // Also keep accepted bullets in the same section? Spec: regenerate section —
  // typically replace all non-accepted in that section. Keep accepted in that section.
  const acceptedInSection = current.filter(
    (t) => t.status === "accepted" && t.section.toLowerCase() === section,
  );
  const keep = [...accepted, ...acceptedInSection];

  const [updated] = await db
    .update(applications)
    .set({
      documentsReviewedAt: null,
      approvedAt: null,
      tailoredCvContent: null,
      coverLetterContent: null,
      status: "draft",
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  if (!updated) throw new ApplicationError("Application not found", 404);

  try {
    await enqueueGenerateDocs({
      application_id: app.id,
      user_id: userId,
      job_id: app.jobId,
      accepted_traces: keep.map((t) => ({
        text: t.text,
        chunk_id: t.chunkId,
        section: t.section,
        status: "accepted",
      })),
      regenerate_sections: [section],
    });
  } catch {
    throw new ApplicationError("Failed to enqueue document generation", 503);
  }

  return {
    application: toPublic(updated),
    status: "generating" as const,
  };
}

/** Mark documents reviewed — unlocks Apply (still no submit without P4 approve). */
export async function markDocumentsReviewed(userId: string, id: string) {
  const app = await getOwned(userId, id);
  if (!app.tailoredCvContent || !app.coverLetterContent) {
    throw new ApplicationError("Documents not ready for review", 400);
  }
  const traces = normalizeBulletTraces(app.bulletTraces);
  if (traces.some((t) => t.status === "pending")) {
    throw new ApplicationError(
      "Accept or reject every bullet before confirming review",
      400,
    );
  }
  if (traces.some((t) => !t.chunkId)) {
    throw new ApplicationError("Untraced bullets cannot be saved (HG-9)", 400);
  }

  // Persist markdown + ATS PDFs + ZIP to MinIO for download URLs
  const cvKey = `applications/${userId}/${id}/tailored-cv.md`;
  const clKey = `applications/${userId}/${id}/cover-letter.md`;
  const cvPdfKey = `applications/${userId}/${id}/tailored-cv.pdf`;
  const clPdfKey = `applications/${userId}/${id}/cover-letter.pdf`;
  const zipKey = `applications/${userId}/${id}/application-pack.zip`;

  const cvPdf = await textToAtsPdf("Tailored CV", app.tailoredCvContent);
  const clPdf = await textToAtsPdf("Cover Letter", app.coverLetterContent);
  const zipBuf = await buildApplicationZip({
    cvText: app.tailoredCvContent,
    clText: app.coverLetterContent,
    metadata: {
      applicationId: id,
      jobId: app.jobId,
      cvTemplate: app.cvTemplate,
      clTemplate: app.clTemplate,
      bulletTraces: traces,
      generatedAt: new Date().toISOString(),
    },
  });

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
  await uploadObject({
    key: cvPdfKey,
    body: Buffer.from(cvPdf),
    contentType: "application/pdf",
  });
  await uploadObject({
    key: clPdfKey,
    body: Buffer.from(clPdf),
    contentType: "application/pdf",
  });
  await uploadObject({
    key: zipKey,
    body: zipBuf,
    contentType: "application/zip",
  });

  const [updated] = await db
    .update(applications)
    .set({
      documentsReviewedAt: new Date(),
      tailoredCvUrl: cvPdfKey,
      coverLetterUrl: clPdfKey,
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
  kind: "cv" | "cl" | "zip",
) {
  const app = await getOwned(userId, id);
  if (kind === "zip") {
    if (!app.documentsReviewedAt || !app.tailoredCvContent || !app.coverLetterContent) {
      throw new ApplicationError("Confirm review before downloading ZIP", 400);
    }
    const zipKey = `applications/${userId}/${id}/application-pack.zip`;
    const traces = normalizeBulletTraces(app.bulletTraces);
    const zipBuf = await buildApplicationZip({
      cvText: app.tailoredCvContent,
      clText: app.coverLetterContent,
      metadata: {
        applicationId: id,
        jobId: app.jobId,
        cvTemplate: app.cvTemplate,
        clTemplate: app.clTemplate,
        bulletTraces: traces,
        generatedAt: new Date().toISOString(),
      },
    });
    await uploadObject({
      key: zipKey,
      body: zipBuf,
      contentType: "application/zip",
    });
    const url = await getPresignedGetUrl(zipKey, 600);
    return { url, contentType: "application/zip" as const };
  }
  const key = kind === "cv" ? app.tailoredCvUrl : app.coverLetterUrl;
  if (!key) throw new ApplicationError("Document not available", 404);
  const url = await getPresignedGetUrl(key, 600);
  return {
    url,
    contentType: key.endsWith(".pdf")
      ? ("application/pdf" as const)
      : ("text/markdown" as const),
  };
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
