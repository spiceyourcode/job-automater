import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import {
  contactIdParamSchema,
  createContactBodySchema,
  createInteractionBodySchema,
  listContactsQuerySchema,
  patchContactBodySchema,
} from "./recruiters.schema.js";
import * as recruitersService from "./recruiters.service.js";

export const recruitersRoutes = new Hono();

const isErr = (err: unknown): err is recruitersService.RecruiterError =>
  err instanceof recruitersService.RecruiterError;

recruitersRoutes.use("*", requireAuth);

recruitersRoutes.get(
  "/",
  requireRole("owner", "member", "viewer"),
  zValidator("query", listContactsQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(
      await recruitersService.listContacts(userId, c.req.valid("query").kind),
      200,
    );
  },
);

recruitersRoutes.post(
  "/",
  requireRole("owner", "member"),
  zValidator("json", createContactBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(
      await recruitersService.createContact(userId, c.req.valid("json")),
      201,
    );
  },
);

recruitersRoutes.get(
  "/:id",
  requireRole("owner", "member", "viewer"),
  zValidator("param", contactIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await recruitersService.getContact(userId, c.req.valid("param").id),
        200,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);

recruitersRoutes.patch(
  "/:id",
  requireRole("owner", "member"),
  zValidator("param", contactIdParamSchema),
  zValidator("json", patchContactBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await recruitersService.patchContact(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);

recruitersRoutes.delete(
  "/:id",
  requireRole("owner", "member"),
  zValidator("param", contactIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await recruitersService.deleteContact(userId, c.req.valid("param").id),
        200,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);

recruitersRoutes.post(
  "/:id/interactions",
  requireRole("owner", "member"),
  zValidator("param", contactIdParamSchema),
  zValidator("json", createInteractionBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await recruitersService.addInteraction(
          userId,
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
        201,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);
