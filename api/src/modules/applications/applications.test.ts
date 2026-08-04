import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../../lib/jwt.js";
import { applicationsRoutes } from "./applications.routes.js";

vi.mock("./applications.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./applications.service.js")>();
  return {
    ...actual,
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    createApplication: vi.fn(),
    regenerateDocuments: vi.fn(),
    markDocumentsReviewed: vi.fn(),
    approveApplication: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
    ApplicationError: actual.ApplicationError,
  };
});

import * as applicationsService from "./applications.service.js";
const mockService = vi.mocked(applicationsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/applications", applicationsRoutes);
  return app;
};

const authHeader = async (userId = "user-a") => {
  const token = await signAccessToken({ sub: userId, email: "a@example.com" });
  return `Bearer ${token}`;
};

const sampleApp = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  jobId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  status: "draft",
  cvVersion: 1,
  tailoredCvContent: "# CV\n- Built APIs with FastAPI",
  coverLetterContent: "Dear team,\n\nI built APIs with FastAPI.\n\nSincerely",
  tailoredCvUrl: null,
  coverLetterUrl: null,
  bulletTraces: [
    {
      text: "Built APIs with FastAPI",
      chunkId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
      section: "experience",
    },
  ],
  documentsReviewedAt: null,
  approvedAt: null,
  generationModel: "heuristic-docs-v1",
  createdAt: new Date(),
  updatedAt: new Date(),
  canApply: false,
  canApprove: false,
};

describe("POST /api/v1/applications", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: sampleApp.jobId }),
    });
    expect(res.status).toBe(401);
  });

  it("201 creates draft and starts generation", async () => {
    mockService.createApplication.mockResolvedValue({
      application: sampleApp,
      status: "generating",
    });
    const res = await buildApp().request("/api/v1/applications", {
      method: "POST",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ jobId: sampleApp.jobId }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      application: { status: string; canApply: boolean };
    };
    expect(body.application.status).toBe("draft");
    expect(body.application.canApply).toBe(false);
  });
});

describe("POST /api/v1/applications/:id/review", () => {
  afterEach(() => vi.clearAllMocks());

  it("sets canApply after review", async () => {
    mockService.markDocumentsReviewed.mockResolvedValue({
      application: {
        ...sampleApp,
        documentsReviewedAt: new Date(),
        canApply: true,
      },
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/review`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { application: { canApply: boolean } };
    expect(body.application.canApply).toBe(true);
  });

  it("404 for other user", async () => {
    mockService.markDocumentsReviewed.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/review`,
      {
        method: "POST",
        headers: { Authorization: await authHeader("user-b") },
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/applications/:id/approve", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/approve`,
      { method: "POST" },
    );
    expect(res.status).toBe(401);
    expect(mockService.approveApplication).not.toHaveBeenCalled();
  });

  it("200 approves and returns approved status (HG-4 gate)", async () => {
    const approvedAt = new Date("2026-08-05T12:00:00.000Z");
    mockService.approveApplication.mockResolvedValue({
      application: {
        ...sampleApp,
        status: "approved",
        documentsReviewedAt: new Date(),
        approvedAt,
        canApply: false,
        canApprove: false,
      },
      status: "approved",
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/approve`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(200);
    expect(mockService.approveApplication).toHaveBeenCalledWith(
      "user-a",
      sampleApp.id,
    );
    const body = (await res.json()) as {
      status: string;
      application: { status: string; approvedAt: string };
    };
    expect(body.status).toBe("approved");
    expect(body.application.status).toBe("approved");
  });

  it("400 when documents not reviewed", async () => {
    mockService.approveApplication.mockRejectedValue(
      new applicationsService.ApplicationError(
        "Documents must be reviewed before approval",
        400,
      ),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/approve`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(400);
  });

  it("409 when already approved", async () => {
    mockService.approveApplication.mockRejectedValue(
      new applicationsService.ApplicationError(
        "Cannot approve application in status 'approved'",
        409,
      ),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/approve`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(409);
  });

  it("404 IDOR — other user cannot approve", async () => {
    mockService.approveApplication.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/approve`,
      {
        method: "POST",
        headers: { Authorization: await authHeader("user-b") },
      },
    );
    expect(res.status).toBe(404);
  });
});
