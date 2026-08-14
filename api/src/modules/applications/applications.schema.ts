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
  kind: z.enum(["cv", "cl"]),
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

export type CreateApplicationBody = z.infer<typeof createApplicationBodySchema>;
export type UpdateStageBody = z.infer<typeof updateStageBodySchema>;
export type SetTemplateBody = z.infer<typeof setTemplateBodySchema>;
export type UpdateBulletsBody = z.infer<typeof updateBulletsBodySchema>;
export type RegenerateSectionBody = z.infer<typeof regenerateSectionBodySchema>;
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
