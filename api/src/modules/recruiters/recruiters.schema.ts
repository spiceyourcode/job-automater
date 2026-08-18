import { z } from "zod";

export const createContactBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    company: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    role: z.string().max(200).optional(),
    linkedinUrl: z.string().url().max(2048).optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();

export const patchContactBodySchema = createContactBodySchema.partial();

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

export type CreateContactBody = z.infer<typeof createContactBodySchema>;
export type PatchContactBody = z.infer<typeof patchContactBodySchema>;
export type CreateInteractionBody = z.infer<typeof createInteractionBodySchema>;
