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

export type CreateApplicationBody = z.infer<typeof createApplicationBodySchema>;
