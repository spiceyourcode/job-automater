import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { emailsRoutes } from "./emails.routes.js";

vi.mock("./emails.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./emails.service.js")>();
  return {
    ...actual,
    syncEmails: vi.fn(),
    listEmails: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    EmailsError: actual.EmailsError,
  };
});

import * as emailsService from "./emails.service.js";
const mockService = vi.mocked(emailsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/emails", emailsRoutes);
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
