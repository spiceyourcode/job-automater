import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import { patchProfileBodySchema } from "./profile.schema.js";
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
