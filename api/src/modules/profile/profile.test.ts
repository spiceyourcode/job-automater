import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { profileRoutes } from "./profile.routes.js";
import {
  ALLOWED_CV_MIME_TYPES,
  MAX_CV_BYTES,
  patchProfileBodySchema,
  resolveCvMimeType,
} from "./profile.schema.js";

vi.mock("./profile.service.js", () => ({
  getProfile: vi.fn(),
  patchProfile: vi.fn(),
  uploadCv: vi.fn(),
  listCvVersions: vi.fn(),
  getCvDocumentForUser: vi.fn(),
  activateCvVersion: vi.fn(),
  deleteCvVersion: vi.fn(),
  reindexCv: vi.fn(),
  listCvChunks: vi.fn(),
  diffCvVersions: vi.fn(),
  exportUserData: vi.fn(),
  deleteUserAccount: vi.fn(),
  ProfileError: class ProfileError extends Error {
    constructor(
      message: string,
      readonly statusCode: 400 | 403 | 404 | 413,
    ) {
      super(message);
      this.name = "ProfileError";
    }
  },
}));

import * as profileService from "./profile.service.js";
const mockService = vi.mocked(profileService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/profile", profileRoutes);
  return app;
};

const authHeader = (userId = "user-a") => testAuthHeader(userId);

const sampleProfile = {
  id: "prof-1",
  userId: "user-a",
  headline: "Engineer",
  summary: null,
  yearsExperience: 5,
  currentRole: null,
  currentCompany: null,
  technicalSkills: [],
  softSkills: [],
  certifications: [],
  preferredRoles: [],
  preferredLocations: [],
  salaryMin: 10000000,
  salaryMax: 15000000,
  salaryCurrency: "USD",
  employmentTypes: ["full-time"],
  visaStatus: null,
  noticePeriodWeeks: null,
  willingToRelocate: false,
  cvFileId: null,
  cvVersion: 1,
  cvLastIndexedAt: null,
  autoApplyEnabled: false,
  maxApplicationsPerDay: 10,
  minMatchScore: 70,
  preferredCvTemplate: "modern",
  preferredClTemplate: "standard",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/v1/profile", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/profile");
    expect(res.status).toBe(401);
  });

  it("200 returns own profile only", async () => {
    mockService.getProfile.mockResolvedValue(sampleProfile);
    const res = await buildApp().request("/api/v1/profile", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.getProfile).toHaveBeenCalledWith("user-a");
    const body = (await res.json()) as { profile: { userId: string } };
    expect(body.profile.userId).toBe("user-a");
  });

  it("never passes a foreign userId from query (IDOR)", async () => {
    mockService.getProfile.mockResolvedValue(sampleProfile);
    await buildApp().request("/api/v1/profile?userId=user-b", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(mockService.getProfile).toHaveBeenCalledWith("user-a");
    expect(mockService.getProfile).not.toHaveBeenCalledWith("user-b");
  });
});

describe("PATCH /api/v1/profile", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ headline: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("400 on float salary (HG-3)", async () => {
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ salaryMin: 10.5 }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when salaryMin > salaryMax", async () => {
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ salaryMin: 200, salaryMax: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it("400 when salaryMin equals salaryMax", async () => {
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ salaryMin: 100, salaryMax: 100 }),
    });
    expect(res.status).toBe(400);
  });

  it("400 rejects unknown fields (strict)", async () => {
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "attacker", headline: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("200 updates own profile", async () => {
    mockService.patchProfile.mockResolvedValue({
      ...sampleProfile,
      headline: "Senior Engineer",
    });
    const res = await buildApp().request("/api/v1/profile", {
      method: "PATCH",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ headline: "Senior Engineer", salaryMin: 12000000 }),
    });
    expect(res.status).toBe(200);
    expect(mockService.patchProfile).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ headline: "Senior Engineer", salaryMin: 12000000 }),
    );
  });
});

describe("POST /api/v1/profile/cv", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "cv.pdf", {
      type: "application/pdf",
    }));
    const res = await buildApp().request("/api/v1/profile/cv", {
      method: "POST",
      body: form,
    });
    expect(res.status).toBe(401);
  });

  it("400 when file field missing", async () => {
    const form = new FormData();
    const res = await buildApp().request("/api/v1/profile/cv", {
      method: "POST",
      headers: { Authorization: await authHeader() },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it("201 returns file URL on successful upload", async () => {
    mockService.uploadCv.mockResolvedValue({
      cvDocument: {
        id: "cv-1",
        version: 1,
        originalFilename: "cv.pdf",
        fileUrl: "http://localhost:9000/jobautomater/cvs/user-a/v1/cv.pdf",
        fileSize: 3,
        mimeType: "application/pdf",
        isActive: true,
        createdAt: new Date(),
      },
      taskId: "11111111-1111-4111-8111-111111111111",
    });

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "cv.pdf", { type: "application/pdf" }),
    );
    const res = await buildApp().request("/api/v1/profile/cv", {
      method: "POST",
      headers: { Authorization: await authHeader("user-a") },
      body: form,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      cvDocument: { fileUrl: string };
    };
    expect(body.cvDocument.fileUrl).toContain("cvs/user-a");
    expect(mockService.uploadCv).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ filename: "cv.pdf", mimeType: "application/pdf" }),
    );
  });

  it("413 when service rejects oversized file", async () => {
    mockService.uploadCv.mockRejectedValue(
      new profileService.ProfileError("File exceeds 10MB limit", 413),
    );
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1])], "big.pdf", { type: "application/pdf" }),
    );
    const res = await buildApp().request("/api/v1/profile/cv", {
      method: "POST",
      headers: { Authorization: await authHeader() },
      body: form,
    });
    expect(res.status).toBe(413);
  });
});

describe("GET /api/v1/profile/cv/versions", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/profile/cv/versions");
    expect(res.status).toBe(401);
  });

  it("200 lists only caller versions", async () => {
    mockService.listCvVersions.mockResolvedValue({
      versions: [
        {
          id: "cv-1",
          version: 1,
          filename: "cv.pdf",
          isActive: true,
          createdAt: new Date(),
          chunkCount: 0,
          fileUrl: "http://x/y",
          fileSize: 10,
        },
      ],
    });
    const res = await buildApp().request("/api/v1/profile/cv/versions", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.listCvVersions).toHaveBeenCalledWith("user-a");
  });
});

describe("POST /api/v1/profile/cv/:version/activate", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 activates owned version", async () => {
    mockService.activateCvVersion.mockResolvedValue({
      cvDocument: {
        id: "cv-1",
        version: 2,
        originalFilename: "cv.pdf",
        fileUrl: "http://x",
        fileSize: 10,
        mimeType: "application/pdf",
        isActive: true,
        chunkCount: 0,
        createdAt: new Date(),
      },
    });
    const res = await buildApp().request("/api/v1/profile/cv/2/activate", {
      method: "POST",
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.activateCvVersion).toHaveBeenCalledWith("user-a", 2);
  });

  it("404 when version not owned", async () => {
    mockService.activateCvVersion.mockRejectedValue(
      new profileService.ProfileError("CV not found", 404),
    );
    const res = await buildApp().request("/api/v1/profile/cv/99/activate", {
      method: "POST",
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/profile/cv/:version", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 deletes owned version", async () => {
    mockService.deleteCvVersion.mockResolvedValue({ success: true });
    const res = await buildApp().request("/api/v1/profile/cv/1", {
      method: "DELETE",
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.deleteCvVersion).toHaveBeenCalledWith("user-a", 1);
  });
});

describe("POST /api/v1/profile/cv/reindex", () => {
  afterEach(() => vi.clearAllMocks());

  it("202 enqueues async reindex", async () => {
    mockService.reindexCv.mockResolvedValue({
      taskId: "11111111-1111-4111-8111-111111111111",
    });
    const res = await buildApp().request("/api/v1/profile/cv/reindex", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { taskId: string };
    expect(body.taskId).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("GET /api/v1/profile/cv/:version/chunks", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 lists chunks for owned version", async () => {
    mockService.listCvChunks.mockResolvedValue({
      chunks: [{ index: 0, content: "x", sectionType: "body", tokenCount: 1 }],
    });
    const res = await buildApp().request("/api/v1/profile/cv/1/chunks", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.listCvChunks).toHaveBeenCalledWith("user-a", 1, {
      limit: 50,
      offset: 0,
    });
  });
});

describe("GET /api/v1/profile/cv/:version/diff", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 diffs against another version", async () => {
    mockService.diffCvVersions.mockResolvedValue({
      fromVersion: 1,
      toVersion: 2,
      changes: [],
    });
    const res = await buildApp().request(
      "/api/v1/profile/cv/2/diff?against=1",
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    expect(mockService.diffCvVersions).toHaveBeenCalledWith("user-a", 2, 1);
  });
});

describe("GET /api/v1/profile/export (GDPR)", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/profile/export");
    expect(res.status).toBe(401);
  });

  it("200 exports caller data only (IDOR)", async () => {
    mockService.exportUserData.mockResolvedValue({
      exportedAt: "2026-08-05T00:00:00.000Z",
      user: {
        id: "user-a",
        email: "a@example.com",
        name: "A",
        timezone: "UTC",
        locale: "en",
        createdAt: new Date("2026-01-01"),
      },
      profile: null,
      cvDocuments: [],
      applications: [],
      notifications: [],
    });
    const res = await buildApp().request("/api/v1/profile/export?userId=user-b", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.exportUserData).toHaveBeenCalledWith("user-a");
    expect(mockService.exportUserData).not.toHaveBeenCalledWith("user-b");
  });
});

describe("DELETE /api/v1/profile (GDPR)", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/profile", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("200 erases caller account only", async () => {
    mockService.deleteUserAccount.mockResolvedValue({
      deleted: true,
      userId: "user-a",
    });
    const res = await buildApp().request("/api/v1/profile", {
      method: "DELETE",
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.deleteUserAccount).toHaveBeenCalledWith("user-a");
    const body = (await res.json()) as { deleted: boolean };
    expect(body.deleted).toBe(true);
  });
});

describe("schema constants", () => {
  it("MAX_CV_BYTES is 10MB", () => {
    expect(MAX_CV_BYTES).toBe(10 * 1024 * 1024);
  });

  it("allows PDF and DOCX mime types", () => {
    expect(ALLOWED_CV_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(
      ALLOWED_CV_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(true);
  });

  it("patch schema rejects float salary", () => {
    const r = patchProfileBodySchema.safeParse({ salaryMin: 99.9 });
    expect(r.success).toBe(false);
  });

  it("resolves MIME from extension when empty or octet-stream", () => {
    expect(resolveCvMimeType("", "cv.pdf")).toBe("application/pdf");
    expect(resolveCvMimeType("application/octet-stream", "resume.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(resolveCvMimeType("text/plain", "cv.pdf")).toBeNull();
  });
});
