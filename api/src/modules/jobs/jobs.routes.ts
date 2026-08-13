import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  jobIdParamSchema,
  listJobsQuerySchema,
  importJobBodySchema,
  similarJobsQuerySchema,
} from "./jobs.schema.js";
import * as jobsService from "./jobs.service.js";

export const jobsRoutes = new Hono();

const isJobError = (err: unknown): err is jobsService.JobError =>
  err instanceof jobsService.JobError;

jobsRoutes.use("*", requireAuth);

jobsRoutes.get("/", zValidator("query", listJobsQuerySchema), async (c) => {
  const { userId } = c.get("auth");
  const query = c.req.valid("query");
  const result = await jobsService.listJobs(userId, query);
  return c.json(result, 200);
});

jobsRoutes.post(
  "/import",
  zValidator("json", importJobBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const result = await jobsService.importJob(userId, c.req.valid("json"));
      return c.json(result, result.deduped ? 200 : 201);
    } catch (err) {
      if (isJobError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      if (err instanceof Error) {
        const msg = err.message;
        if (
          msg.includes("not allowed") ||
          msg.includes("Private") ||
          msg.includes("Host") ||
          msg.includes("Invalid URL") ||
          msg.includes("Only http") ||
          msg.includes("credentials") ||
          msg.includes("resolved")
        ) {
          return c.json({ error: msg }, 400);
        }
      }
      throw err;
    }
  },
);

jobsRoutes.get(
  "/:id/similar",
  zValidator("param", jobIdParamSchema),
  zValidator("query", similarJobsQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    const { limit } = c.req.valid("query");
    try {
      const result = await jobsService.listSimilarJobs(userId, id, limit);
      return c.json(result, 200);
    } catch (err) {
      if (isJobError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

jobsRoutes.post(
  "/:id/save",
  zValidator("param", jobIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await jobsService.saveJob(userId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isJobError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

jobsRoutes.delete(
  "/:id/save",
  zValidator("param", jobIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await jobsService.unsaveJob(userId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isJobError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

jobsRoutes.get(
  "/:id",
  zValidator("param", jobIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      const result = await jobsService.getJob(userId, id);
      return c.json(result, 200);
    } catch (err) {
      if (isJobError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
