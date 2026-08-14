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
  bulletTraces: Array<{
    text: string;
    chunkId: string;
    section: string;
    status?: "accepted" | "rejected" | "pending";
  }>;
  cvTemplate?: "modern" | "classic" | "minimal";
  clTemplate?: string;
  userNotes?: string | null;
  interviewStages?: Array<{
    id: string;
    stage: string;
    scheduledAt: string;
    status: string;
    notes?: string | null;
  }>;
  nextFollowupAt?: string | null;
  followupCount?: number;
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

export async function bulkGenerateAction(
  limit = 10,
  minScore?: number,
): Promise<
  ActionResult<{ count: number; queued: Array<{ applicationId: string; jobId: string }> }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/bulk-generate`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        limit,
        ...(minScore != null ? { minScore } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Bulk generate failed" };
    }
    const data = (await res.json()) as {
      count: number;
      queued: Array<{ applicationId: string; jobId: string }>;
      submitEnqueued?: boolean;
    };
    if (data.submitEnqueued) {
      return { ok: false, error: "Refusing submit on bulk generate (HG-4)" };
    }
    revalidatePath("/dashboard");
    revalidatePath("/applications");
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

export async function setTemplateAction(
  id: string,
  cvTemplate: "modern" | "classic" | "minimal",
  clTemplate?: "modern" | "classic" | "minimal",
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/template`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        cvTemplate,
        ...(clTemplate ? { clTemplate } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Template update failed" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath(`/applications/${id}/review`);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function updateBulletsAction(
  id: string,
  traces: ApplicationPublic["bulletTraces"],
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/bullets`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        traces: traces.map((t) => ({
          text: t.text,
          chunkId: t.chunkId,
          section: t.section,
          status: t.status ?? "pending",
        })),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Failed to update bullets" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath(`/applications/${id}/review`);
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function regenerateSectionAction(
  id: string,
  section: string,
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(
      `${API_URL}/api/v1/applications/${id}/regenerate-section`,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ section }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Section regenerate failed" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath(`/applications/${id}/review`);
    return { ok: true, data };
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
  kind: "cv" | "cl" | "zip",
): Promise<ActionResult<{ url: string; contentType?: string }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(
      `${API_URL}/api/v1/applications/${id}/download/${kind}`,
      { headers },
    );
    if (!res.ok) return { ok: false, error: "Download unavailable" };
    return {
      ok: true,
      data: (await res.json()) as { url: string; contentType?: string },
    };
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

export async function bulkActionAction(
  applicationIds: string[],
  action: "archive" | "withdraw" | "followup" | "regenerate_docs",
): Promise<ActionResult<{ updated: number; submitEnqueued: boolean }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/bulk-action`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ applicationIds, action }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error ?? "Bulk action failed" };
    }
    const data = (await res.json()) as {
      updated: number;
      submitEnqueued: boolean;
    };
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/pipeline");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function addInterviewAction(
  id: string,
  body: { stage: string; scheduledAt: string; notes?: string },
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}/interviews`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? "Could not add interview" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath("/dashboard/pipeline");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function patchApplicationMetaAction(
  id: string,
  body: { userNotes?: string; nextFollowupAt?: string | null },
): Promise<ActionResult<{ application: ApplicationPublic }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/applications/${id}`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? "Could not update" };
    }
    const data = (await res.json()) as { application: ApplicationPublic };
    revalidatePath("/dashboard/pipeline");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error" };
  }
}
