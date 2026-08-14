import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  applicationDownloadParamSchema,
  applicationIdParamSchema,
  bulkActionBodySchema,
  bulkGenerateBodySchema,
  createApplicationBodySchema,
  createInterviewBodySchema,
  interviewEventParamSchema,
  patchApplicationMetaBodySchema,
  patchInterviewBodySchema,
  regenerateSectionBodySchema,
  setTemplateBodySchema,
  updateBulletsBodySchema,
  updateStageBodySchema,
} from "./applications.schema.js";
import * as applicationsService from "./applications.service.js";

export const applicationsRoutes = new Hono();

const isAppError = (
  err: unknown,
): err is applicationsService.ApplicationError =>
  err instanceof applicationsService.ApplicationError;

applicationsRoutes.use("*", requireAuth);

applicationsRoutes.get("/", requireRole("owner", "member", "viewer"), async (c) => {
  const { userId } = c.get("auth");
  return c.json(await applicationsService.listApplications(userId), 200);
});

applicationsRoutes.post(
  "/",
  requireRole("owner", "member"),
  zValidator("json", createApplicationBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const result = await applicationsService.createApplication(
        userId,
        c.req.valid("json"),
      );
      return c.json(result, 201);
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/bulk-generate",
  requireRole("owner", "member"),
  zValidator("json", bulkGenerateBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const result = await applicationsService.bulkGenerateDocuments(
        userId,
        c.req.valid("json"),
      );
      return c.json(result, 202);
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/bulk-action",
  requireRole("owner", "member"),
  zValidator("json", bulkActionBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.bulkAction(userId, c.req.valid("json")),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.get(
  "/:id",
  requireRole("owner", "member", "viewer"),
  zValidator("param", applicationIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.getApplication(userId, c.req.valid("param").id),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/:id/regenerate",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.regenerateDocuments(
          userId,
          c.req.valid("param").id,
        ),
        202,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.patch(
  "/:id/template",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", setTemplateBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.setApplicationTemplate(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        202,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.patch(
  "/:id/bullets",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", updateBulletsBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.updateBulletTraces(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/:id/regenerate-section",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", regenerateSectionBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.regenerateSection(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        202,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/:id/review",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.markDocumentsReviewed(
          userId,
          c.req.valid("param").id,
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/:id/approve",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.approveApplication(
          userId,
          c.req.valid("param").id,
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.patch(
  "/:id/stage",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", updateStageBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.updateApplicationStage(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.patch(
  "/:id",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", patchApplicationMetaBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.patchApplicationMeta(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.post(
  "/:id/interviews",
  requireRole("owner", "member"),
  zValidator("param", applicationIdParamSchema),
  zValidator("json", createInterviewBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await applicationsService.addInterview(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        201,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.patch(
  "/:id/interviews/:eventId",
  requireRole("owner", "member"),
  zValidator("param", interviewEventParamSchema),
  zValidator("json", patchInterviewBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id, eventId } = c.req.valid("param");
    try {
      return c.json(
        await applicationsService.patchInterview(
          userId,
          id,
          eventId,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

applicationsRoutes.get(
  "/:id/download/:kind",
  requireRole("owner", "member", "viewer"),
  zValidator("param", applicationDownloadParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id, kind } = c.req.valid("param");
    try {
      return c.json(
        await applicationsService.getDocumentDownloadUrl(userId, id, kind),
        200,
      );
    } catch (err) {
      if (isAppError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
