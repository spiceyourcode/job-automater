"use server";

import { cookies } from "next/headers";
import type { JobPublic } from "@/lib/jobs";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ListJobsParams = {
  sort?: "score" | "date";
  minScore?: number;
  q?: string;
  remoteOnly?: boolean;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

export async function listJobsAction(
  params: ListJobsParams = {},
): Promise<ActionResult<{ jobs: JobPublic[]; total: number }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  const qs = new URLSearchParams();
  qs.set("sort", params.sort ?? "score");
  if (params.minScore != null) qs.set("minScore", String(params.minScore));
  if (params.q) qs.set("q", params.q);
  if (params.remoteOnly) qs.set("remoteOnly", "true");

  try {
    const res = await fetch(`${API_URL}/api/v1/jobs?${qs}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load jobs" };
    const data = (await res.json()) as { jobs: JobPublic[]; total: number };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function getJobAction(
  id: string,
): Promise<ActionResult<{ job: JobPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/jobs/${id}`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "Job not found" };
    if (!res.ok) return { ok: false, error: "Failed to load job" };
    const data = (await res.json()) as { job: JobPublic };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}
