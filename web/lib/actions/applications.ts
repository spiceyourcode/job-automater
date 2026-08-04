"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ApplicationPublic = {
  id: string;
  jobId: string;
  status: string;
  tailoredCvContent: string | null;
  coverLetterContent: string | null;
  documentsReviewedAt: string | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  submittedVia?: string | null;
  submitError?: string | null;
  pipelineStage?:
    | "applied"
    | "screening"
    | "interviewing"
    | "offer"
    | "archived"
    | null;
  canApply: boolean;
  canApprove?: boolean;
  bulletTraces: Array<{ text: string; chunkId: string; section: string }>;
  jobTitle?: string;
  jobCompany?: string;
};

export type PipelineStage =
  | "applied"
  | "screening"
  | "interviewing"
  | "offer"
  | "archived";


async function authHeaders(): Promise<HeadersInit | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

export async function createApplicationAction(
  jobId: string,
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Failed to start generation" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function getApplicationAction(
  id: string,
): Promise<
  ActionResult<{
    application: ApplicationPublic;
    job: { id: string; title: string; company: string } | null;
  }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "Not found" };
    if (!res.ok) return { ok: false, error: "Failed to load application" };
    return { ok: true, data: (await res.json()) as never };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function regenerateApplicationAction(
  id: string,
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/regenerate`, {
      method: "POST",
      headers,
    });
    if (!res.ok) return { ok: false, error: "Regenerate failed" };
    revalidatePath(`/applications/${id}/review`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function markReviewedAction(
  id: string,
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/review`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Review failed" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath(`/applications/${id}/review`);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** P4.1 / HG-4 — only path that enqueues submit (requires approved_at server-side). */
export async function approveApplicationAction(
  id: string,
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/approve`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Approval failed" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath(`/applications/${id}/review`);
    revalidatePath("/dashboard");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function downloadDocAction(
  id: string,
  kind: "cv" | "cl",
): Promise<ActionResult<{ url: string }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(
      `${API_URL}/api/v1/applications/${id}/download/${kind}`,
      { headers },
    );
    if (!res.ok) return { ok: false, error: "Download unavailable" };
    return { ok: true, data: (await res.json()) as { url: string } };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function listApplicationsAction(): Promise<
  ActionResult<{ applications: ApplicationPublic[] }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load applications" };
    return {
      ok: true,
      data: (await res.json()) as { applications: ApplicationPublic[] },
    };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function updateApplicationStageAction(
  id: string,
  stage: PipelineStage,
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/stage`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Could not move stage" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pipeline");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
