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
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}`,
      { headers: { Authorization: await authHeader("user-b") } },
    );
    expect(res.status).toBe(404);
    expect(mockService.getJob).toHaveBeenCalledWith("user-b", sampleJob.id);
  });

  it("200 returns owned job with reasoning", async () => {
    mockService.getJob.mockResolvedValue({ job: sampleJob });
    const res = await buildApp().request(
      `/api/v1/jobs/${sampleJob.id}`,
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      job: { score: { reasoning: string } };
    };
    expect(body.job.score.reasoning.length).toBeGreaterThan(10);
  });
});
