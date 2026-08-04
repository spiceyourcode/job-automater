import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import { jobIdParamSchema, listJobsQuerySchema } from "./jobs.schema.js";
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
