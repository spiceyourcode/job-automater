import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  createSourceBodySchema,
  patchSourceBodySchema,
  sourceIdParamSchema,
} from "./sources.schema.js";
import * as sourcesService from "./sources.service.js";

export const sourcesRoutes = new Hono();

const isSourceError = (err: unknown): err is sourcesService.SourceError =>
  err instanceof sourcesService.SourceError;

sourcesRoutes.use("*", requireAuth);

sourcesRoutes.get("/", requireRole("owner", "member"), async (c) => {
  const { workspaceId } = c.get("auth");
  const result = await sourcesService.listSources(workspaceId);
  return c.json(result, 200);
});

sourcesRoutes.post(
  "/",
  requireRole("owner"),
  zValidator("json", createSourceBodySchema),
  async (c) => {
    const { userId, workspaceId } = c.get("auth");
    const body = c.req.valid("json");
    const result = await sourcesService.createSource(userId, workspaceId, body);
    return c.json(result, 201);
  },
);

sourcesRoutes.get(
  "/:id",
  requireRole("owner", "member"),
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { workspaceId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.getSource(workspaceId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

sourcesRoutes.patch(
  "/:id",
  requireRole("owner"),
  zValidator("param", sourceIdParamSchema),
  zValidator("json", patchSourceBodySchema),
  async (c) => {
    const { workspaceId } = c.get("auth");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    try {
      const result = await sourcesService.patchSource(workspaceId, id, body);
      return c.json(result, 200);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

sourcesRoutes.delete(
  "/:id",
  requireRole("owner"),
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { workspaceId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.deleteSource(workspaceId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

sourcesRoutes.post(
  "/:id/test",
  requireRole("owner"),
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { workspaceId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.testSource(workspaceId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

sourcesRoutes.post(
  "/:id/run",
  requireRole("owner"),
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { userId, workspaceId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.runSource(userId, workspaceId, id);
      return c.json(result, 202);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
