import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { signAccessToken } from "./jwt.js";
import {
  RATE_LIMITS,
  consumeApiRateLimit,
  resetRateLimitMemory,
  setRedisClientFactory,
  useMemoryRateLimit,
} from "./rate-limit.js";
import { apiRateLimit } from "../middleware/api-rate-limit.js";

describe("consumeApiRateLimit", () => {
  afterEach(() => {
    resetRateLimitMemory();
    useMemoryRateLimit(false);
    setRedisClientFactory(null);
  });

  it("allows up to anonymous limit then blocks (P12.1 FAILURE)", async () => {
    useMemoryRateLimit(true);
    const anonKey = `test-anon-${Date.now()}-${Math.random()}`;
    let blocked = false;
    for (let i = 0; i < RATE_LIMITS.anonymous + 3; i++) {
      const r = await consumeApiRateLimit({ anonKey, userId: null });
      if (!r.allowed) {
        blocked = true;
        expect(r.kind).toBe("anonymous");
        expect(r.limit).toBe(RATE_LIMITS.anonymous);
        break;
      }
    }
    expect(blocked).toBe(true);
  });

  it("authenticated bucket is higher than anonymous", () => {
    expect(RATE_LIMITS.authenticated).toBe(100);
    expect(RATE_LIMITS.anonymous).toBe(20);
    expect(RATE_LIMITS.authenticated).toBeGreaterThan(RATE_LIMITS.anonymous);
  });

  it("falls back to memory when Redis is down (does not throw)", async () => {
    useMemoryRateLimit(false);
    setRedisClientFactory(() => {
      throw new Error("ECONNREFUSED");
    });
    const r = await consumeApiRateLimit({
      anonKey: `dead-redis-${Date.now()}`,
      userId: null,
    });
    expect(r.limit).toBe(RATE_LIMITS.anonymous);
    expect(typeof r.allowed).toBe("boolean");
  });
});

describe("apiRateLimit middleware", () => {
  afterEach(() => {
    resetRateLimitMemory();
    useMemoryRateLimit(false);
    setRedisClientFactory(null);
  });

  it("returns 429 for anonymous flood", async () => {
    useMemoryRateLimit(true);
    const app = new Hono();
    app.use("*", apiRateLimit);
    app.get("/api/v1/probe", (c) => c.json({ ok: true }));

    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    let got429 = false;
    for (let i = 0; i < RATE_LIMITS.anonymous + 5; i++) {
      const res = await app.request("/api/v1/probe", {
        headers: { "x-forwarded-for": ip },
      });
      if (res.status === 429) {
        got429 = true;
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe("rate_limited");
        expect(res.headers.get("retry-after")).toBeTruthy();
        break;
      }
    }
    expect(got429).toBe(true);
  });

  it("skips /health", async () => {
    useMemoryRateLimit(true);
    const app = new Hono();
    app.use("*", apiRateLimit);
    app.get("/health", (c) => c.json({ status: "ok" }));
    for (let i = 0; i < RATE_LIMITS.anonymous + 5; i++) {
      const res = await app.request("/health", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      });
      expect(res.status).toBe(200);
    }
  });

  it("uses authenticated limit when JWT present", async () => {
    useMemoryRateLimit(true);
    const token = await signAccessToken({
      sub: "user-rate-limit-a",
      email: "a@example.com",
      role: "owner",
      workspaceId: "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    const app = new Hono();
    app.use("*", apiRateLimit);
    app.get("/api/v1/probe", (c) => c.json({ ok: true }));

    for (let i = 0; i < RATE_LIMITS.anonymous + 1; i++) {
      const res = await app.request("/api/v1/probe", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-forwarded-for": "198.51.100.99",
        },
      });
      expect(res.status).toBe(200);
    }
  });
});
