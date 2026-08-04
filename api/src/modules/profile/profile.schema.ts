import { z } from "zod";
import { salaryCentsSchema } from "../../db/schema/validation.js";

/** PATCH /profile — only fields the user may update. Never accepts userId. */
export const patchProfileBodySchema = z
  .object({
    headline: z.string().max(500).nullable().optional(),
    summary: z.string().max(5000).nullable().optional(),
    yearsExperience: z.number().int().nonnegative().nullable().optional(),
    currentRole: z.string().max(255).nullable().optional(),
    currentCompany: z.string().max(255).nullable().optional(),
    technicalSkills: z.array(z.unknown()).optional(),
    softSkills: z.array(z.unknown()).optional(),
    certifications: z.array(z.unknown()).optional(),
    preferredRoles: z.array(z.unknown()).optional(),
    preferredLocations: z.array(z.unknown()).optional(),
    salaryMin: salaryCentsSchema.nullable().optional(),
    salaryMax: salaryCentsSchema.nullable().optional(),
    salaryCurrency: z.string().length(3).optional(),
    employmentTypes: z.array(z.string()).optional(),
    visaStatus: z.string().max(50).nullable().optional(),
    noticePeriodWeeks: z.number().int().nonnegative().nullable().optional(),
    willingToRelocate: z.boolean().optional(),
    autoApplyEnabled: z.boolean().optional(),
    maxApplicationsPerDay: z.number().int().positive().max(100).optional(),
    minMatchScore: z.number().int().min(0).max(100).optional(),
    preferredCvTemplate: z.string().max(50).optional(),
    preferredClTemplate: z.string().max(50).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.salaryMin == null ||
      data.salaryMax == null ||
      data.salaryMin <= data.salaryMax,
    { message: "salaryMin must be <= salaryMax", path: ["salaryMax"] },
  );

export type PatchProfileBody = z.infer<typeof patchProfileBodySchema>;

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export const ALLOWED_CV_EXTENSIONS = new Set([".pdf", ".docx", ".doc"]);

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

/**
 * Resolve MIME for upload. Empty / octet-stream falls back to extension
 * so curl and mobile clients that omit Content-Type still work.
 */
export function resolveCvMimeType(
  mimeType: string | undefined,
  filename: string,
): string | null {
  const trimmed = (mimeType ?? "").trim().toLowerCase();
  if (trimmed && ALLOWED_CV_MIME_TYPES.has(trimmed)) return trimmed;
  if (
    !trimmed ||
    trimmed === "application/octet-stream" ||
    trimmed === "binary/octet-stream"
  ) {
    const ext = filename.includes(".")
      ? `.${filename.split(".").pop()!.toLowerCase()}`
      : "";
    return EXT_TO_MIME[ext] ?? null;
  }
  return null;
}
