/**
 * P6.2 E2E — register → onboard → source → match → generate → approve → submit
 *
 * API-level orchestration (contract: api/e2e/ or web/e2e/).
 * FAILURE: missing approve gate step; HG-4 submit without approved_at.
 */
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../src/test/auth-header.js";
import { profileRoutes } from "../src/modules/profile/profile.routes.js";
import { sourcesRoutes } from "../src/modules/sources/sources.routes.js";
import { jobsRoutes } from "../src/modules/jobs/jobs.routes.js";
import { applicationsRoutes } from "../src/modules/applications/applications.routes.js";
import { authRoutes } from "../src/modules/auth/auth.routes.js";

vi.mock("../src/modules/auth/auth.service.js", () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConflictError";
    }
  },
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

vi.mock("../src/modules/profile/profile.service.js", () => ({
  getProfile: vi.fn(),
  patchProfile: vi.fn(),
  uploadCv: vi.fn(),
  listCvVersions: vi.fn(),
  exportUserData: vi.fn(),
  deleteUserAccount: vi.fn(),
  ProfileError: class ProfileError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = "ProfileError";
    }
  },
}));

vi.mock("../src/modules/sources/sources.service.js", () => ({
  listSources: vi.fn(),
  createSource: vi.fn(),
  getSource: vi.fn(),
  patchSource: vi.fn(),
  deleteSource: vi.fn(),
  runSource: vi.fn(),
  testSource: vi.fn(),
  SourceError: class SourceError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = "SourceError";
    }
  },
}));

vi.mock("../src/modules/jobs/jobs.service.js", () => ({
  listJobs: vi.fn(),
  getJob: vi.fn(),
  JobError: class JobError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = "JobError";
    }
  },
}));

vi.mock("../src/modules/applications/applications.service.js", () => ({
  listApplications: vi.fn(),
  getApplication: vi.fn(),
  createApplication: vi.fn(),
  reviewDocuments: vi.fn(),
  approveApplication: vi.fn(),
  regenerateDocuments: vi.fn(),
  updateApplicationStage: vi.fn(),
  downloadDocument: vi.fn(),
  ApplicationError: class ApplicationError extends Error {
    constructor(
      message: string,
      readonly statusCode: number,
    ) {
      super(message);
      this.name = "ApplicationError";
    }
  },
}));

import * as authService from "../src/modules/auth/auth.service.js";
import * as profileService from "../src/modules/profile/profile.service.js";
import * as sourcesService from "../src/modules/sources/sources.service.js";
import * as jobsService from "../src/modules/jobs/jobs.service.js";
import * as applicationsService from "../src/modules/applications/applications.service.js";
import { enqueueSubmitApplication } from "../src/lib/queue.js";

const mockAuth = vi.mocked(authService, true);
const mockProfile = vi.mocked(profileService, true);
const mockSources = vi.mocked(sourcesService, true);
const mockJobs = vi.mocked(jobsService, true);
const mockApps = vi.mocked(applicationsService, true);

const JOB_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const APP_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const USER_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function buildE2EApp() {
  const app = new Hono();
  app.route("/api/v1/auth", authRoutes);
  app.route("/api/v1/profile", profileRoutes);
  app.route("/api/v1/sources", sourcesRoutes);
  app.route("/api/v1/jobs", jobsRoutes);
  app.route("/api/v1/applications", applicationsRoutes);
  return app;
}

describe("E2E happy path (approve gate)", () => {
  afterEach(() => vi.clearAllMocks());

  it("walks register → onboard → source → match → generate → approve → submit", async () => {
    const app = buildE2EApp();
    const steps: string[] = [];
    const token = await testAuthHeader(USER_ID, "owner");

    mockAuth.register.mockImplementation(async () => {
      steps.push("register");
      return {
        user: {
          id: USER_ID,
          email: "e2e@example.com",
          name: "E2E",
          role: "owner" as const,
          workspaceId: "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        },
        accessToken: "tok",
        refreshToken: "ref",
      };
    });

    const reg = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "e2e@example.com",
        password: "Password1!",
        name: "E2E",
      }),
    });
    expect(reg.status).toBe(201);
    expect(steps).toContain("register");

    mockProfile.patchProfile.mockImplementation(async () => {
      steps.push("onboard");
      return { userId: USER_ID, headline: "Engineer" };
    });
    const onboard = await app.request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        headline: "Engineer",
        preferredRoles: ["Backend"],
      }),
    });
    expect(onboard.status).toBe(200);
    expect(steps).toContain("onboard");

    mockSources.createSource.mockImplementation(async () => {
      steps.push("source");
      return {
        source: {
          id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
          name: "RSS Feed",
          sourceType: "rss",
          isActive: true,
        },
      };
    });
    const source = await app.request("/api/v1/sources", {
      method: "POST",
      headers: {
        Authorization: token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "RSS Feed",
        sourceType: "rss",
        config: { feedUrl: "https://example.com/jobs.rss" },
      }),
    });
    expect(source.status).toBe(201);
    expect(steps).toContain("source");

    mockJobs.listJobs.mockImplementation(async () => {
      steps.push("match");
      return {
        jobs: [{ id: JOB_ID, title: "SWE", company: "Acme", matchScore: 88 }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    });
    const match = await app.request("/api/v1/jobs", {
      headers: { Authorization: token },
    });
    expect(match.status).toBe(200);
    expect(steps).toContain("match");

    mockApps.createApplication.mockImplementation(async () => {
      steps.push("generate");
      return {
        application: {
          id: APP_ID,
          jobId: JOB_ID,
          status: "draft",
          canApprove: true,
          documentsReviewedAt: new Date().toISOString(),
        },
      };
    });
    const generate = await app.request("/api/v1/applications", {
      method: "POST",
      headers: {
        Authorization: token,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jobId: JOB_ID }),
    });
    expect(generate.status).toBe(201);
    expect(steps).toContain("generate");

    // Contract FAILURE if approve gate step is missing
    mockApps.approveApplication.mockImplementation(async () => {
      steps.push("approve");
      steps.push("submit");
      return {
        application: {
          id: APP_ID,
          status: "approved",
          approvedAt: new Date().toISOString(),
        },
        status: "approved",
      };
    });
    const approve = await app.request(`/api/v1/applications/${APP_ID}/approve`, {
      method: "POST",
      headers: { Authorization: token },
    });
    expect(approve.status).toBe(200);
    expect(mockApps.approveApplication).toHaveBeenCalledWith(USER_ID, APP_ID);
    expect(steps).toEqual([
      "register",
      "onboard",
      "source",
      "match",
      "generate",
      "approve",
      "submit",
    ]);
  });

  it("HG-4: enqueueSubmitApplication rejects missing approved_at", async () => {
    await expect(
      enqueueSubmitApplication({
        application_id: JOB_ID,
        user_id: USER_ID,
        approved_at: "",
      }),
    ).rejects.toThrow(/approved_at/);
  });
});
