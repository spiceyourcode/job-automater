"use server";

import { cookies } from "next/headers";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:3001";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function authHeaders(): Promise<HeadersInit | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, "content-type": "application/json" };
}

export async function emergencyStopAction(
  active: boolean,
): Promise<ActionResult<{ active: boolean; drained: number }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/automation/emergency-stop`, {
      method: "POST",
      headers,
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Emergency stop failed" };
    }
    return {
      ok: true,
      data: (await res.json()) as { active: boolean; drained: number },
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function automationStatusAction(): Promise<
  ActionResult<{ emergencyStop: boolean }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/automation/status`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load status" };
    return {
      ok: true,
      data: (await res.json()) as { emergencyStop: boolean },
    };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
