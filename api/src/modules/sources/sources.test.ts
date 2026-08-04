import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { sourcesRoutes } from "./sources.routes.js";
import { createSourceBodySchema } from "./sources.schema.js";
import {
  isPrivateOrReservedIp,
  assertPublicHttpUrl,
} from "../../lib/safe-url.js";
import {
  mergePreservedSecrets,
  redactConfig as redactFromService,
} from "./sources.service.js";

vi.mock("./sources.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sources.service.js")>();
  return {
    ...actual,
    listSources: vi.fn(),
    getSource: vi.fn(),
    createSource: vi.fn(),
    patchSource: vi.fn(),
    deleteSource: vi.fn(),
    testSource: vi.fn(),
    runSource: vi.fn(),
    SourceError: actual.SourceError,
  };
});

import * as sourcesService from "./sources.service.js";
const mockService = vi.mocked(sourcesService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/sources", sourcesRoutes);
  return app;
};

const authHeader = (
  userId = "user-a",
  role: "owner" | "member" | "viewer" = "owner",
) => testAuthHeader(userId, role);

const sampleSource = {
  id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  userId: "user-a",
  workspaceId: "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  sourceType: "rss",
  name: "HN Jobs",
  description: null,
  config: { feedUrl: "https://example.com/feed.xml" },
  scheduleCron: null,
  timezone: "UTC",
  isActive: true,
  rateLimitPerMinute: 30,
  rateLimitPerHour: 500,
  concurrentLimit: 3,
  keywordFilters: [],
  locationFilters: [],
  companyFilters: [],
  salaryMin: null,
  experienceLevels: [],
  lastRunAt: null,
  lastRunStatus: null,
  lastRunJobsFound: null,
  lastRunDurationMs: null,
  lastError: null,
  consecutiveFailures: 0,
  totalJobsCollected: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/v1/sources", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/sources");
    expect(res.status).toBe(401);
  });

  it("200 lists own sources only", async () => {
    mockService.listSources.mockResolvedValue({
      sources: [sampleSource],
    });
    const res = await buildApp().request("/api/v1/sources", {
      headers: { Authorization: await authHeader("user-a") },
    });
    expect(res.status).toBe(200);
    expect(mockService.listSources).toHaveBeenCalledWith(
      "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
  });

  it("403 viewer cannot list sources", async () => {
    const res = await buildApp().request("/api/v1/sources", {
      headers: { Authorization: await authHeader("user-a", "viewer") },
    });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/sources", () => {
  afterEach(() => vi.clearAllMocks());

  it("201 creates rss source", async () => {
    mockService.createSource.mockResolvedValue({ sourceConfig: sampleSource });
    const res = await buildApp().request("/api/v1/sources", {
      method: "POST",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceType: "rss",
        name: "HN Jobs",
        config: { feedUrl: "https://example.com/feed.xml" },
      }),
    });
    expect(res.status).toBe(201);
  });

  it("400 rejects invalid source type", async () => {
    const res = await buildApp().request("/api/v1/sources", {
      method: "POST",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceType: "telegram",
        name: "x",
        config: {},
      }),
    });
    expect(res.status).toBe(400);
  });

  it("400 rejects rss without feedUrl", async () => {
    const res = await buildApp().request("/api/v1/sources", {
      method: "POST",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sourceType: "rss",
        name: "Broken",
        config: { keywords: ["go"] },
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe("ownership / IDOR", () => {
  afterEach(() => vi.clearAllMocks());

  it("404 when service says not found for foreign id", async () => {
    mockService.getSource.mockRejectedValue(
      new sourcesService.SourceError("Source not found", 404),
    );
    const res = await buildApp().request(
      "/api/v1/sources/b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      { headers: { Authorization: await authHeader("user-a") } },
    );
    expect(res.status).toBe(404);
    expect(mockService.getSource).toHaveBeenCalledWith(
      "w0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    );
  });
});

describe("POST /:id/test and /run", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 test endpoint", async () => {
    mockService.testSource.mockResolvedValue({
      success: true,
      sampleJobs: [{ title: "Eng", company: "Acme" }],
      errors: [],
    });
    const res = await buildApp().request(
      `/api/v1/sources/${sampleSource.id}/test`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(200);
  });

  it("202 run endpoint", async () => {
    mockService.runSource.mockResolvedValue({
      pipelineRunId: "33333333-3333-3333-3333-333333333333",
      status: "queued",
    });
    const res = await buildApp().request(
      `/api/v1/sources/${sampleSource.id}/run`,
      {
        method: "POST",
        headers: { Authorization: await authHeader() },
      },
    );
    expect(res.status).toBe(202);
  });
});

describe("redactConfig", () => {
  it("hides imap password", () => {
    const out = redactFromService("imap", {
      imapServer: "mail.example.com",
      password: "secret",
      username: "u",
      port: 993,
    });
    expect(out.password).toBe("***");
    expect(out.username).toBe("u");
  });
});

describe("mergePreservedSecrets", () => {
  it("keeps stored IMAP password when PATCH sends ***", () => {
    const merged = mergePreservedSecrets(
      "imap",
      {
        imapServer: "mail.example.com",
        username: "u",
        password: "***",
        port: 993,
        folder: "INBOX",
      },
      {
        imapServer: "mail.example.com",
        username: "u",
        password: "real-secret",
        port: 993,
        folder: "INBOX",
      },
    );
    expect(merged.password).toBe("real-secret");
  });

  it("keeps API credentials when PATCH sends ***", () => {
    const merged = mergePreservedSecrets(
      "api",
      {
        baseUrl: "https://api.example.com",
        auth: { type: "bearer", credentials: { token: "***" } },
      },
      {
        baseUrl: "https://api.example.com",
        auth: { type: "bearer", credentials: { token: "live-token" } },
      },
    );
    const auth = merged.auth as { credentials: { token: string } };
    expect(auth.credentials.token).toBe("live-token");
  });
});

describe("assertPublicHttpUrl", () => {
  it("blocks private IP literals", async () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    await expect(assertPublicHttpUrl("http://127.0.0.1/")).rejects.toThrow(
      /Private|not allowed/,
    );
    await expect(
      assertPublicHttpUrl("http://169.254.169.254/latest/meta-data"),
    ).rejects.toThrow();
  });

  it("allows public https URL host parsing", async () => {
    // example.com resolves publicly in most environments
    const url = await assertPublicHttpUrl("https://example.com/feed.xml");
    expect(url.hostname).toBe("example.com");
  });
});

describe("createSourceBodySchema", () => {
  it("accepts valid imap config", () => {
    const r = createSourceBodySchema.safeParse({
      sourceType: "imap",
      name: "Indeed alerts",
      config: {
        imapServer: "imap.gmail.com",
        port: 993,
        username: "a@b.com",
        password: "app-pass",
        folder: "INBOX",
      },
    });
    expect(r.success).toBe(true);
  });

  it("applies IMAP defaults for omitted port/folder", () => {
    const r = createSourceBodySchema.safeParse({
      sourceType: "imap",
      name: "Alerts",
      config: {
        imapServer: "imap.gmail.com",
        username: "a@b.com",
        password: "app-pass",
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.config).toMatchObject({
        port: 993,
        folder: "INBOX",
      });
    }
  });
});
