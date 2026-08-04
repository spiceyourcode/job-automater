import { z } from "zod";

/** Salary amounts are integer USD cents (HG-3). */
export const salaryCentsSchema = z.number().int().nonnegative();

export const userInsertSchema = z
  .object({
    email: z.string().email().max(255),
    emailVerified: z.boolean().optional(),
    name: z.string().max(255).nullable().optional(),
    avatarUrl: z.string().max(2048).nullable().optional(),
    timezone: z.string().max(50).optional(),
    locale: z.string().max(10).optional(),
    passwordHash: z.string().max(255).nullable().optional(),
    googleId: z.string().max(255).nullable().optional(),
    githubId: z.string().max(255).nullable().optional(),
    linkedinId: z.string().max(255).nullable().optional(),
  })
  .strict();

export const profileInsertSchema = z
  .object({
    userId: z.string().uuid(),
    headline: z.string().max(500).nullable().optional(),
    summary: z.string().nullable().optional(),
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
    cvFileId: z.string().uuid().nullable().optional(),
    cvVersion: z.number().int().positive().optional(),
    autoApplyEnabled: z.boolean().optional(),
    maxApplicationsPerDay: z.number().int().positive().optional(),
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

export const userSessionInsertSchema = z
  .object({
    userId: z.string().uuid(),
    tokenHash: z.string().min(1).max(255),
    userAgent: z.string().nullable().optional(),
    ipAddress: z.union([z.ipv4(), z.ipv6()]).nullable().optional(),
    expiresAt: z.coerce.date(),
    revokedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export type UserInsert = z.infer<typeof userInsertSchema>;
export type ProfileInsert = z.infer<typeof profileInsertSchema>;
export type UserSessionInsert = z.infer<typeof userSessionInsertSchema>;
