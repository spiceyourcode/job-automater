import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { emailsRoutes, gmailAuthRoutes, gmailPushRoutes } from "./emails.routes.js";

vi.mock("./emails.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./emails.service.js")>();
  return {
    ...actual,
    syncEmails: vi.fn(),
    listEmails: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    getGmailStatus: vi.fn(),
    startGmailOAuth: vi.fn(),
    completeGmailOAuth: vi.fn(),
    syncGmailHistory: vi.fn(),
    handleGmailPush: vi.fn(),
    disconnectGmail: vi.fn(),
    EmailsError: actual.EmailsError,
  };
});

import * as emailsService from "./emails.service.js";
const mockService = vi.mocked(emailsService, true);

const buildApp = () => {
  const app = new Hono();
  const emailsRoot = new Hono();
  emailsRoot.route("/gmail/push", gmailPushRoutes);
  emailsRoot.route("/", emailsRoutes);
  app.route("/api/v1/emails", emailsRoot);
  app.route("/api/v1/auth/gmail", gmailAuthRoutes);
  return app;
};

const authHeader = (userId = "user-a") => testAuthHeader(userId);

describe("POST /api/v1/emails/sync", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/emails/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [
          { externalId: "1", fromEmail: "hr@acme.com", subject: "Hi" },
        ],
      }),
    });
    expect(res.status).toBe(401);
  });

  it("202 queues monitor job", async () => {
    mockService.syncEmails.mockResolvedValue({ status: "queued", count: 1 });
    const res = await buildApp().request("/api/v1/emails/sync", {
      method: "POST",
      headers: {
        Authorization: await authHeader(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            externalId: "1",
            fromEmail: "hr@acme.com",
            subject: "Interview invitation",
            snippet: "Please schedule",
          },
        ],
      }),
    });
    expect(res.status).toBe(202);
  });
});

describe("GET /api/v1/emails/notifications", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 lists notifications", async () => {
    mockService.listNotifications.mockResolvedValue({
      unreadCount: 1,
      notifications: [
        {
          id: "n0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          type: "interview_invitation",
          title: "Interview invitation",
          message: "Status → interviewing",
          data: {},
          isRead: false,
          priority: 2,
          createdAt: new Date(),
        },
      ],
    });
    const res = await buildApp().request("/api/v1/emails/notifications", {
      headers: { Authorization: await authHeader() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { notifications: unknown[] };
    expect(body.notifications).toHaveLength(1);
  });
});

describe("GET /api/v1/auth/gmail", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/auth/gmail");
    expect(res.status).toBe(401);
  });

  it("200 returns authorize URL and no tokens", async () => {
    mockService.startGmailOAuth.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?scope=gmail.readonly",
    });
    const res = await buildApp().request("/api/v1/auth/gmail", {
      headers: { Authorization: await authHeader() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.url).toContain("accounts.google.com");
    expect(body.refresh_token).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
    expect(mockService.startGmailOAuth).toHaveBeenCalledWith("user-a");
  });
});

describe("GET /api/v1/emails/gmail", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 status omits tokens", async () => {
    mockService.getGmailStatus.mockResolvedValue({
      connected: true,
      email: "me@gmail.com",
      historyId: "123",
      watchExpiration: null,
    });
    const res = await buildApp().request("/api/v1/emails/gmail", {
      headers: { Authorization: await authHeader() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.connected).toBe(true);
    expect(body.email).toBe("me@gmail.com");
    expect(body.refreshToken).toBeUndefined();
    expect(body.accessToken).toBeUndefined();
  });
});

describe("POST /api/v1/emails/gmail/push", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 syncs without requiring user JWT", async () => {
    mockService.handleGmailPush.mockResolvedValue({
      status: "queued",
      count: 1,
    });
    const res = await buildApp().request("/api/v1/emails/gmail/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: { data: "e30" },
      }),
    });
    expect(res.status).toBe(200);
    expect(mockService.handleGmailPush).toHaveBeenCalled();
  });
});
