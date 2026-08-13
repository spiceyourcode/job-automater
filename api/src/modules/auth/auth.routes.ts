import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";

export const authRoutes = new Hono();

const isAuthError = (err: unknown): boolean =>
  err instanceof Error &&
  "statusCode" in err &&
  (err as { statusCode: number }).statusCode === 401;

authRoutes.post(
  "/register",
  zValidator("json", registerBodySchema),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const result = await authService.register(
        body,
        c.req.header("user-agent"),
        c.req.header("x-forwarded-for"),
      );
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof authService.ConflictError) {
        return c.json({ error: err.message }, 409);
      }
      throw err;
    }
  },
);

authRoutes.post("/login", zValidator("json", loginBodySchema), async (c) => {
  const body = c.req.valid("json");
  try {
    const result = await authService.login(
      body,
      c.req.header("user-agent"),
      c.req.header("x-forwarded-for"),
    );
    return c.json(result, 200);
  } catch (err) {
    if (isAuthError(err)) {
      return c.json({ error: "Invalid credentials" }, 401);
    }
    throw err;
  }
});

authRoutes.post(
  "/refresh",
  zValidator("json", refreshBodySchema),
  async (c) => {
    const { refreshToken } = c.req.valid("json");
    try {
      const tokens = await authService.refresh(
        refreshToken,
        c.req.header("user-agent"),
        c.req.header("x-forwarded-for"),
      );
      return c.json(tokens, 200);
    } catch (err) {
      if (isAuthError(err)) {
        return c.json({ error: "Invalid or expired refresh token" }, 401);
      }
      throw err;
    }
  },
);

authRoutes.post("/logout", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  await authService.logout(userId);
  return c.json({ ok: true }, 200);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  try {
    const user = await authService.getMe(userId);
    return c.json(user, 200);
  } catch (err) {
    if (isAuthError(err)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    throw err;
  }
});

authRoutes.post(
  "/forgot-password",
  zValidator("json", forgotPasswordBodySchema),
  async (c) => {
    const result = await authService.forgotPassword(c.req.valid("json"));
    return c.json(result, 200);
  },
);

authRoutes.post(
  "/reset-password",
  zValidator("json", resetPasswordBodySchema),
  async (c) => {
    try {
      const result = await authService.resetPassword(c.req.valid("json"));
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof authService.BadRequestError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);

authRoutes.post(
  "/verify-email",
  zValidator("json", verifyEmailBodySchema),
  async (c) => {
    try {
      const result = await authService.verifyEmail(c.req.valid("json"));
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof authService.BadRequestError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);

authRoutes.post("/resend-verification", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  try {
    const result = await authService.resendVerification(userId);
    return c.json(result, 200);
  } catch (err) {
    if (isAuthError(err)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    throw err;
  }
});
