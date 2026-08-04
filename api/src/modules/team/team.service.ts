import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  users,
  workspaces,
  workspaceMembers,
} from "../../db/schema/index.js";
import type { WorkspaceRole } from "../../db/schema/workspaces.js";
import { canManageTeam } from "../../lib/rbac.js";
import type { InviteMemberBody, PatchMemberBody } from "./team.schema.js";

export class TeamError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "TeamError";
  }
}

function assertOwner(role: WorkspaceRole) {
  if (!canManageTeam(role)) {
    throw new TeamError("Only workspace owners can manage the team", 403);
  }
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) throw new TeamError("Workspace not found", 404);

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);
  if (!membership) throw new TeamError("Not a workspace member", 403);

  return {
    workspace: {
      id: ws.id,
      name: ws.name,
      ownerUserId: ws.ownerUserId,
    },
    role: membership.role as WorkspaceRole,
  };
}

export async function listMembers(userId: string, workspaceId: string) {
  await getWorkspace(userId, workspaceId);
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      email: users.email,
      name: users.name,
      createdAt: workspaceMembers.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return {
    members: rows.map((r) => ({
      userId: r.userId,
      role: r.role,
      email: r.email,
      name: r.name,
      createdAt: r.createdAt,
    })),
  };
}

export async function inviteMember(
  actorUserId: string,
  actorRole: WorkspaceRole,
  workspaceId: string,
  body: InviteMemberBody,
) {
  assertOwner(actorRole);
  await getWorkspace(actorUserId, workspaceId);

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.email, body.email), isNull(users.deletedAt)))
    .limit(1);
  if (!target) throw new TeamError("User not found", 404);

  const [existing] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, target.id),
      ),
    )
    .limit(1);
  if (existing) throw new TeamError("User is already a member", 409);

  await db.insert(workspaceMembers).values({
    workspaceId,
    userId: target.id,
    role: body.role,
  });

  return {
    member: {
      userId: target.id,
      email: target.email,
      role: body.role,
    },
  };
}

export async function updateMemberRole(
  actorUserId: string,
  actorRole: WorkspaceRole,
  workspaceId: string,
  targetUserId: string,
  body: PatchMemberBody,
) {
  assertOwner(actorRole);
  const { workspace } = await getWorkspace(actorUserId, workspaceId);
  if (targetUserId === workspace.ownerUserId) {
    throw new TeamError("Cannot change the owner role", 400);
  }

  const [updated] = await db
    .update(workspaceMembers)
    .set({ role: body.role })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    )
    .returning();
  if (!updated) throw new TeamError("Member not found", 404);
  return { member: { userId: updated.userId, role: updated.role } };
}

export async function removeMember(
  actorUserId: string,
  actorRole: WorkspaceRole,
  workspaceId: string,
  targetUserId: string,
) {
  assertOwner(actorRole);
  const { workspace } = await getWorkspace(actorUserId, workspaceId);
  if (targetUserId === workspace.ownerUserId) {
    throw new TeamError("Cannot remove the workspace owner", 400);
  }

  const deleted = await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUserId),
      ),
    )
    .returning({ id: workspaceMembers.id });
  if (deleted.length === 0) throw new TeamError("Member not found", 404);
  return { ok: true as const };
}
