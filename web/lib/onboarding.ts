/** Shared onboarding completeness checks (not a server action). */

export type ProfileOnboardingFields = {
  headline: string | null;
  summary: string | null;
  currentRole: string | null;
  technicalSkills: unknown[];
  preferredRoles: unknown[];
  preferredLocations: unknown[];
  salaryMin: number | null;
  salaryMax: number | null;
  cvFileId: string | null;
};

/** True when all required onboarding steps are persisted on the profile. */
export function profileMeetsOnboardingRequirements(
  profile: ProfileOnboardingFields,
): { ok: true } | { ok: false; error: string } {
  if (
    !profile.headline?.trim() ||
    !profile.summary?.trim() ||
    !profile.currentRole?.trim()
  ) {
    return { ok: false, error: "Complete professional identity first" };
  }

  const skills = Array.isArray(profile.technicalSkills)
    ? profile.technicalSkills
    : [];
  if (skills.length < 5) {
    return { ok: false, error: "Add at least 5 skills" };
  }
  const hasExpert = skills.some(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      "level" in s &&
      (s as { level: string }).level === "expert",
  );
  if (!hasExpert) {
    return { ok: false, error: "At least one skill must be expert" };
  }

  if (!Array.isArray(profile.preferredRoles) || profile.preferredRoles.length < 1) {
    return { ok: false, error: "Add at least one target role" };
  }
  if (
    !Array.isArray(profile.preferredLocations) ||
    profile.preferredLocations.length < 1
  ) {
    return { ok: false, error: "Add at least one location" };
  }
  if (
    profile.salaryMin == null ||
    profile.salaryMax == null ||
    profile.salaryMin >= profile.salaryMax
  ) {
    return { ok: false, error: "Salary min must be less than max" };
  }

  if (!profile.cvFileId) {
    return { ok: false, error: "Upload a CV before finishing" };
  }

  return { ok: true };
}
