import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { applicationsRoutes } from "./applications.routes.js";

vi.mock("./applications.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./applications.service.js")>();
  return {
    ...actual,
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    createApplication: vi.fn(),
    bulkGenerateDocuments: vi.fn(),
    regenerateDocuments: vi.fn(),
    setApplicationTemplate: vi.fn(),
    updateBulletTraces: vi.fn(),
    regenerateSection: vi.fn(),
    markDocumentsReviewed: vi.fn(),
    approveApplication: vi.fn(),
    updateApplicationStage: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
    addInterview: vi.fn(),
    patchInterview: vi.fn(),
    patchApplicationMeta: vi.fn(),
    bulkAction: vi.fn(),
    requestInterviewPrep: vi.fn(),
    getInterviewPrep: vi.fn(),
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

const authHeader = (userId = "user-a") => testAuthHeader(userId);

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
      status: "pending" as const,
    },
  ],
  documentsReviewedAt: null,
  approvedAt: null,
  submittedAt: null,
  submittedVia: null,
  submitError: null,
  pipelineStage: null,
  generationModel: "heuristic-docs-v1",
  generationError: null,
  documentsStatus: "ready" as const,
  generationDurationMs: null,
  cvTemplate: "modern",
  clTemplate: "modern",
  userNotes: null,
  interviewStages: [],
  nextFollowupAt: null,
  followupCount: 0,
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

describe("POST /api/v1/applications/bulk-generate (HG-4)", () => {
  afterEach(() => vi.clearAllMocks());

  it("202 queues drafts only — never reports submit", async () => {
    mockService.bulkGenerateDocuments.mockResolvedValue({
      queued: [{ applicationId: sampleApp.id, jobId: sampleApp.jobId }],
      count: 1,
      status: "generating",
      submitEnqueued: false,
    });
    const res = await buildApp().request("/api/v1/applications/bulk-generate", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ limit: 5, minScore: 70 }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as {
      submitEnqueued: boolean;
      count: number;
    };
    expect(body.submitEnqueued).toBe(false);
    expect(body.count).toBe(1);
    expect(mockService.bulkGenerateDocuments).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ limit: 5, minScore: 70 }),
    );
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

describe("PATCH /api/v1/applications/:id/stage", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 moves to screening", async () => {
    mockService.updateApplicationStage.mockResolvedValue({
      application: {
        ...sampleApp,
        status: "screening",
        pipelineStage: "screening",
        canApply: false,
        canApprove: false,
      },
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/stage`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "screening" }),
      },
    );
    expect(res.status).toBe(200);
    expect(mockService.updateApplicationStage).toHaveBeenCalledWith(
      "user-a",
      sampleApp.id,
      { stage: "screening" },
    );
  });

  it("400 rejects unknown stage", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/stage`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ stage: "nope" }),
      },
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/applications/:id/template", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 when application not owned", async () => {
    mockService.setApplicationTemplate.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/template`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader("user-b"),
          "content-type": "application/json",
        },
        body: JSON.stringify({ cvTemplate: "classic" }),
      },
    );
    expect(res.status).toBe(404);
    expect(mockService.setApplicationTemplate).toHaveBeenCalledWith(
      "user-b",
      sampleApp.id,
      { cvTemplate: "classic" },
    );
  });

  it("202 switches template and regenerates", async () => {
    mockService.setApplicationTemplate.mockResolvedValue({
      application: {
        ...sampleApp,
        cvTemplate: "minimal",
        clTemplate: "minimal",
        tailoredCvContent: null,
        coverLetterContent: null,
      },
      status: "generating",
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/template`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader("user-a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({ cvTemplate: "minimal", clTemplate: "minimal" }),
      },
    );
    expect(res.status).toBe(202);
  });

  it("400 rejects unknown template", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/template`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader(),
          "content-type": "application/json",
        },
        body: JSON.stringify({ cvTemplate: "fancy" }),
      },
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/applications/:id/bullets", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 when not owned", async () => {
    mockService.updateBulletTraces.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/bullets`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader("user-b"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          traces: [
            {
              text: "Built APIs with FastAPI",
              chunkId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
              section: "experience",
              status: "accepted",
            },
          ],
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("200 updates bullet statuses", async () => {
    mockService.updateBulletTraces.mockResolvedValue({
      application: {
        ...sampleApp,
        bulletTraces: [
          {
            text: "Built APIs with FastAPI",
            chunkId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
            section: "experience",
            status: "accepted",
          },
        ],
      },
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/bullets`,
      {
        method: "PATCH",
        headers: {
          Authorization: await authHeader("user-a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          traces: [
            {
              text: "Built APIs with FastAPI",
              chunkId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
              section: "experience",
              status: "accepted",
            },
          ],
        }),
      },
    );
    expect(res.status).toBe(200);
  });
});

describe("normalizeBulletTraces (HG-9)", () => {
  it("drops untraced bullets and normalizes chunk_id", () => {
    const traces = applicationsService.normalizeBulletTraces([
      { text: "Built APIs with FastAPI", chunk_id: "c1", section: "experience" },
      { text: "hallucinated without chunk", section: "experience" },
    ]);
    expect(traces).toHaveLength(1);
    expect(traces[0]?.chunkId).toBe("c1");
    expect(traces[0]?.status).toBe("pending");
  });
});

describe("GET /api/v1/applications/:id/download/:kind", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/download/cv`,
    );
    expect(res.status).toBe(401);
  });

  it("200 returns signed PDF URL for owner", async () => {
    mockService.getDocumentDownloadUrl.mockResolvedValue({
      url: "https://minio.example/cv.pdf?X-Amz-Signature=abc",
      contentType: "application/pdf",
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/download/cv`,
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; contentType: string };
    expect(body.contentType).toBe("application/pdf");
    expect(mockService.getDocumentDownloadUrl).toHaveBeenCalledWith(
      "user-a",
      sampleApp.id,
      "cv",
    );
  });

  it("200 returns ZIP pack URL", async () => {
    mockService.getDocumentDownloadUrl.mockResolvedValue({
      url: "https://minio.example/pack.zip?X-Amz-Signature=abc",
      contentType: "application/zip",
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/download/zip`,
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    expect(mockService.getDocumentDownloadUrl).toHaveBeenCalledWith(
      "user-a",
      sampleApp.id,
      "zip",
    );
  });

  it("404 IDOR — other user cannot download", async () => {
    mockService.getDocumentDownloadUrl.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/download/zip`,
      { headers: { Authorization: await authHeader("user-b") } },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/applications/:id/interviews", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/interviews`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage: "phone_screen",
          scheduledAt: "2026-08-20T14:00:00.000Z",
        }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("201 creates interview event", async () => {
    mockService.addInterview.mockResolvedValue({
      application: { ...sampleApp, status: "interviewing" },
      interviewEvent: {
        id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        stage: "phone_screen",
        scheduledAt: "2026-08-20T14:00:00.000Z",
        status: "scheduled",
        interviewers: [],
      },
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/interviews`,
      {
        method: "POST",
        headers: {
          Authorization: await authHeader("user-a"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stage: "phone_screen",
          scheduledAt: "2026-08-20T14:00:00.000Z",
        }),
      },
    );
    expect(res.status).toBe(201);
    expect(mockService.addInterview).toHaveBeenCalledWith(
      "user-a",
      sampleApp.id,
      expect.objectContaining({ stage: "phone_screen" }),
    );
  });

  it("404 IDOR — other user cannot add interview", async () => {
    mockService.addInterview.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/interviews`,
      {
        method: "POST",
        headers: {
          Authorization: await authHeader("user-b"),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stage: "phone_screen",
          scheduledAt: "2026-08-20T14:00:00.000Z",
        }),
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/applications/bulk-action", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 archives owned applications without enqueueing submit", async () => {
    mockService.bulkAction.mockResolvedValue({
      updated: 2,
      action: "archive",
      submitEnqueued: false,
    });
    const res = await buildApp().request("/api/v1/applications/bulk-action", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        applicationIds: [sampleApp.id, "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"],
        action: "archive",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { submitEnqueued: boolean };
    expect(body.submitEnqueued).toBe(false);
  });

  it("404 IDOR — cannot withdraw another user's application", async () => {
    mockService.bulkAction.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request("/api/v1/applications/bulk-action", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-b"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        applicationIds: [sampleApp.id],
        action: "withdraw",
      }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/applications/:id/prep", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/prep`,
      { method: "POST" },
    );
    expect(res.status).toBe(401);
  });

  it("202 queues interview prep", async () => {
    mockService.requestInterviewPrep.mockResolvedValue({
      status: "generating",
      applicationId: sampleApp.id,
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/prep`,
      { method: "POST", headers: { Authorization: await authHeader() } },
    );
    expect(res.status).toBe(202);
  });

  it("404 IDOR — other user cannot generate prep", async () => {
    mockService.requestInterviewPrep.mockRejectedValue(
      new applicationsService.ApplicationError("Application not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/prep`,
      {
        method: "POST",
        headers: { Authorization: await authHeader("user-b") },
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/applications/:id/prep", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 returns idle when none", async () => {
    mockService.getInterviewPrep.mockResolvedValue({
      prep: null,
      status: "idle",
    });
    const res = await buildApp().request(
      `/api/v1/applications/${sampleApp.id}/prep`,
      { headers: { Authorization: await authHeader() } },
    );
    expect(res.status).toBe(200);
  });
});
