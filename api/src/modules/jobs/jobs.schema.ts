import { z } from "zod";

export const listJobsQuerySchema = z
  .object({
    sort: z.enum(["score", "date"]).default("score"),
    minScore: z.coerce.number().min(0).max(100).optional(),
    q: z.string().max(200).optional(),
    remoteOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    includeDuplicates: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const jobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
