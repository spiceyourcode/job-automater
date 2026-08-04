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
  sourceConfigs,
} from "../../db/schema/index.js";
import type { AnalyticsRangeQuery } from "./analytics.schema.js";

function rangeBounds(query: AnalyticsRangeQuery): {
  from: Date;
  to: Date;
} {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
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
