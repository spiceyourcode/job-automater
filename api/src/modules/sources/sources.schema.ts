import { z } from "zod";
import { salaryCentsSchema } from "../../db/schema/validation.js";

/** Phase 2 source types only. */
export const sourceTypeSchema = z.enum(["rss", "api", "imap"]);

const rssConfigSchema = z
  .object({
    feedUrl: z.string().url(),
    keywords: z.array(z.string()).optional(),
    pollIntervalMinutes: z.number().int().positive().optional(),
  })
  .strict();

const apiConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    auth: z
      .object({
        type: z.enum(["none", "bearer", "basic", "api_key"]),
        credentials: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
    endpoints: z.array(z.string()).optional(),
    fieldMapping: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const imapConfigSchema = z
  .object({
    imapServer: z.string().min(1),
    port: z.number().int().positive().default(993),
    username: z.string().min(1),
    password: z.string().min(1),
    folder: z.string().default("INBOX"),
    searchCriteria: z.string().optional(),
  })
  .strict();

export const sourceConfigByType = {
  rss: rssConfigSchema,
  api: apiConfigSchema,
  imap: imapConfigSchema,
} as const;

export const createSourceBodySchema = z
  .object({
    sourceType: sourceTypeSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(2000).nullable().optional(),
    config: z.record(z.string(), z.unknown()),
    scheduleCron: z.string().max(100).nullable().optional(),
    timezone: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
    rateLimitPerMinute: z.number().int().positive().optional(),
    rateLimitPerHour: z.number().int().positive().optional(),
    keywordFilters: z.array(z.unknown()).optional(),
    locationFilters: z.array(z.unknown()).optional(),
    companyFilters: z.array(z.unknown()).optional(),
    salaryMin: salaryCentsSchema.nullable().optional(),
    experienceLevels: z.array(z.unknown()).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const schema = sourceConfigByType[data.sourceType];
    const parsed = schema.safeParse(data.config);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["config"],
        message: parsed.error.issues[0]?.message ?? "Invalid config for source type",
      });
    }
  });

export const patchSourceBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    scheduleCron: z.string().max(100).nullable().optional(),
    timezone: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
    rateLimitPerMinute: z.number().int().positive().optional(),
    rateLimitPerHour: z.number().int().positive().optional(),
    keywordFilters: z.array(z.unknown()).optional(),
    locationFilters: z.array(z.unknown()).optional(),
    companyFilters: z.array(z.unknown()).optional(),
    salaryMin: salaryCentsSchema.nullable().optional(),
    experienceLevels: z.array(z.unknown()).optional(),
  })
  .strict();

export const sourceIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateSourceBody = z.infer<typeof createSourceBodySchema>;
export type PatchSourceBody = z.infer<typeof patchSourceBodySchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
