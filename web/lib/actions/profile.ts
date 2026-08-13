"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { profileMeetsOnboardingRequirements } from "../onboarding";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type ProfileRow = {
  headline: string | null;
  summary: string | null;
  yearsExperience: number | null;
  currentRole: string | null;
  currentCompany: string | null;
  technicalSkills: unknown[];
  softSkills: unknown[];
  preferredRoles: unknown[];
  preferredLocations: unknown[];
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  employmentTypes: string[];
  visaStatus: string | null;
  cvFileId: string | null;
  cvVersion: number;
  cvLastIndexedAt: string | null;
};

export type CvVersionRow = {
  id: string;
  version: number;
  filename: string | null;
  isActive: boolean;
  createdAt: string;
  chunkCount: number;
  fileUrl: string;
  fileSize: number | null;
};

async function authHeaders(): Promise<HeadersInit | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

const identitySchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  yearsExperience: z.number().int().nonnegative(),
  currentRole: z.string().min(1).max(255),
  currentCompany: z.string().max(255).optional(),
});

const skillsSchema = z.object({
  technicalSkills: z
    .array(
      z.object({
        name: z.string().min(1),
        level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
        years: z.number().int().nonnegative().optional(),
      }),
    )
    .min(5, "Add at least 5 skills")
    .refine((skills) => skills.some((s) => s.level === "expert"), {
      message: "At least one skill must be expert",
    }),
});

const preferencesSchema = z
  .object({
    preferredRoles: z
      .array(z.object({ title: z.string().min(1) }))
      .min(1, "Add at least one target role"),
    preferredLocations: z
      .array(
        z.object({
          city: z.string().min(1),
          remoteOk: z.boolean().optional(),
        }),
      )
      .min(1, "Add at least one location"),
    salaryMinDollars: z.number().int().nonnegative(),
    salaryMaxDollars: z.number().int().positive(),
    employmentTypes: z.array(z.string()).min(1),
    visaStatus: z.string().optional(),
  })
  .refine((d) => d.salaryMinDollars < d.salaryMaxDollars, {
    message: "Salary min must be less than max",
    path: ["salaryMaxDollars"],
  });

async function patchProfile(body: Record<string, unknown>): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/profile`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Failed to save profile" };
  }
  return { ok: true };
}

export async function fetchOwnProfile(): Promise<ActionResult<ProfileRow>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/profile`, {
      headers,
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    return { ok: false, error: "Failed to load profile" };
  }

  const body = (await res.json()) as { profile: ProfileRow };
  return { ok: true, data: body.profile };
}

export async function setOnboardingCompleteCookie(complete: boolean): Promise<void> {
  const cookieStore = await cookies();
  if (complete) {
    cookieStore.set("onboarding_complete", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  } else {
    cookieStore.delete("onboarding_complete");
  }
}

export async function saveIdentityAction(
  input: z.infer<typeof identitySchema>,
): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return patchProfile(parsed.data);
}

export async function saveSkillsAction(
  input: z.infer<typeof skillsSchema>,
): Promise<ActionResult> {
  const parsed = skillsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid skills" };
  }
  return patchProfile({ technicalSkills: parsed.data.technicalSkills });
}

export async function savePreferencesAction(
  input: z.infer<typeof preferencesSchema>,
): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid preferences",
    };
  }
  const d = parsed.data;
  return patchProfile({
    preferredRoles: d.preferredRoles,
    preferredLocations: d.preferredLocations.map((l) => ({
      city: l.city,
      remoteOk: l.remoteOk ?? false,
    })),
    salaryMin: d.salaryMinDollars * 100,
    salaryMax: d.salaryMaxDollars * 100,
    salaryCurrency: "USD",
    employmentTypes: d.employmentTypes,
    visaStatus: d.visaStatus || null,
  });
}

export async function uploadCvAction(formData: FormData): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Missing file" };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/profile/cv`, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "Upload failed" };
  }
  return { ok: true };
}

/** Finish only after profile proves all required steps + ≥1 source. */
export async function completeOnboardingAction(
  sources: string[],
): Promise<ActionResult> {
  if (sources.length < 1) {
    return { ok: false, error: "Select at least one source" };
  }

  const profileResult = await fetchOwnProfile();
  if (!profileResult.ok || !profileResult.data) {
    return { ok: false, error: profileResult.ok ? "Profile missing" : profileResult.error };
  }

  const gate = profileMeetsOnboardingRequirements(profileResult.data);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  await setOnboardingCompleteCookie(true);
  return { ok: true };
}

/** GDPR — download structured JSON export of the caller's data. */
export async function exportOwnDataAction(): Promise<
  ActionResult<Record<string, unknown>>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/profile/export`, {
      headers,
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    return { ok: false, error: "Failed to export data" };
  }

  const data = (await res.json()) as Record<string, unknown>;
  return { ok: true, data };
}

/** GDPR — permanently delete account + cascading PII (including cv_chunks). */
export async function deleteOwnAccountAction(): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/profile`, {
      method: "DELETE",
      headers,
    });
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    return { ok: false, error: "Failed to delete account" };
  }

  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("onboarding_complete");
  return { ok: true };
}

export async function listCvVersionsAction(): Promise<
  ActionResult<{ versions: CvVersionRow[] }>
> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/profile/cv/versions`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: "Failed to load CV versions" };
    const data = (await res.json()) as { versions: CvVersionRow[] };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function activateCvVersionAction(
  version: number,
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(
      `${API_URL}/api/v1/profile/cv/${version}/activate`,
      { method: "POST", headers, cache: "no-store" },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Activate failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function deleteCvVersionAction(
  version: number,
): Promise<ActionResult> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/profile/cv/${version}`, {
      method: "DELETE",
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Delete failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

export async function reindexCvAction(
  version?: number,
): Promise<ActionResult<{ taskId: string }>> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Unauthorized" };
  try {
    const res = await fetch(`${API_URL}/api/v1/profile/cv/reindex`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(version != null ? { version } : {}),
      cache: "no-store",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Reindex failed" };
    }
    const data = (await res.json()) as { taskId: string };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error — is the API running?" };
  }
}

