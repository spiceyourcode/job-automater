export type JobScorePublic = {
  overall: number;
  skillMatch: number | null;
  experienceMatch: number | null;
  locationMatch: number | null;
  salaryMatch: number | null;
  cultureMatch: number | null;
  reasoning: string;
  matchedSkills: unknown[];
  missingSkills: unknown[];
  weights: Record<string, unknown>;
  scoredAt: string;
};

export type JobPublic = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  remoteType: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  description: string | null;
  requirements: string | null;
  applicationUrl: string | null;
  source: string;
  sourceUrl: string | null;
  tags: string[];
  status: string;
  isDuplicate: boolean;
  collectedAt: string;
  postedAt: string | null;
  score: JobScorePublic | null;
};

/** Format integer cents → display (HG-3). */
export function formatSalaryCents(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = "USD",
): string | null {
  if (min == null && max == null) return null;
  const fmt = (cents: number) => {
    const dollars = cents / 100;
    if (dollars >= 1000) {
      return `$${Math.round(dollars / 1000)}k`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(dollars);
  };
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}
