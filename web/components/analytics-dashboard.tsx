"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import {
  getAnalyticsDashboardAction,
  getMatchQualityAction,
  getPipelineFunnelAction,
  getSkillGapsAction,
  getSourcePerformanceAction,
  type DashboardSummary,
  type FunnelStage,
  type MatchPoint,
  type SkillGapReport,
  type SourceRow,
} from "@/lib/actions/analytics";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CountUp } from "@/components/ui/count-up";
import { CalendarHeatmap } from "@/components/ui/calendar-heatmap";
import { FunnelChart } from "@/components/ui/funnel-chart";
import { RankedBars } from "@/components/ui/ranked-bars";
import SloshGauge from "@/components/ui/slosh-gauge";
import RubberSegment from "@/components/ui/rubber-segment";
import { useTheme } from "@/components/theme-provider";

type Props = {
  initialSummary: DashboardSummary;
  initialFunnel: FunnelStage[];
  initialMatches: MatchPoint[];
  initialSources: SourceRow[];
  initialSkills: SkillGapReport | null;
};

export function AnalyticsDashboard({
  initialSummary,
  initialFunnel,
  initialMatches,
  initialSources,
  initialSkills,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [funnel, setFunnel] = useState(initialFunnel);
  const [matches, setMatches] = useState(initialMatches);
  const [sources, setSources] = useState(initialSources);
  const [skills, setSkills] = useState(initialSkills);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";

  const refresh = (nextDays: number) => {
    setDays(nextDays);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - nextDays * 24 * 60 * 60 * 1000);
    const range = { from: from.toISOString(), to: to.toISOString() };
    startTransition(async () => {
      const [s, p, m, src, sk] = await Promise.all([
        getAnalyticsDashboardAction(range),
        getPipelineFunnelAction(),
        getMatchQualityAction(range),
        getSourcePerformanceAction(),
        getSkillGapsAction(range),
      ]);
      if (!s.ok) {
        setError(s.error);
        return;
      }
      if (s.data) setSummary(s.data);
      if (p.ok && p.data) setFunnel(p.data.funnel);
      if (m.ok && m.data) setMatches(m.data.series);
      if (src.ok && src.data) setSources(src.data.sources);
      if (sk.ok) setSkills(sk.data ?? null);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Date range</span>
        <RubberSegment
          theme={theme}
          size="sm"
          value={String(days)}
          disabled={pending}
          aria-label="Date range"
          items={[
            { value: "7", label: "7d" },
            { value: "30", label: "30d" },
            { value: "90", label: "90d" },
          ]}
          onChange={(value) => refresh(Number(value))}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="cursor-pointer">
            <a
              href={`/analytics/export?format=csv&reportType=dashboard&from=${encodeURIComponent(summary.range.from)}&to=${encodeURIComponent(summary.range.to)}`}
            >
              Download CSV
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="cursor-pointer">
            <a
              href={`/analytics/export?format=pdf&reportType=dashboard&from=${encodeURIComponent(summary.range.from)}&to=${encodeURIComponent(summary.range.to)}`}
            >
              Download PDF
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="mb-3 text-lg font-medium">
          Summary
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Jobs collected", summary.jobsCollected],
            ["Applications", summary.applicationsCreated],
            ["Submitted", summary.applicationsSubmitted],
            ["Avg match", summary.avgMatchScore ?? "—"],
            ["High matches (≥85)", summary.highMatches],
            ["Interviewing", summary.interviewing],
            ["Offers", summary.offered],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                {typeof value === "number" ? (
                  <CountUp to={value} duration={1.5} className="tabular-nums" />
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Separator />

      <section aria-labelledby="funnel-heading">
        <h2 id="funnel-heading" className="mb-3 text-lg font-medium">
          Pipeline funnel
        </h2>
        {funnel.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pipeline data in range.</p>
        ) : (
          <div className="rounded-lg border p-4">
            <FunnelChart stages={funnel} />
          </div>
        )}
      </section>

      <section aria-labelledby="match-heading">
        <h2 id="match-heading" className="mb-3 text-lg font-medium">
          Match quality
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scored jobs in range.</p>
        ) : (
          <div className="rounded-lg border p-4">
            <CalendarHeatmap data={matches} />
          </div>
        )}
      </section>

      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="mb-3 text-lg font-medium">
          Source ROI
        </h2>
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sources configured.</p>
        ) : (
          <div className="rounded-lg border p-4">
            <RankedBars
              items={[...sources]
                .sort((a, b) => b.jobsCollected - a.jobsCollected)
                .map((s) => ({
                  id: s.id,
                  name: s.name,
                  type: s.type,
                  value: s.jobsCollected,
                }))}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="mb-3 text-lg font-medium">
          Skill gap
        </h2>
        {!skills ? (
          <p className="text-sm text-muted-foreground">
            No skill data yet. Collect and score jobs to see coverage.
          </p>
        ) : (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-6">
              <SloshGauge
                value={skills.mySkillsCoverage.coveragePct}
                interactive={false}
                showValue
                unit="%"
                ariaLabel="In-demand skill coverage"
                liquidColor={theme === "light" ? "#18181b" : "#fafafa"}
                glassColor={theme === "light" ? "#e4e4e7" : "#262626"}
                className="shrink-0"
              />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  In-demand skills covered
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  <CountUp to={skills.mySkillsCoverage.inDemandCovered} duration={1.5} className="tabular-nums" />/
                  <CountUp to={skills.inDemand.length} duration={1.5} className="tabular-nums" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {skills.mySkillsCoverage.coveragePct}% coverage across{" "}
                  {skills.inDemand.length} in-demand skills in range
                </p>
              </div>
            </div>
            {skills.gaps.length === 0 ? (
              <p className="text-sm">No gaps in the current range.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {skills.gaps.slice(0, 12).map((g) => (
                  <li key={g.skill}>
                    <a
                      href={g.course?.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="font-medium">{g.skill}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        ×{g.count}
                      </span>
                      {g.course ? (
                        <ExternalLink className="size-3 text-muted-foreground" />
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}