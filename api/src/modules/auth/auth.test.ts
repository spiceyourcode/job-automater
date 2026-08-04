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
}));

import * as authService from "./auth.service.js";
const mockService = vi.mocked(authService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/auth", authRoutes);
  return app;
};

// ── Real JWT middleware tests (no DB, real jose) ──────────────────────────────

import { signAccessToken } from "../../lib/jwt.js";
import { requireAuth } from "../../middleware/require-auth.js";

const makeProtected = () => {
  const app = new Hono();
  app.get("/protected", requireAuth, (c) => c.json({ ok: true }));
  return app;
};

describe("requireAuth middleware", () => {
  it("200 with a valid real JWT", async () => {
    const token = await signAccessToken({
      sub: "user-id",
      email: "a@b.com",
    });
    const res = await makeProtected().request("/protected", {
      headers: { Authorization: `Bearer ${token}` },
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

const AUTH_HEADER = async () => {
  const token = await signAccessToken({ sub: "user-id", email: "t@e.com" });
  return `Bearer ${token}`;
};

describe("POST /api/v1/auth/register", () => {
  afterEach(() => vi.clearAllMocks());

  it("201 on valid registration", async () => {
    mockService.register.mockResolvedValue({
      user: { id: "uid", email: "a@b.com", name: null },
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
      user: { id: "uid", email: "a@b.com", name: null },
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
      id: "uid",
      email: "test@example.com",
      name: null,
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
