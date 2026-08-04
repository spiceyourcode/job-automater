import { z } from "zod";

export const emailMessageSchema = z
  .object({
    externalId: z.string().min(1).max(255),
    fromEmail: z.string().email().max(255),
    fromName: z.string().max(255).optional(),
    subject: z.string().max(500).optional(),
    snippet: z.string().max(2000).optional(),
    /** Accepted for classification storage; never returned in list APIs. */
    bodyText: z.string().max(50_000).optional(),
    receivedAt: z.string().datetime().optional(),
  })
  .strict();

export const syncEmailsBodySchema = z
  .object({
    messages: z.array(emailMessageSchema).min(1).max(50),
  })
  .strict();

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type SyncEmailsBody = z.infer<typeof syncEmailsBodySchema>;
