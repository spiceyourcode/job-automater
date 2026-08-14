import { z } from "zod";

export const createApplicationBodySchema = z
  .object({
    jobId: z.string().uuid(),
  })
  .strict();

export const applicationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const applicationDownloadParamSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["cv", "cl", "zip"]),
});

/** AppFlow §2.4 pipeline stages */
export const pipelineStageSchema = z.enum([
  "applied",
  "screening",
  "interviewing",
  "offer",
  "archived",
]);

export const updateStageBodySchema = z
  .object({
    stage: pipelineStageSchema,
  })
  .strict();

export const setTemplateBodySchema = z
  .object({
    cvTemplate: z.enum(["modern", "classic", "minimal"]),
    clTemplate: z.enum(["modern", "classic", "minimal"]).optional(),
  })
  .strict();

export const bulletStatusSchema = z.enum(["accepted", "rejected", "pending"]);

export const updateBulletsBodySchema = z
  .object({
    traces: z
      .array(
        z
          .object({
            text: z.string().min(8).max(2000),
            chunkId: z.string().min(1).max(100),
            section: z.string().min(1).max(50),
            status: bulletStatusSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const regenerateSectionBodySchema = z
  .object({
    section: z.string().min(1).max(50),
  })
  .strict();

export const bulkGenerateBodySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(10),
    minScore: z.coerce.number().min(0).max(100).optional(),
  })
  .strict();

export const interviewerSchema = z
  .object({
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(200),
    email: z.string().email().optional(),
  })
  .strict();

export const createInterviewBodySchema = z
  .object({
    stage: z.string().min(1).max(80),
    type: z.string().min(1).max(80).optional(),
    scheduledAt: z.string().datetime({ offset: true }),
    interviewers: z.array(interviewerSchema).max(20).default([]),
    meetingLink: z.string().url().max(2000).optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();

export const interviewEventParamSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
});

export const patchInterviewBodySchema = z
  .object({
    status: z.enum(["scheduled", "passed", "failed", "cancelled"]).optional(),
    completedAt: z.string().datetime({ offset: true }).optional(),
    feedback: z.string().max(5000).optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.status !== undefined ||
      b.completedAt !== undefined ||
      b.feedback !== undefined ||
      b.notes !== undefined,
    { message: "At least one field required" },
  );

export const bulkActionBodySchema = z
  .object({
    applicationIds: z.array(z.string().uuid()).min(1).max(50),
    action: z.enum(["archive", "withdraw", "followup", "regenerate_docs"]),
  })
  .strict();

export const patchApplicationMetaBodySchema = z
  .object({
    userNotes: z.string().max(10_000).optional(),
    nextFollowupAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine(
    (b) => b.userNotes !== undefined || b.nextFollowupAt !== undefined,
    { message: "At least one field required" },
  );

export type CreateApplicationBody = z.infer<typeof createApplicationBodySchema>;
export type UpdateStageBody = z.infer<typeof updateStageBodySchema>;
export type SetTemplateBody = z.infer<typeof setTemplateBodySchema>;
export type UpdateBulletsBody = z.infer<typeof updateBulletsBodySchema>;
export type RegenerateSectionBody = z.infer<typeof regenerateSectionBodySchema>;
export type BulkGenerateBody = z.infer<typeof bulkGenerateBodySchema>;
export type CreateInterviewBody = z.infer<typeof createInterviewBodySchema>;
export type PatchInterviewBody = z.infer<typeof patchInterviewBodySchema>;
export type BulkActionBody = z.infer<typeof bulkActionBodySchema>;
export type PatchApplicationMetaBody = z.infer<
  typeof patchApplicationMetaBodySchema
>;
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

/** Map Kanban stage → applications.status */
export const STAGE_TO_STATUS: Record<PipelineStage, string> = {
  applied: "submitted",
  screening: "screening",
  interviewing: "interviewing",
  offer: "offered",
  archived: "archived",
};

/** Map applications.status → Kanban stage (best-effort). */
export function statusToStage(status: string): PipelineStage | null {
  switch (status) {
    case "submitted":
    case "approved":
    case "pending_approval":
    case "acknowledged":
      return "applied";
    case "screening":
      return "screening";
    case "interviewing":
      return "interviewing";
    case "offered":
      return "offer";
    case "archived":
    case "rejected":
    case "withdrawn":
    case "submit_failed":
      return "archived";
    default:
      return null;
  }
}
