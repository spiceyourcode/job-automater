import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { testAuthHeader } from "../../test/auth-header.js";
import { registerRoutes } from "./index.js";
import { getBillingStatus } from "./billing.service.js";

const buildApp = () => {
  const app = new Hono();
  // Webhook must be registered before authed /billing (HG-2 exception: Stripe HMAC).
  registerRoutes(app);
  return app;
};

describe("GET /api/v1/billing/me", () => {
  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/billing/me");
    expect(res.status).toBe(401);
  });

  it("200 returns plan without leaking secrets", async () => {
    const res = await buildApp().request("/api/v1/billing/me", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plan: string };
    expect(body.plan).toBe("free");
    expect(JSON.stringify(body)).not.toMatch(/sk_live|whsec_/);
  });
});

describe("POST /api/v1/billing/webhook", () => {
  it("400 without valid signature", async () => {
    const res = await buildApp().request("/api/v1/billing/webhook", {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(400);
  });
});

describe("getBillingStatus", () => {
  it("does not expose stripe keys", () => {
    const status = getBillingStatus();
    expect("stripeSecretKey" in status).toBe(false);
  });
});
