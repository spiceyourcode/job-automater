import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import { env } from "../../env.js";
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  verifyEmailBodySchema,
  oauthProviderParamSchema,
  oauthCallbackQuerySchema,
  oauthExchangeBodySchema,
  patchMeBodySchema,
  sessionIdParamSchema,
} from "./auth.schema.js";
import * as authService from "./auth.service.js";

export const authRoutes = new Hono();

const isAuthError = (err: unknown): boolean =>
  err instanceof Error &&
  "statusCode" in err &&
  (err as { statusCode: number }).statusCode === 401;

function oauthErrorRedirect(reason: string): Response {
  const url = new URL("/login", env.appUrl);
  url.searchParams.set("oauth_error", reason);
  return Response.redirect(url.toString(), 302);
}

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

authRoutes.patch(
  "/me",
  requireAuth,
  zValidator("json", patchMeBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const user = await authService.patchMe(userId, c.req.valid("json"));
      return c.json(user, 200);
    } catch (err) {
      if (isAuthError(err)) {
        return c.json({ error: "unauthorized" }, 401);
      }
      throw err;
    }
  },
);

authRoutes.get("/sessions", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  const sessions = await authService.listSessions(userId);
  return c.json({ sessions }, 200);
});

authRoutes.delete(
  "/sessions/:id",
  requireAuth,
  zValidator("param", sessionIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    const { id } = c.req.valid("param");
    try {
      await authService.revokeSession(userId, id);
      return c.json({ ok: true }, 200);
    } catch (err) {
      if (err instanceof authService.NotFoundError) {
        return c.json({ error: "not found" }, 404);
      }
      throw err;
    }
  },
);

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

/** Start OAuth — redirects browser to the provider authorize URL. */
authRoutes.get(
  "/oauth/:provider",
  zValidator("param", oauthProviderParamSchema),
  async (c) => {
    const { provider } = c.req.valid("param");
    try {
      const { url } = await authService.startOAuth(provider);
      return c.redirect(url, 302);
    } catch (err) {
      if (err instanceof authService.BadRequestError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);

/** Provider callback — never returns tokens in the URL; one-time exchange code only. */
authRoutes.get(
  "/oauth/:provider/callback",
  zValidator("param", oauthProviderParamSchema),
  zValidator("query", oauthCallbackQuerySchema),
  async (c) => {
    const { provider } = c.req.valid("param");
    const q = c.req.valid("query");
    if (q.error) {
      return oauthErrorRedirect("provider_denied");
    }
    if (!q.code || !q.state) {
      return oauthErrorRedirect("missing_code");
    }
    try {
      const { exchangeCode } = await authService.completeOAuth(
        provider,
        { code: q.code, state: q.state },
        c.req.header("user-agent"),
        c.req.header("x-forwarded-for"),
      );
      const dest = new URL("/oauth/complete", env.appUrl);
      dest.searchParams.set("code", exchangeCode);
      return c.redirect(dest.toString(), 302);
    } catch (err) {
      if (err instanceof authService.ConflictError) {
        return oauthErrorRedirect("email_collision");
      }
      if (err instanceof authService.BadRequestError) {
        return oauthErrorRedirect("invalid_state");
      }
      return oauthErrorRedirect("oauth_failed");
    }
  },
);

/** Exchange one-time code for JWT pair (server-side / server action only). */
authRoutes.post(
  "/oauth/exchange",
  zValidator("json", oauthExchangeBodySchema),
  async (c) => {
    try {
      const { code } = c.req.valid("json");
      const tokens = await authService.exchangeOAuthCode(code);
      return c.json({ tokens }, 200);
    } catch (err) {
      if (err instanceof authService.BadRequestError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }
  },
);
