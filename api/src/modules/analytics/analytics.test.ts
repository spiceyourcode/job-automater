import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
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
    getSkillGaps: vi.fn(),
    buildAnalyticsExport: vi.fn(),
    getCvAbReport: vi.fn(),
  };
});

import * as analyticsService from "./analytics.service.js";
const mockService = vi.mocked(analyticsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/analytics", analyticsRoutes);
  return app;
};

const authHeader = (userId = "user-a") => testAuthHeader(userId);

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

describe("GET /api/v1/analytics/skills", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/analytics/skills");
    expect(res.status).toBe(401);
  });

  it("passes authenticated userId only (no other-user leak)", async () => {
    mockService.getSkillGaps.mockImplementation(async (uid: string) => {
      expect(uid).toBe("user-a");
      return {
        range: {
          from: "2026-05-16T00:00:00.000Z",
          to: "2026-08-14T00:00:00.000Z",
        },
        inDemand: [{ skill: "Python", count: 3, avgSalaryCents: 15000000 }],
        mySkills: ["Python"],
        mySkillsCoverage: {
          totalProfileSkills: 1,
          inDemandCovered: 1,
          coveragePct: 100,
        },
        gaps: [],
      };
    });
    const res = await buildApp().request("/api/v1/analytics/skills", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.getSkillGaps).toHaveBeenCalledWith(
      "user-a",
      expect.anything(),
    );
  });
});

describe("GET /api/v1/analytics/export", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/analytics/export");
    expect(res.status).toBe(401);
    expect(mockService.buildAnalyticsExport).not.toHaveBeenCalled();
  });

  it("exports CSV for the authenticated user only", async () => {
    mockService.buildAnalyticsExport.mockImplementation(async (uid: string) => {
      expect(uid).toBe("user-a");
      expect(uid).not.toBe("user-b");
      return {
        filename: "analytics-dashboard.csv",
        contentType: "text/csv; charset=utf-8",
        body: Buffer.from("metric,value\njobsCollected,10\n"),
      };
    });
    const res = await buildApp().request(
      "/api/v1/analytics/export?format=csv",
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    expect(text).toContain("jobsCollected");
    expect(text).not.toContain("user-b");
    expect(mockService.buildAnalyticsExport).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ format: "csv" }),
    );
  });

  it("does not call export with another user's id", async () => {
    mockService.buildAnalyticsExport.mockResolvedValue({
      filename: "analytics-dashboard.csv",
      contentType: "text/csv; charset=utf-8",
      body: Buffer.from("metric,value\n"),
    });
    await buildApp().request("/api/v1/analytics/export?format=csv", {
      headers: { Authorization: await authHeader("user-a") },
    });
    const uid = mockService.buildAnalyticsExport.mock.calls[0]?.[0];
    expect(uid).toBe("user-a");
    expect(uid).not.toBe("user-b");
  });
});

describe("GET /api/v1/analytics/cv-ab", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/analytics/cv-ab");
    expect(res.status).toBe(401);
  });

  it("200 returns caller-only variants", async () => {
    mockService.getCvAbReport.mockResolvedValue({
      variants: [
        {
          cvVersion: 1,
          applications: 4,
          submitted: 2,
          responses: 1,
          responseRatePct: 50,
        },
      ],
    });
    const res = await buildApp().request("/api/v1/analytics/cv-ab", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.getCvAbReport).toHaveBeenCalledWith("user-a");
  });
});
