import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authRoutes } from "./auth.routes.js";

// Mock the DB-backed service; keep real schema validation + JWT middleware
vi.mock("./auth.service.js", () => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  startOAuth: vi.fn(),
  completeOAuth: vi.fn(),
  exchangeOAuthCode: vi.fn(),
  patchMe: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  parseClientIp: vi.fn(() => null),
  ConflictError: class ConflictError extends Error {
    statusCode = 409;
    constructor(msg: string) {
      super(msg);
      this.name = "ConflictError";
    }
  },
  AuthError: class AuthError extends Error {
    statusCode = 401;
    constructor() {
      super("Invalid credentials");
      this.name = "AuthError";
    }
  },
  BadRequestError: class BadRequestError extends Error {
    statusCode = 400;
    constructor(msg: string) {
      super(msg);
      this.name = "BadRequestError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    statusCode = 404;
    constructor(msg = "not found") {
      super(msg);
      this.name = "NotFoundError";
    }
  },
}));

import * as authService from "./auth.service.js";
const mockService = vi.mocked(authService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/auth", authRoutes);
  return app;
};

// ── Real JWT middleware tests (no DB, real jose) ──────────────────────────────

import { testAuthHeader } from "../../test/auth-header.js";
import { requireAuth } from "../../middleware/require-auth.js";

const makeProtected = () => {
  const app = new Hono();
  app.get("/protected", requireAuth, (c) => c.json({ ok: true }));
  return app;
};

describe("requireAuth middleware", () => {
  it("200 with a valid real JWT", async () => {
    const res = await makeProtected().request("/protected", {
      headers: { Authorization: await testAuthHeader("user-id", "owner") },
    });
    expect(res.status).toBe(200);
  });

  it("401 with no Authorization header", async () => {
    const res = await makeProtected().request("/protected");
    expect(res.status).toBe(401);
  });

  it("401 with malformed token", async () => {
    const res = await makeProtected().request("/protected", {
      headers: { Authorization: "Bearer not.a.real.jwt" },
    });
    expect(res.status).toBe(401);
  });

  it("401 with 'Bearer ' but empty token", async () => {
    const res = await makeProtected().request("/protected", {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });
});

// ── Route-level tests ─────────────────────────────────────────────────────────

const AUTH_HEADER = () => testAuthHeader("user-id", "owner");

const mockAuthUser = {
  id: "uid",
  email: "a@b.com",
  name: null as string | null,
  emailVerified: false,
  avatarUrl: null as string | null,
  timezone: "UTC",
  locale: "en-US",
  role: "owner" as const,
  workspaceId: "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
};

describe("POST /api/v1/auth/register", () => {
  afterEach(() => vi.clearAllMocks());

  it("201 on valid registration", async () => {
    mockService.register.mockResolvedValue({
      user: mockAuthUser,
      tokens: { accessToken: "at", refreshToken: "rt" },
    });
    const res = await buildApp().request("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "password123" }),
    });
    expect(res.status).toBe(201);
  });

  it("400 when email invalid", async () => {
    const res = await buildApp().request("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when password too short", async () => {
    const res = await buildApp().request("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "short" }),
    });
    expect(res.status).toBe(400);
  });

  it("409 when email already taken", async () => {
    const { ConflictError } = await import("./auth.service.js");
    mockService.register.mockRejectedValue(
      new ConflictError("Unable to create account"),
    );
    const res = await buildApp().request("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "taken@b.com", password: "password123" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/v1/auth/login", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 on valid credentials", async () => {
    mockService.login.mockResolvedValue({
      user: { ...mockAuthUser, emailVerified: true },
      tokens: { accessToken: "at", refreshToken: "rt" },
    });
    const res = await buildApp().request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "password123" }),
    });
    expect(res.status).toBe(200);
  });

  it("401 on bad credentials", async () => {
    const { AuthError } = await import("./auth.service.js");
    mockService.login.mockRejectedValue(new AuthError());
    const res = await buildApp().request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 on valid refresh token", async () => {
    mockService.refresh.mockResolvedValue({
      accessToken: "at2",
      refreshToken: "rt2",
    });
    const res = await buildApp().request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "valid-token" }),
    });
    expect(res.status).toBe(200);
  });

  it("401 on expired/invalid refresh token", async () => {
    const { AuthError } = await import("./auth.service.js");
    mockService.refresh.mockRejectedValue(new AuthError());
    const res = await buildApp().request("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: "expired-token" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 with valid JWT", async () => {
    mockService.logout.mockResolvedValue(undefined);
    const res = await buildApp().request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: await AUTH_HEADER() },
    });
    expect(res.status).toBe(200);
  });

  it("401 without token", async () => {
    const res = await buildApp().request("/api/v1/auth/logout", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("401 with invalid JWT", async () => {
    const res = await buildApp().request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer bad.token.here" },
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 returns user with valid JWT", async () => {
    mockService.getMe.mockResolvedValue({
      ...mockAuthUser,
      email: "test@example.com",
      emailVerified: true,
    });
    const res = await buildApp().request("/api/v1/auth/me", {
      headers: { Authorization: await AUTH_HEADER() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe("uid");
  });

  it("401 without token", async () => {
    const res = await buildApp().request("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("401 with expired/invalid JWT", async () => {
    const res = await buildApp().request("/api/v1/auth/me", {
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.bad.bad" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/forgot-password", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 always (no email enumeration)", async () => {
    mockService.forgotPassword.mockResolvedValue({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
    const res = await buildApp().request("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("400 rejects userId in body (strict schema)", async () => {
    const res = await buildApp().request("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", userId: "x" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/reset-password", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 on valid token+password", async () => {
    mockService.resetPassword.mockResolvedValue({ ok: true });
    const res = await buildApp().request("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "a".repeat(40),
        password: "newpassword1",
      }),
    });
    expect(res.status).toBe(200);
    expect(mockService.resetPassword).toHaveBeenCalledWith({
      token: "a".repeat(40),
      password: "newpassword1",
    });
  });

  it("400 when token invalid", async () => {
    mockService.resetPassword.mockRejectedValue(
      new authService.BadRequestError("Invalid or expired reset token"),
    );
    const res = await buildApp().request("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "b".repeat(40),
        password: "newpassword1",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400 rejects userId from body", async () => {
    const res = await buildApp().request("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "c".repeat(40),
        password: "newpassword1",
        userId: "should-not-work",
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/verify-email", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 verifies with token only", async () => {
    mockService.verifyEmail.mockResolvedValue({ ok: true });
    const res = await buildApp().request("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "d".repeat(40) }),
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/v1/auth/oauth/:provider", () => {
  afterEach(() => vi.clearAllMocks());

  it("302 redirects to provider authorize URL", async () => {
    mockService.startOAuth.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    });
    const res = await buildApp().request("/api/v1/auth/oauth/google", {
      method: "GET",
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("accounts.google.com");
  });

  it("400 for unconfigured provider", async () => {
    mockService.startOAuth.mockRejectedValue(
      new authService.BadRequestError("OAuth provider 'linkedin' is not configured"),
    );
    const res = await buildApp().request("/api/v1/auth/oauth/linkedin");
    expect(res.status).toBe(400);
  });

  it("400 for unknown provider param", async () => {
    const res = await buildApp().request("/api/v1/auth/oauth/facebook");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/oauth/:provider/callback", () => {
  afterEach(() => vi.clearAllMocks());

  it("302 to web with exchange code on success", async () => {
    mockService.completeOAuth.mockResolvedValue({
      exchangeCode: "e".repeat(40),
    });
    const res = await buildApp().request(
      "/api/v1/auth/oauth/google/callback?code=abc&state=xyz",
      { method: "GET", redirect: "manual" },
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/oauth/complete");
    expect(loc).toContain("code=");
  });

  it("302 to login on email collision (no takeover)", async () => {
    mockService.completeOAuth.mockRejectedValue(
      new authService.ConflictError(
        "Email already registered — verify email or sign in with password to link",
      ),
    );
    const res = await buildApp().request(
      "/api/v1/auth/oauth/github/callback?code=abc&state=xyz",
      { method: "GET", redirect: "manual" },
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
    expect(loc).toContain("oauth_error=email_collision");
  });
});

describe("POST /api/v1/auth/oauth/exchange", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 returns tokens for valid code", async () => {
    mockService.exchangeOAuthCode.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    const res = await buildApp().request("/api/v1/auth/oauth/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "f".repeat(40) }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tokens: { accessToken: string; refreshToken: string };
    };
    expect(body.tokens.accessToken).toBe("access");
  });

  it("400 rejects short code", async () => {
    const res = await buildApp().request("/api/v1/auth/oauth/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/auth/me", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 updates timezone and locale", async () => {
    mockService.patchMe.mockResolvedValue({
      ...mockAuthUser,
      emailVerified: true,
      timezone: "Europe/Berlin",
      locale: "de-DE",
    });
    const res = await buildApp().request("/api/v1/auth/me", {
      method: "PATCH",
      headers: {
        Authorization: await AUTH_HEADER(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ timezone: "Europe/Berlin", locale: "de-DE" }),
    });
    expect(res.status).toBe(200);
    expect(mockService.patchMe).toHaveBeenCalledWith("user-id", {
      timezone: "Europe/Berlin",
      locale: "de-DE",
    });
  });

  it("400 when body empty", async () => {
    const res = await buildApp().request("/api/v1/auth/me", {
      method: "PATCH",
      headers: {
        Authorization: await AUTH_HEADER(),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("401 without token", async () => {
    const res = await buildApp().request("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ada" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/auth/sessions", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 lists sessions for caller", async () => {
    mockService.listSessions.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        userAgent: "Vitest",
        ipAddress: "127.0.0.1",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);
    const res = await buildApp().request("/api/v1/auth/sessions", {
      headers: { Authorization: await AUTH_HEADER() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: unknown[] };
    expect(body.sessions).toHaveLength(1);
    expect(mockService.listSessions).toHaveBeenCalledWith("user-id");
  });
});

describe("DELETE /api/v1/auth/sessions/:id", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 revokes own session", async () => {
    mockService.revokeSession.mockResolvedValue(undefined);
    const id = "11111111-1111-4111-8111-111111111111";
    const res = await buildApp().request(`/api/v1/auth/sessions/${id}`, {
      method: "DELETE",
      headers: { Authorization: await AUTH_HEADER() },
    });
    expect(res.status).toBe(200);
    expect(mockService.revokeSession).toHaveBeenCalledWith("user-id", id);
  });

  it("404 when session missing or not owned (no IDOR leak)", async () => {
    mockService.revokeSession.mockRejectedValue(
      new authService.NotFoundError(),
    );
    const res = await buildApp().request(
      "/api/v1/auth/sessions/22222222-2222-4222-8222-222222222222",
      {
        method: "DELETE",
        headers: { Authorization: await AUTH_HEADER() },
      },
    );
    expect(res.status).toBe(404);
  });
});
