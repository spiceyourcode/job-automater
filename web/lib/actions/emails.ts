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
  return { authorization: `Bearer ${token}` };
}

export type GmailStatus =
  | { connected: false }
  | {
      connected: true;
      email: string;
      historyId: string | null;
      watchExpiration: string | null;
    };

export async function gmailStatusAction(): Promise<ActionResult<GmailStatus>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/emails/gmail`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load Gmail status" };
    return { ok: true, data: (await res.json()) as GmailStatus };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function startGmailOAuthAction(): Promise<ActionResult<{ url: string }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/gmail`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Could not start Gmail OAuth" };
    }
    const data = (await res.json()) as { url?: string; refreshToken?: string };
    if (!data.url) return { ok: false, error: "Missing authorize URL" };
    if (data.refreshToken) return { ok: false, error: "Unexpected token in response" };
    return { ok: true, data: { url: data.url } };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function syncGmailAction(): Promise<ActionResult<{ count: number }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/emails/gmail/sync`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Gmail sync failed" };
    }
    const data = (await res.json()) as { count: number };
    revalidatePath("/settings/sources");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function disconnectGmailAction(): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/emails/gmail`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Disconnect failed" };
    }
    revalidatePath("/settings/sources");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function listEmailReviewAction(): Promise<
  ActionResult<{ emails: Array<Record<string, unknown>> }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/emails/review`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load review queue" };
    return {
      ok: true,
      data: (await res.json()) as { emails: Array<Record<string, unknown>> },
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function classifyEmailAction(
  id: string,
  category: string,
): Promise<ActionResult<{ applicationStatusUpdated: boolean }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/emails/${id}/classify`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Classify failed" };
    }
    const data = (await res.json()) as { applicationStatusUpdated: boolean };
    revalidatePath("/settings/email-review");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
