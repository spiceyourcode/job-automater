/**
 * Analytics module — read-only aggregates for the owning user.
 * Cross-table reads are an explicit analytics exception to HG-6
 * (see docs/contracts/phase-5-monitoring.md + backend-module-skill).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  applications,
  jobScores,
  jobs,
  profiles,
  sourceConfigs,
} from "../../db/schema/index.js";
import { textToAtsPdf } from "../../lib/ats-pdf.js";
import { assertOwnerOnly, toCsv } from "../../lib/csv.js";
import type {
  AnalyticsExportQuery,
  AnalyticsRangeQuery,
} from "./analytics.schema.js";
import { suggestCourse, type CourseSuggestion } from "./courses.js";

function rangeBounds(
  query: AnalyticsRangeQuery,
  defaultDays = 30,
): {
  from: Date;
  to: Date;
} {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
  return { from, to };
}

function skillLabel(item: unknown): string | null {
  if (typeof item === "string") {
    const s = item.trim();
    return s.length > 0 ? s : null;
  }
  if (item && typeof item === "object") {
    const rec = item as Record<string, unknown>;
    const raw = rec.skill ?? rec.name ?? rec.label;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

export async function getDashboardSummary(
  userId: string,
  query: AnalyticsRangeQuery,
) {
  const { from, to } = rangeBounds(query);

  const [jobStats] = await db
    .select({
      jobs: sql<number>`count(*)::int`,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.isDuplicate, false),
        gte(jobs.collectedAt, from),
        lte(jobs.collectedAt, to),
      ),
    );

  const [appStats] = await db
    .select({
      applications: sql<number>`count(*)::int`,
      submitted: sql<number>`count(*) filter (where ${applications.status} in ('submitted','acknowledged','screening','interviewing','offered','rejected','archived'))::int`,
      interviewing: sql<number>`count(*) filter (where ${applications.status} = 'interviewing')::int`,
      offered: sql<number>`count(*) filter (where ${applications.status} = 'offered')::int`,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        gte(applications.createdAt, from),
        lte(applications.createdAt, to),
      ),
    );

  const [scoreStats] = await db
    .select({
      avgScore: sql<string | null>`avg(${jobScores.overallScore})`,
      highMatches: sql<number>`count(*) filter (where ${jobScores.overallScore}::numeric >= 85)::int`,
    })
    .from(jobScores)
    .where(
      and(
        eq(jobScores.userId, userId),
        gte(jobScores.scoredAt, from),
        lte(jobScores.scoredAt, to),
      ),
    );

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    jobsCollected: jobStats?.jobs ?? 0,
    applicationsCreated: appStats?.applications ?? 0,
    applicationsSubmitted: appStats?.submitted ?? 0,
    interviewing: appStats?.interviewing ?? 0,
    offered: appStats?.offered ?? 0,
    avgMatchScore:
      scoreStats?.avgScore != null
        ? Math.round(Number(scoreStats.avgScore) * 10) / 10
        : null,
    highMatches: scoreStats?.highMatches ?? 0,
  };
}

/** Pipeline funnel counts (AppFlow stages). */
export async function getPipelineFunnel(userId: string) {
  const rows = await db
    .select({
      status: applications.status,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .where(eq(applications.userId, userId))
    .groupBy(applications.status);

  const byStatus = Object.fromEntries(
    rows.map((r) => [r.status, r.count]),
  ) as Record<string, number>;

  const funnel = [
    {
      stage: "draft",
      label: "Draft",
      count: byStatus.draft ?? 0,
    },
    {
      stage: "applied",
      label: "Applied",
      count:
        (byStatus.submitted ?? 0) +
        (byStatus.approved ?? 0) +
        (byStatus.pending_approval ?? 0) +
        (byStatus.acknowledged ?? 0),
    },
    {
      stage: "screening",
      label: "Screening",
      count: byStatus.screening ?? 0,
    },
    {
      stage: "interviewing",
      label: "Interviewing",
      count: byStatus.interviewing ?? 0,
    },
    {
      stage: "offer",
      label: "Offer",
      count: byStatus.offered ?? 0,
    },
    {
      stage: "archived",
      label: "Archived",
      count:
        (byStatus.archived ?? 0) +
        (byStatus.rejected ?? 0) +
        (byStatus.withdrawn ?? 0),
    },
  ];

  return { funnel };
}

export async function getMatchQuality(
  userId: string,
  query: AnalyticsRangeQuery,
) {
  const { from, to } = rangeBounds(query);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${jobScores.scoredAt}), 'YYYY-MM-DD')`,
      avgScore: sql<string>`avg(${jobScores.overallScore})`,
      count: sql<number>`count(*)::int`,
    })
    .from(jobScores)
    .where(
      and(
        eq(jobScores.userId, userId),
        gte(jobScores.scoredAt, from),
        lte(jobScores.scoredAt, to),
      ),
    )
    .groupBy(sql`date_trunc('day', ${jobScores.scoredAt})`)
    .orderBy(sql`date_trunc('day', ${jobScores.scoredAt})`);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    series: rows.map((r) => ({
      day: r.day,
      avgScore: Math.round(Number(r.avgScore) * 10) / 10,
      count: r.count,
    })),
  };
}

/** Source ROI: jobs collected vs applications started per source config. */
export async function getSourcePerformance(userId: string) {
  const sources = await db
    .select({
      id: sourceConfigs.id,
      name: sourceConfigs.name,
      type: sourceConfigs.sourceType,
      lastRunStatus: sourceConfigs.lastRunStatus,
    })
    .from(sourceConfigs)
    .where(eq(sourceConfigs.userId, userId));

  const jobCounts = await db
    .select({
      sourceConfigId: jobs.sourceConfigId,
      jobs: sql<number>`count(*)::int`,
    })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.isDuplicate, false)))
    .groupBy(jobs.sourceConfigId);

  const jobMap = new Map(
    jobCounts.map((r) => [r.sourceConfigId, r.jobs] as const),
  );

  return {
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      lastRunStatus: s.lastRunStatus,
      jobsCollected: jobMap.get(s.id) ?? 0,
    })),
  };
}

export type SkillDemand = {
  skill: string;
  count: number;
  avgSalaryCents: number | null;
};

export type SkillGap = SkillDemand & {
  course: CourseSuggestion;
};

export type SkillGapReport = {
  range: { from: string; to: string };
  inDemand: SkillDemand[];
  mySkills: string[];
  mySkillsCoverage: {
    totalProfileSkills: number;
    inDemandCovered: number;
    coveragePct: number;
  };
  gaps: SkillGap[];
};

/** Skill-gap for this user only — never mix another user's jobs/scores (HG-6 analytics exception). */
export async function getSkillGaps(
  userId: string,
  query: AnalyticsRangeQuery,
): Promise<SkillGapReport> {
  const { from, to } = rangeBounds(query, 90);

  const [profile] = await db
    .select({ technicalSkills: profiles.technicalSkills })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const mySkills = [
    ...new Set(
      (profile?.technicalSkills ?? [])
        .map(skillLabel)
        .filter((s): s is string => s != null),
    ),
  ];
  const mySet = new Set(mySkills.map((s) => s.toLowerCase()));

  const jobRows = await db
    .select({
      userId: jobs.userId,
      keywords: jobs.keywords,
      techStack: jobs.techStack,
      salaryMin: jobs.salaryMin,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, userId),
        eq(jobs.isDuplicate, false),
        gte(jobs.collectedAt, from),
        lte(jobs.collectedAt, to),
      ),
    );

  assertOwnerOnly(userId, jobRows);

  const demand = new Map<
    string,
    { label: string; count: number; salarySum: number; salaryN: number }
  >();
  const bump = (raw: unknown, salaryMin: number | null) => {
    const label = skillLabel(raw);
    if (!label) return;
    const key = label.toLowerCase();
    const cur = demand.get(key) ?? {
      label,
      count: 0,
      salarySum: 0,
      salaryN: 0,
    };
    cur.count += 1;
    if (salaryMin != null && salaryMin > 0) {
      cur.salarySum += salaryMin;
      cur.salaryN += 1;
    }
    demand.set(key, cur);
  };

  for (const row of jobRows) {
    for (const k of row.keywords ?? []) bump(k, row.salaryMin);
    for (const t of row.techStack ?? []) bump(t, row.salaryMin);
  }

  const scoreRows = await db
    .select({
      userId: jobScores.userId,
      missingSkills: jobScores.missingSkills,
    })
    .from(jobScores)
    .where(
      and(
        eq(jobScores.userId, userId),
        gte(jobScores.scoredAt, from),
        lte(jobScores.scoredAt, to),
      ),
    );

  assertOwnerOnly(userId, scoreRows);
  for (const row of scoreRows) {
    for (const s of row.missingSkills ?? []) bump(s, null);
  }

  const inDemand: SkillDemand[] = [...demand.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
    .map((d) => ({
      skill: d.label,
      count: d.count,
      avgSalaryCents:
        d.salaryN > 0 ? Math.round(d.salarySum / d.salaryN) : null,
    }));

  const inDemandCovered = inDemand.filter((d) =>
    mySet.has(d.skill.toLowerCase()),
  ).length;
  const gaps: SkillGap[] = inDemand
    .filter((d) => !mySet.has(d.skill.toLowerCase()))
    .map((d) => ({ ...d, course: suggestCourse(d.skill) }));

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    inDemand,
    mySkills,
    mySkillsCoverage: {
      totalProfileSkills: mySkills.length,
      inDemandCovered,
      coveragePct:
        inDemand.length === 0
          ? 100
          : Math.round((inDemandCovered / inDemand.length) * 1000) / 10,
    },
    gaps,
  };
}

export type AnalyticsExportFile = {
  filename: string;
  contentType: string;
  body: Buffer;
};

async function getApplicationExportRows(userId: string, query: AnalyticsRangeQuery) {
  const { from, to } = rangeBounds(query);
  const rows = await db
    .select({
      userId: applications.userId,
      applicationId: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      submittedAt: applications.submittedAt,
      company: jobs.company,
      title: jobs.title,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(
      and(
        eq(applications.userId, userId),
        gte(applications.createdAt, from),
        lte(applications.createdAt, to),
      ),
    );
  return assertOwnerOnly(userId, rows);
}

function tableToText(headers: string[], rows: Array<Array<unknown>>): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length), 1),
  );
  const fmt = (row: unknown[]) =>
    row
      .map((c, i) => String(c ?? "").padEnd(widths[i] ?? 1))
      .join("  ");
  return [fmt(headers), fmt(headers.map(() => "-")), ...rows.map(fmt)].join(
    "\n",
  );
}

/** Owner-scoped CSV/PDF. Never includes CV/CL or other users' rows. */
export async function buildAnalyticsExport(
  userId: string,
  query: AnalyticsExportQuery,
): Promise<AnalyticsExportFile> {
  const reportType = query.reportType ?? "dashboard";
  const format = query.format ?? "csv";
  let headers: string[] = [];
  let rows: Array<Array<unknown>> = [];

  if (reportType === "pipeline") {
    const { funnel } = await getPipelineFunnel(userId);
    headers = ["stage", "label", "count"];
    rows = funnel.map((f) => [f.stage, f.label, f.count]);
  } else if (reportType === "matches") {
    const { series } = await getMatchQuality(userId, query);
    headers = ["day", "avgScore", "count"];
    rows = series.map((s) => [s.day, s.avgScore, s.count]);
  } else if (reportType === "sources") {
    const { sources } = await getSourcePerformance(userId);
    headers = ["id", "name", "type", "jobsCollected"];
    rows = sources.map((s) => [s.id, s.name, s.type, s.jobsCollected]);
  } else if (reportType === "applications") {
    const apps = await getApplicationExportRows(userId, query);
    headers = ["applicationId", "company", "title", "status", "createdAt", "submittedAt"];
    rows = apps.map((a) => [
      a.applicationId,
      a.company,
      a.title,
      a.status,
      a.createdAt.toISOString(),
      a.submittedAt?.toISOString() ?? "",
    ]);
  } else {
    const summary = await getDashboardSummary(userId, query);
    headers = ["metric", "value"];
    rows = [
      ["from", summary.range.from],
      ["to", summary.range.to],
      ["jobsCollected", summary.jobsCollected],
      ["applicationsCreated", summary.applicationsCreated],
      ["applicationsSubmitted", summary.applicationsSubmitted],
      ["interviewing", summary.interviewing],
      ["offered", summary.offered],
      ["avgMatchScore", summary.avgMatchScore ?? ""],
      ["highMatches", summary.highMatches],
    ];
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "pdf") {
    const body = tableToText(headers, rows);
    const bytes = await textToAtsPdf(
      `JobAutomater analytics (${reportType})`,
      body,
    );
    return {
      filename: `analytics-${reportType}-${stamp}.pdf`,
      contentType: "application/pdf",
      body: Buffer.from(bytes),
    };
  }

  return {
    filename: `analytics-${reportType}-${stamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: Buffer.from(toCsv(headers, rows), "utf8"),
  };
}

const RESPONSE_STATUSES = new Set([
  "screening",
  "interviewing",
  "offered",
  "acknowledged",
]);

/** Response rates by CV version used on the caller's applications (P13.3). */
export async function getCvAbReport(userId: string) {
  const rows = await db
    .select({
      userId: applications.userId,
      cvVersion: applications.cvVersion,
      status: applications.status,
      submittedAt: applications.submittedAt,
    })
    .from(applications)
    .where(eq(applications.userId, userId));

  assertOwnerOnly(userId, rows);

  const by = new Map<
    number,
    { used: number; submitted: number; responses: number }
  >();
  for (const row of rows) {
    const v = row.cvVersion;
    const cur = by.get(v) ?? { used: 0, submitted: 0, responses: 0 };
    cur.used += 1;
    if (row.submittedAt) cur.submitted += 1;
    if (RESPONSE_STATUSES.has(row.status)) cur.responses += 1;
    by.set(v, cur);
  }

  const variants = [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cvVersion, s]) => ({
      cvVersion,
      applications: s.used,
      submitted: s.submitted,
      responses: s.responses,
      responseRatePct:
        s.submitted === 0
          ? 0
          : Math.round((s.responses / s.submitted) * 1000) / 10,
    }));

  return { variants };
}
