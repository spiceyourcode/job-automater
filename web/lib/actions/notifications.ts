"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function authHeaders(): Promise<HeadersInit | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
};

export async function listNotificationsAction(): Promise<
  ActionResult<{ notifications: NotificationItem[]; unreadCount: number }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load notifications" };
    return {
      ok: true,
      data: (await res.json()) as {
        notifications: NotificationItem[];
        unreadCount: number;
      },
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function markNotificationReadAction(
  id: string,
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
      method: "PATCH",
      headers,
    });
    if (!res.ok) return { ok: false, error: "Could not mark read" };
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications/read-all`, {
      method: "POST",
      headers,
    });
    if (!res.ok) return { ok: false, error: "Could not mark all read" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export type ChannelPref = {
  inApp: boolean;
  email: boolean;
  slack: boolean;
  telegram: boolean;
};

export async function getNotificationPrefsAction(): Promise<
  ActionResult<{
    preferences: Record<string, ChannelPref>;
    slackConfigured: boolean;
    telegramConfigured: boolean;
  }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications/preferences`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load preferences" };
    return { ok: true, data: (await res.json()) as never };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function patchNotificationPrefsAction(body: {
  preferences?: Record<string, ChannelPref>;
  slackWebhookUrl?: string | null;
  telegramWebhookUrl?: string | null;
}): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/notifications/preferences`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? "Could not save preferences" };
    }
    revalidatePath("/settings/notifications");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
