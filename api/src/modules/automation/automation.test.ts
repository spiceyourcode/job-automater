import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { automationRoutes } from "./automation.routes.js";

vi.mock("./automation.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./automation.service.js")>();
  return {
    ...actual,
    emergencyStop: vi.fn(),
    getAutomationStatus: vi.fn(),
    AutomationError: actual.AutomationError,
  };
});

import * as automationService from "./automation.service.js";
const mockService = vi.mocked(automationService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/automation", automationRoutes);
  return app;
};

describe("POST /api/v1/automation/emergency-stop", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/automation/emergency-stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    expect(res.status).toBe(401);
  });

  it("200 activates stop and drains queue", async () => {
    mockService.emergencyStop.mockResolvedValue({
      active: true,
      drained: 2,
      message: "Submit automation stopped; pending submits drained",
      limits: {
        perSitePerMinute: 2,
        perSitePerDay: 20,
        globalPerDay: 50,
      },
    });
    const res = await buildApp().request("/api/v1/automation/emergency-stop", {
      method: "POST",
      headers: {
        Authorization: await testAuthHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ active: true }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { active: boolean; drained: number };
    expect(body.active).toBe(true);
    expect(body.drained).toBe(2);
    expect(mockService.emergencyStop).toHaveBeenCalledWith("user-a", true);
  });

  it("200 clears stop when active=false", async () => {
    mockService.emergencyStop.mockResolvedValue({
      active: false,
      drained: 0,
      message: "Submit automation resumed",
      limits: {
        perSitePerMinute: 2,
        perSitePerDay: 20,
        globalPerDay: 50,
      },
    });
    const res = await buildApp().request("/api/v1/automation/emergency-stop", {
      method: "POST",
      headers: {
        Authorization: await testAuthHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ active: false }),
    });
    expect(res.status).toBe(200);
    expect(mockService.emergencyStop).toHaveBeenCalledWith("user-a", false);
  });
});

describe("GET /api/v1/automation/status", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 returns stop flag", async () => {
    mockService.getAutomationStatus.mockResolvedValue({
      emergencyStop: true,
      limits: {
        perSitePerMinute: 2,
        perSitePerDay: 20,
        globalPerDay: 50,
      },
    });
    const res = await buildApp().request("/api/v1/automation/status", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { emergencyStop: boolean };
    expect(body.emergencyStop).toBe(true);
  });
});
