/** Shared test helper — JWT must include role + workspaceId (P6.1). */
import { signAccessToken } from "../lib/jwt.js";
import type { WorkspaceRole } from "../db/schema/workspaces.js";

export async function testAuthHeader(
  userId = "user-a",
  role: WorkspaceRole = "owner",
  workspaceId = "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
) {
  const token = await signAccessToken({
    sub: userId,
    email: `${userId}@example.com`,
    role,
    workspaceId,
  });
  return `Bearer ${token}`;
}
