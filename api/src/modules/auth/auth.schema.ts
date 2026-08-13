import { z } from "zod";

export const registerBodySchema = z
  .object({
    email: z.string().email().max(255).toLowerCase(),
    password: z.string().min(8).max(72),
    name: z.string().max(255).optional(),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z.string().email().max(255).toLowerCase(),
    password: z.string().min(1).max(72),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const forgotPasswordBodySchema = z
  .object({
    email: z.string().email().max(255).toLowerCase(),
  })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: z.string().min(20).max(128),
    password: z.string().min(8).max(72),
  })
  .strict();

export const verifyEmailBodySchema = z
  .object({
    token: z.string().min(20).max(128),
  })
  .strict();

export const oauthProviderParamSchema = z
  .object({
    provider: z.enum(["google", "github", "linkedin"]),
  })
  .strict();

export const oauthCallbackQuerySchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  })
  .strict();

export const oauthExchangeBodySchema = z
  .object({
    code: z.string().min(20).max(128),
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type VerifyEmailBody = z.infer<typeof verifyEmailBodySchema>;
export type OAuthExchangeBody = z.infer<typeof oauthExchangeBodySchema>;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  role: "owner" | "member" | "viewer";
  workspaceId: string;
}
