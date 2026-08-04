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

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: "owner" | "member" | "viewer";
  workspaceId: string;
}
