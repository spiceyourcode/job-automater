import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
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

sourcesRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const result = await sourcesService.listSources(userId);
  return c.json(result, 200);
});

sourcesRoutes.post("/", zValidator("json", createSourceBodySchema), async (c) => {
  const { userId } = c.get("auth");
  const body = c.req.valid("json");
  const result = await sourcesService.createSource(userId, body);
  return c.json(result, 201);
});

sourcesRoutes.get(
  "/:id",
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.getSource(userId, id);
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
  zValidator("param", sourceIdParamSchema),
  zValidator("json", patchSourceBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    try {
      const result = await sourcesService.patchSource(userId, id, body);
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
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.deleteSource(userId, id);
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
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.testSource(userId, id);
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
  zValidator("param", sourceIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await sourcesService.runSource(userId, id);
      return c.json(result, 202);
    } catch (err) {
      if (isSourceError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
