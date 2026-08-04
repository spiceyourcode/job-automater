import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  inviteMemberBodySchema,
  memberIdParamSchema,
  patchMemberBodySchema,
} from "./team.schema.js";
import * as teamService from "./team.service.js";

export const teamRoutes = new Hono();

const isTeamError = (err: unknown): err is teamService.TeamError =>
  err instanceof teamService.TeamError;

teamRoutes.use("*", requireAuth);

teamRoutes.get("/", async (c) => {
  const { userId, workspaceId } = c.get("auth");
  try {
    return c.json(await teamService.getWorkspace(userId, workspaceId), 200);
  } catch (err) {
    if (isTeamError(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
});

teamRoutes.get("/members", async (c) => {
  const { userId, workspaceId } = c.get("auth");
  try {
    return c.json(await teamService.listMembers(userId, workspaceId), 200);
  } catch (err) {
    if (isTeamError(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
});

teamRoutes.post(
  "/members",
  requireRole("owner"),
  zValidator("json", inviteMemberBodySchema),
  async (c) => {
    const { userId, role, workspaceId } = c.get("auth");
    try {
      return c.json(
        await teamService.inviteMember(
          userId,
          role,
          workspaceId,
          c.req.valid("json"),
        ),
        201,
      );
    } catch (err) {
      if (isTeamError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

teamRoutes.patch(
  "/members/:userId",
  requireRole("owner"),
  zValidator("param", memberIdParamSchema),
  zValidator("json", patchMemberBodySchema),
  async (c) => {
    const { userId, role, workspaceId } = c.get("auth");
    try {
      return c.json(
        await teamService.updateMemberRole(
          userId,
          role,
          workspaceId,
          c.req.valid("param").userId,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isTeamError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

teamRoutes.delete(
  "/members/:userId",
  requireRole("owner"),
  zValidator("param", memberIdParamSchema),
  async (c) => {
    const { userId, role, workspaceId } = c.get("auth");
    try {
      return c.json(
        await teamService.removeMember(
          userId,
          role,
          workspaceId,
          c.req.valid("param").userId,
        ),
        200,
      );
    } catch (err) {
      if (isTeamError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
