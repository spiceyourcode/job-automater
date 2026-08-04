"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function authHeaders(): Promise<HeadersInit | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

export type TeamMember = {
  userId: string;
  role: string;
  email: string;
  name: string | null;
};

export async function listTeamMembersAction(): Promise<
  ActionResult<{ members: TeamMember[] }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/team/members`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load team" };
    return { ok: true, data: (await res.json()) as { members: TeamMember[] } };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function inviteTeamMemberAction(
  email: string,
  role: "member" | "viewer",
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/team/members`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Invite failed" };
    }
    revalidatePath("/settings/team");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
