import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "../../lib/jwt.js";
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

const authHeader = async (userId = "user-a", email = "a@example.com") => {
  const token = await signAccessToken({ sub: userId, email });
  return `Bearer ${token}`;
};

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
      taskId: null,
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
