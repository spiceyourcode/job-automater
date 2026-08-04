import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../../lib/jwt.js";
import { analyticsRoutes } from "./analytics.routes.js";

vi.mock("./analytics.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./analytics.service.js")>();
  return {
    ...actual,
    getDashboardSummary: vi.fn(),
    getPipelineFunnel: vi.fn(),
    getMatchQuality: vi.fn(),
    getSourcePerformance: vi.fn(),
  };
});

import * as analyticsService from "./analytics.service.js";
const mockService = vi.mocked(analyticsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/analytics", analyticsRoutes);
  return app;
};

const authHeader = async (userId = "user-a") => {
  const token = await signAccessToken({ sub: userId, email: "a@example.com" });
  return `Bearer ${token}`;
};

describe("GET /api/v1/analytics/dashboard", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/analytics/dashboard");
    expect(res.status).toBe(401);
  });

  it("200 returns summary", async () => {
    mockService.getDashboardSummary.mockResolvedValue({
      range: {
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
      },
      jobsCollected: 10,
      applicationsCreated: 3,
      applicationsSubmitted: 2,
      interviewing: 1,
      offered: 0,
      avgMatchScore: 78.5,
      highMatches: 4,
    });
    const res = await buildApp().request("/api/v1/analytics/dashboard", {
      headers: { Authorization: await authHeader() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobsCollected: number };
    expect(body.jobsCollected).toBe(10);
  });
});

describe("GET /api/v1/analytics/pipeline", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 returns funnel", async () => {
    mockService.getPipelineFunnel.mockResolvedValue({
      funnel: [{ stage: "applied", label: "Applied", count: 5 }],
    });
    const res = await buildApp().request("/api/v1/analytics/pipeline", {
      headers: { Authorization: await authHeader() },
    });
    expect(res.status).toBe(200);
  });
});
