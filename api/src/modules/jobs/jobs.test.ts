import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { jobsRoutes } from "./jobs.routes.js";

vi.mock("./jobs.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./jobs.service.js")>();
  return {
    ...actual,
    listJobs: vi.fn(),
    getJob: vi.fn(),
    getJobStats: vi.fn(),
    importJob: vi.fn(),
    listSimilarJobs: vi.fn(),
    saveJob: vi.fn(),
    unsaveJob: vi.fn(),
    JobError: actual.JobError,
  };
});

import * as jobsService from "./jobs.service.js";
const mockService = vi.mocked(jobsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/jobs", jobsRoutes);
  return app;
};

const authHeader = (userId = "user-a") => testAuthHeader(userId);

const sampleJob = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  title: "Senior Python Engineer",
  company: "Acme",
  location: "Remote",
  isRemote: true,
  remoteType: "fully_remote",
  employmentType: "full-time",
  experienceLevel: "senior",
  salaryMin: 14000000,
  salaryMax: 16000000,
  salaryCurrency: "USD",
  salaryPeriod: "yearly",
  description: "Build APIs",
  requirements: null,
  applicationUrl: "https://example.com/j/1",
  source: "rss",
  sourceUrl: "https://example.com/j/1",
  tags: ["python"],
  status: "scored",
  isDuplicate: false,
  collectedAt: new Date(),
  postedAt: null,
  isSaved: false,
  score: {
    overall: 92,
    skillMatch: 95,
    experienceMatch: 88,
    locationMatch: 95,
    salaryMatch: 90,
    cultureMatch: 85,
    reasoning: "Strong Python and FastAPI overlap with remote preference.",
    matchedSkills: [{ skill: "python", match: 1 }],
    missingSkills: [],
    weights: { skills: 0.4 },
    scoredAt: new Date(),
  },
};

describe("GET /api/v1/jobs", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/jobs");
    expect(res.status).toBe(401);
  });

  it("200 lists only caller's jobs via userId", async () => {
    mockService.listJobs.mockResolvedValue({ jobs: [sampleJob], total: 1 });
    const res = await buildApp().request("/api/v1/jobs?sort=score", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.listJobs).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ sort: "score" }),
    );
    const body = (await res.json()) as {
      jobs: Array<{ score: { overall: number } }>;
    };
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0]?.score.overall).toBe(92);
  });
});

describe("GET /api/v1/jobs/:id", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 when not owned", async () => {
    mockService.getJob.mockRejectedValue(
      new jobsService.JobError("Job not found", 404),
    );
    const res = await buildApp().request(`/api/v1/jobs/${sampleJob.id}`, {
      headers: { Authorization: await authHeader("user-b") },
    });
    expect(res.status).toBe(404);
    expect(mockService.getJob).toHaveBeenCalledWith("user-b", sampleJob.id);
  });

  it("200 returns owned job with reasoning", async () => {
    mockService.getJob.mockResolvedValue({ job: sampleJob });
    const res = await buildApp().request(`/api/v1/jobs/${sampleJob.id}`, {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      job: { score: { reasoning: string } };
    };
    expect(body.job.score.reasoning.length).toBeGreaterThan(10);
  });
});

describe("POST /api/v1/jobs/import", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/jobs/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/jobs/1" }),
    });
    expect(res.status).toBe(401);
  });

  it("201 imports URL for authenticated user only", async () => {
    mockService.importJob.mockResolvedValue({
      job: { ...sampleJob, source: "manual", isSaved: false },
      taskId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      deduped: false,
    });
    const res = await buildApp().request("/api/v1/jobs/import", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com/jobs/1" }),
    });
    expect(res.status).toBe(201);
    expect(mockService.importJob).toHaveBeenCalledWith(
      "user-a",
      expect.objectContaining({ url: "https://example.com/jobs/1" }),
    );
  });

  it("400 when SSRF guard rejects private URL", async () => {
    mockService.importJob.mockRejectedValue(
      new Error("Private or reserved IP not allowed"),
    );
    const res = await buildApp().request("/api/v1/jobs/import", {
      method: "POST",
      headers: {
        Authorization: await authHeader("user-a"),
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "http://127.0.0.1/secret" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/jobs/:id/similar (IDOR)", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 when seed job not owned — never leaks other users' jobs", async () => {
    mockService.listSimilarJobs.mockRejectedValue(
      new jobsService.JobError("Job not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}/similar`,
      { headers: { Authorization: await authHeader("user-b") } },
    );
    expect(res.status).toBe(404);
    expect(mockService.listSimilarJobs).toHaveBeenCalledWith(
      "user-b",
      sampleJob.id,
      10,
    );
  });

  it("200 returns similar jobs scoped to caller", async () => {
    mockService.listSimilarJobs.mockResolvedValue({
      jobs: [{ ...sampleJob, id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33" }],
    });
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}/similar?limit=5`,
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    expect(mockService.listSimilarJobs).toHaveBeenCalledWith(
      "user-a",
      sampleJob.id,
      5,
    );
  });
});

describe("POST|DELETE /api/v1/jobs/:id/save (IDOR)", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 save when job not owned", async () => {
    mockService.saveJob.mockRejectedValue(
      new jobsService.JobError("Job not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}/save`,
      {
        method: "POST",
        headers: { Authorization: await authHeader("user-b") },
      },
    );
    expect(res.status).toBe(404);
    expect(mockService.saveJob).toHaveBeenCalledWith("user-b", sampleJob.id);
  });

  it("200 save owned job", async () => {
    mockService.saveJob.mockResolvedValue({ success: true });
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}/save`,
      {
        method: "POST",
        headers: { Authorization: await authHeader("user-a") },
      },
    );
    expect(res.status).toBe(200);
  });

  it("404 unsave when job not owned", async () => {
    mockService.unsaveJob.mockRejectedValue(
      new jobsService.JobError("Job not found", 404),
    );
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}/save`,
      {
        method: "DELETE",
        headers: { Authorization: await authHeader("user-b") },
      },
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/jobs/stats", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/jobs/stats");
    expect(res.status).toBe(401);
  });

  it("200 returns caller-scoped stats", async () => {
    mockService.getJobStats.mockResolvedValue({
      total: 10,
      remote: 4,
      scored: 7,
      saved: 2,
      bySource: [{ source: "rss", count: 8 }],
      byStatus: [{ status: "scored", count: 7 }],
    });
    const res = await buildApp().request("/api/v1/jobs/stats", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.getJobStats).toHaveBeenCalledWith("user-a");
  });
});
