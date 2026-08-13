import { z } from "zod";
import { salaryCentsSchema } from "../../db/schema/validation.js";

/** Source types — Phase 2 + P8.1 playwright/career_page. */
export const sourceTypeSchema = z.enum([
  "rss",
  "api",
  "imap",
  "playwright",
  "career_page",
]);

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

const playwrightLoginSchema = z
  .object({
    loginUrl: z.string().url().optional(),
    usernameSelector: z.string().min(1),
    passwordSelector: z.string().min(1),
    submitSelector: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

const playwrightConfigSchema = z
  .object({
    startUrl: z.string().url(),
    jobCardSelector: z.string().min(1).max(500),
    titleSelector: z.string().min(1).max(500),
    urlSelector: z.string().min(1).max(500).optional(),
    locationSelector: z.string().min(1).max(500).optional(),
    departmentSelector: z.string().min(1).max(500).optional(),
    waitForSelector: z.string().min(1).max(500).optional(),
    paginationNextSelector: z.string().min(1).max(500).optional(),
    maxPages: z.number().int().positive().max(20).default(1),
    timeoutMs: z.number().int().positive().max(60000).optional(),
    login: playwrightLoginSchema.optional(),
  })
  .strict();

const careerPageConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    jobListPath: z.string().min(1).max(500).default("/careers"),
    jobCardSelector: z.string().min(1).max(500),
    titleSelector: z.string().min(1).max(500),
    urlSelector: z.string().min(1).max(500).optional(),
    locationSelector: z.string().min(1).max(500).optional(),
    departmentSelector: z.string().min(1).max(500).optional(),
    waitForSelector: z.string().min(1).max(500).optional(),
    paginationNextSelector: z.string().min(1).max(500).optional(),
    maxPages: z.number().int().positive().max(20).default(1),
    timeoutMs: z.number().int().positive().max(60000).optional(),
  })
  .strict();

export const sourceConfigByType = {
  rss: rssConfigSchema,
  api: apiConfigSchema,
  imap: imapConfigSchema,
  playwright: playwrightConfigSchema,
  career_page: careerPageConfigSchema,
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
  .transform((data, ctx) => {
    const schema = sourceConfigByType[data.sourceType];
    const parsed = schema.safeParse(data.config);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["config"],
        message:
          parsed.error.issues[0]?.message ?? "Invalid config for source type",
      });
      return z.NEVER;
    }
    // Persist Zod defaults (e.g. IMAP port/folder), not the raw request body
    return { ...data, config: parsed.data as Record<string, unknown> };
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
