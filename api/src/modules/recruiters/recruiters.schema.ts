import { z } from "zod";

export const contactKindSchema = z.enum(["recruiter", "referral"]);

export const listContactsQuerySchema = z
  .object({
    kind: contactKindSchema.optional(),
  })
  .strict();

export const createContactBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    company: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    role: z.string().max(200).optional(),
    linkedinUrl: z.string().url().max(2048).optional(),
    notes: z.string().max(5000).optional(),
    kind: contactKindSchema.optional().default("recruiter"),
  })
  .strict();

export const patchContactBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    company: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    role: z.string().max(200).optional(),
    linkedinUrl: z.string().url().max(2048).optional(),
    notes: z.string().max(5000).optional(),
    kind: contactKindSchema.optional(),
  })
  .strict();

export const contactIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createInteractionBodySchema = z
  .object({
    kind: z.enum(["note", "email", "call", "meeting"]).default("note"),
    summary: z.string().min(1).max(4000),
    applicationId: z.string().uuid().optional(),
    happenedAt: z.string().datetime().optional(),
  })
  .strict();

export type ContactKind = z.infer<typeof contactKindSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
export type CreateContactBody = z.infer<typeof createContactBodySchema>;
export type PatchContactBody = z.infer<typeof patchContactBodySchema>;
export type CreateInteractionBody = z.infer<typeof createInteractionBodySchema>;
