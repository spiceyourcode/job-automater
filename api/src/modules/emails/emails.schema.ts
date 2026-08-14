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

export const gmailPushQuerySchema = z
  .object({
    token: z.string().max(200).optional(),
  })
  .strict();

export const channelPrefSchema = z
  .object({
    inApp: z.boolean(),
    email: z.boolean(),
    slack: z.boolean(),
    telegram: z.boolean(),
  })
  .strict();

export const patchNotificationPrefsBodySchema = z
  .object({
    preferences: z.record(z.string(), channelPrefSchema).optional(),
    slackWebhookUrl: z.string().url().max(2000).nullable().optional(),
    telegramWebhookUrl: z.string().url().max(2000).nullable().optional(),
  })
  .strict();

export type SyncEmailsBody = z.infer<typeof syncEmailsBodySchema>;
export type PatchNotificationPrefsBody = z.infer<
  typeof patchNotificationPrefsBodySchema
>;

export const emailIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const classifyEmailBodySchema = z
  .object({
    category: z.enum([
      "application_confirmation",
      "interview_invitation",
      "rejection",
      "offer",
      "follow_up_request",
      "spam",
      "other",
    ]),
  })
  .strict();

export type ClassifyEmailBody = z.infer<typeof classifyEmailBodySchema>;
