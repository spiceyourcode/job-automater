import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  patchProfileBodySchema,
  cvVersionParamSchema,
  reindexCvBodySchema,
  chunksQuerySchema,
  diffQuerySchema,
} from "./profile.schema.js";
import * as profileService from "./profile.service.js";

export const profileRoutes = new Hono();

const isProfileError = (
  err: unknown,
): err is profileService.ProfileError =>
  err instanceof profileService.ProfileError;

// All profile routes require auth — ownership is always c.get("auth").userId
profileRoutes.use("*", requireAuth);

profileRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  const profile = await profileService.getProfile(userId);
  return c.json({ profile }, 200);
});

profileRoutes.patch("/", zValidator("json", patchProfileBodySchema), async (c) => {
  const { userId } = c.get("auth");
  const body = c.req.valid("json");
  try {
    const profile = await profileService.patchProfile(userId, body);
    return c.json({ profile }, 200);
  } catch (err) {
    if (isProfileError(err)) {
      return c.json({ error: err.message }, err.statusCode);
    }
    throw err;
  }
});

profileRoutes.post("/cv", async (c) => {
  const { userId } = c.get("auth");

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: "Expected multipart/form-data" }, 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing file field" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawMime = file.type || "";
  // Log metadata only — never content (HG-8)
  console.info(
    JSON.stringify({
      event: "cv_upload",
      userId,
      filename: file.name,
      size: buffer.byteLength,
      mimeType: rawMime || "application/octet-stream",
    }),
  );

  try {
    const result = await profileService.uploadCv(userId, {
      filename: file.name || "cv.pdf",
      mimeType: rawMime,
      data: buffer,
    });
    return c.json(result, 201);
  } catch (err) {
    if (isProfileError(err)) {
      return c.json({ error: err.message }, err.statusCode);
    }
    throw err;
  }
});

profileRoutes.get("/cv/versions", async (c) => {
  const { userId } = c.get("auth");
  const result = await profileService.listCvVersions(userId);
  return c.json(result, 200);
});

profileRoutes.post(
  "/cv/reindex",
  zValidator("json", reindexCvBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const result = await profileService.reindexCv(userId, c.req.valid("json"));
      return c.json(result, 202);
    } catch (err) {
      if (isProfileError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

profileRoutes.post(
  "/cv/:version/activate",
  zValidator("param", cvVersionParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { version } = c.req.valid("param");
    try {
      const result = await profileService.activateCvVersion(userId, version);
      return c.json(result, 200);
    } catch (err) {
      if (isProfileError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

profileRoutes.delete(
  "/cv/:version",
  zValidator("param", cvVersionParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { version } = c.req.valid("param");
    try {
      const result = await profileService.deleteCvVersion(userId, version);
      return c.json(result, 200);
    } catch (err) {
      if (isProfileError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

profileRoutes.get(
  "/cv/:version/chunks",
  zValidator("param", cvVersionParamSchema),
  zValidator("query", chunksQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { version } = c.req.valid("param");
    const q = c.req.valid("query");
    try {
      const result = await profileService.listCvChunks(userId, version, q);
      return c.json(result, 200);
    } catch (err) {
      if (isProfileError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

profileRoutes.get(
  "/cv/:version/diff",
  zValidator("param", cvVersionParamSchema),
  zValidator("query", diffQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { version } = c.req.valid("param");
    const { against } = c.req.valid("query");
    try {
      const result = await profileService.diffCvVersions(
        userId,
        version,
        against,
      );
      return c.json(result, 200);
    } catch (err) {
      if (isProfileError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);

profileRoutes.get("/export", async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await profileService.exportUserData(userId), 200);
  } catch (err) {
    if (isProfileError(err)) {
      return c.json({ error: err.message }, err.statusCode);
    }
    throw err;
  }
});

profileRoutes.delete("/", async (c) => {
  const { userId } = c.get("auth");
  try {
    const result = await profileService.deleteUserAccount(userId);
    return c.json(result, 200);
  } catch (err) {
    if (isProfileError(err)) {
      return c.json({ error: err.message }, err.statusCode);
    }
    throw err;
  }
});
