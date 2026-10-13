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
  isSaved?: boolean;
  score: JobScorePublic | null;
};

/** Format integer cents → display (HG-3). */
export { formatSalaryCents } from "./currency";
export type { CurrencyInfo, SupportedCurrency } from "./currency";
export { getCurrencyFromLocale, getCurrencyInfo, SUPPORTED_CURRENCIES } from "./currency";
