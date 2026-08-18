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
  source?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  status?: string;
  savedOnly?: boolean;
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
  if (params.source) qs.set("source", params.source);
  if (params.location) qs.set("location", params.location);
  if (params.salaryMin != null) qs.set("salaryMin", String(params.salaryMin));
  if (params.salaryMax != null) qs.set("salaryMax", String(params.salaryMax));
  if (params.status) qs.set("status", params.status);
  if (params.savedOnly) qs.set("savedOnly", "true");

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

export async function importJobAction(
  url: string,
): Promise<
  ActionResult<{ job: JobPublic; taskId: string | null; deduped: boolean }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/jobs/import`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ url }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      return { ok: false, error: body?.error ?? "Import failed" };
    }
    const data = (await res.json()) as {
      job: JobPublic;
      taskId: string | null;
      deduped: boolean;
    };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function listSimilarJobsAction(
  id: string,
  limit = 5,
): Promise<ActionResult<{ jobs: JobPublic[] }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(
      `${API_URL}/api/v1/jobs/${id}/similar?limit=${limit}`,
      { headers, cache: "no-store" },
    );
    if (res.status === 404) return { ok: false, error: "Job not found" };
    if (!res.ok) return { ok: false, error: "Failed to load similar jobs" };
    const data = (await res.json()) as { jobs: JobPublic[] };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function saveJobAction(id: string): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/jobs/${id}/save`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "Job not found" };
    if (!res.ok) return { ok: false, error: "Failed to save job" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function unsaveJobAction(id: string): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/jobs/${id}/save`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "Job not found" };
    if (!res.ok) return { ok: false, error: "Failed to unsave job" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export type JobStats = {
  total: number;
  remote: number;
  scored: number;
  saved: number;
  bySource: Array<{ source: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export type SalaryBenchmark = {
  sampleSize: number;
  currency: string;
  p25Cents: number | null;
  p50Cents: number | null;
  p75Cents: number | null;
  minCents: number | null;
  maxCents: number | null;
  title: string | null;
  location: string | null;
};

export async function getSalaryBenchmarkAction(params?: {
  title?: string;
  location?: string;
}): Promise<ActionResult<SalaryBenchmark>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  const qs = new URLSearchParams();
  if (params?.title) qs.set("title", params.title);
  if (params?.location) qs.set("location", params.location);
  const q = qs.toString();
  try {
    const res = await fetch(
      `${API_URL}/api/v1/jobs/salary-benchmark${q ? `?${q}` : ""}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) return { ok: false, error: "Failed to load salary benchmark" };
    return { ok: true, data: (await res.json()) as SalaryBenchmark };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}
