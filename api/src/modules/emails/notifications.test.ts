import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testAuthHeader } from "../../test/auth-header.js";
import { notificationsRoutes } from "./notifications.routes.js";

vi.mock("./emails.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./emails.service.js")>();
  return {
    ...actual,
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    getNotificationPreferences: vi.fn(),
    patchNotificationPreferences: vi.fn(),
    EmailsError: actual.EmailsError,
  };
});

import * as emailsService from "./emails.service.js";
const mockService = vi.mocked(emailsService, true);

const buildApp = () => {
  const app = new Hono();
  app.route("/api/v1/notifications", notificationsRoutes);
  return app;
};

describe("GET /api/v1/notifications", () => {
  afterEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await buildApp().request("/api/v1/notifications");
    expect(res.status).toBe(401);
  });

  it("200 lists own notifications with unreadCount", async () => {
    mockService.listNotifications.mockResolvedValue({
      unreadCount: 1,
      notifications: [
        {
          id: "n0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          type: "offer",
          title: "Offer received",
          message: "Status → offered",
          data: {},
          isRead: false,
          priority: 3,
          createdAt: new Date(),
        },
      ],
    });
    const res = await buildApp().request("/api/v1/notifications", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unreadCount: number };
    expect(body.unreadCount).toBe(1);
    expect(mockService.listNotifications).toHaveBeenCalledWith("user-a");
  });
});

describe("GET /api/v1/notifications/preferences", () => {
  afterEach(() => vi.clearAllMocks());

  it("200 never returns webhook URLs", async () => {
    mockService.getNotificationPreferences.mockResolvedValue({
      preferences: {
        offer: { inApp: true, email: true, slack: true, telegram: false },
      },
      slackConfigured: true,
      telegramConfigured: false,
    });
    const res = await buildApp().request("/api/v1/notifications/preferences", {
      headers: { Authorization: await testAuthHeader("user-a") },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.slackConfigured).toBe(true);
    expect(body.slackWebhookUrl).toBeUndefined();
    expect(body.telegramWebhookUrl).toBeUndefined();
  });
});
