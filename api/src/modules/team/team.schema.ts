import { z } from "zod";
import { WORKSPACE_ROLES } from "../../db/schema/workspaces.js";

export const inviteMemberBodySchema = z
  .object({
    email: z.string().email().max(255).toLowerCase(),
    role: z.enum(["member", "viewer"]),
  })
  .strict();

export const memberIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export const patchMemberBodySchema = z
  .object({
    role: z.enum(["member", "viewer"]),
  })
  .strict();

export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;
export type PatchMemberBody = z.infer<typeof patchMemberBodySchema>;

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);
