"use server";

import { cookies } from "next/headers";

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

export type DashboardSummary = {
  range: { from: string; to: string };
  jobsCollected: number;
  applicationsCreated: number;
  applicationsSubmitted: number;
  interviewing: number;
  offered: number;
  avgMatchScore: number | null;
  highMatches: number;
};

export type FunnelStage = { stage: string; label: string; count: number };

export type MatchPoint = { day: string; avgScore: number; count: number };

export type SourceRow = {
  id: string;
  name: string;
  type: string;
  lastRunStatus: string | null;
  jobsCollected: number;
};

async function getJson<T>(path: string): Promise<ActionResult<T>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load analytics" };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function getAnalyticsDashboardAction(range?: {
  from?: string;
  to?: string;
}) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const q = qs.toString();
  return getJson<DashboardSummary>(
    `/api/v1/analytics/dashboard${q ? `?${q}` : ""}`,
  );
}

export async function getPipelineFunnelAction() {
  return getJson<{ funnel: FunnelStage[] }>("/api/v1/analytics/pipeline");
}

export async function getMatchQualityAction(range?: {
  from?: string;
  to?: string;
}) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const q = qs.toString();
  return getJson<{ series: MatchPoint[] }>(
    `/api/v1/analytics/matches${q ? `?${q}` : ""}`,
  );
}

export async function getSourcePerformanceAction() {
  return getJson<{ sources: SourceRow[] }>("/api/v1/analytics/sources");
}
