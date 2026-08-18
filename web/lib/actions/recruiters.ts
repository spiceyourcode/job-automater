"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type RecruiterContact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  role: string | null;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

export async function listRecruitersAction(): Promise<
  ActionResult<{ contacts: RecruiterContact[] }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/recruiters`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load contacts" };
    return { ok: true, data: (await res.json()) as { contacts: RecruiterContact[] } };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function createRecruiterAction(form: {
  name: string;
  company?: string;
  email?: string;
  role?: string;
}): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/recruiters`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) return { ok: false, error: "Could not create contact" };
    revalidatePath("/crm");
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
