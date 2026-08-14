import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { realtimeRoutes } from "./realtime.routes.js";

vi.mock("../../lib/realtime.js", () => ({
  issueWsTicket: vi.fn(async (userId: string) => ({
    ticket: `ticket-for-${userId}`,
    expiresIn: 30,
  })),
}));

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/realtime", realtimeRoutes);
  return app;
};

describe("GET /api/v1/realtime/ticket", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/realtime/ticket");
    expect(res.status).toBe(401);
  });

  it("issues a ticket bound to the authenticated user only", async () => {
    const res = await buildApp().request("/api/v1/realtime/ticket", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ticket: string };
    expect(body.ticket).toBe("ticket-for-user-a");
    expect(body.ticket).not.toContain("user-b");
  });
});
