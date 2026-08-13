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
    source: z.string().max(50).optional(),
    location: z.string().max(255).optional(),
    salaryMin: z.coerce.number().int().nonnegative().optional(),
    salaryMax: z.coerce.number().int().nonnegative().optional(),
    status: z.string().max(30).optional(),
    employmentType: z.string().max(50).optional(),
    experienceLevel: z.string().max(30).optional(),
    savedOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const jobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const importJobBodySchema = z
  .object({
    url: z.string().url().max(2048),
    sourceType: z.string().max(50).optional(),
  })
  .strict();

export const similarJobsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type ImportJobBody = z.infer<typeof importJobBodySchema>;
