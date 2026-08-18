"use client";

import { useMemo, useState, useTransition } from "react";
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

type Props = {
  initialSummary: DashboardSummary;
  initialFunnel: FunnelStage[];
  initialMatches: MatchPoint[];
  initialSources: SourceRow[];
  initialSkills: SkillGapReport | null;
};

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-foreground/80 transition-[width]"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
    </div>
  );
}

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

  const funnelMax = useMemo(
    () => Math.max(1, ...funnel.map((f) => f.count)),
    [funnel],
  );
  const sourceMax = useMemo(
    () => Math.max(1, ...sources.map((s) => s.jobsCollected)),
    [sources],
  );
  const matchMax = useMemo(
    () => Math.max(1, ...matches.map((m) => m.avgScore)),
    [matches],
  );

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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Date range</span>
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            type="button"
            size="sm"
            variant={days === d ? "default" : "outline"}
            className="cursor-pointer"
            disabled={pending}
            onClick={() => refresh(d)}
          >
            {d}d
          </Button>
        ))}
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
                {value}
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
        <div className="space-y-3 rounded-lg border p-4">
          {funnel.map((f) => (
            <BarRow
              key={f.stage}
              label={f.label}
              value={f.count}
              max={funnelMax}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="match-heading">
        <h2 id="match-heading" className="mb-3 text-lg font-medium">
          Match quality
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scored jobs in range.</p>
        ) : (
          <div className="space-y-3 rounded-lg border p-4">
            {matches.map((m) => (
              <BarRow
                key={m.day}
                label={`${m.day} (${m.count})`}
                value={m.avgScore}
                max={matchMax}
              />
            ))}
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
          <div className="space-y-3 rounded-lg border p-4">
            {sources.map((s) => (
              <BarRow
                key={s.id}
                label={`${s.name} · ${s.type}`}
                value={s.jobsCollected}
                max={sourceMax}
              />
            ))}
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
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              Coverage {skills.mySkillsCoverage.coveragePct}% ·{" "}
              {skills.mySkillsCoverage.inDemandCovered}/
              {skills.inDemand.length} in-demand skills on your profile
            </p>
            {skills.gaps.length === 0 ? (
              <p className="text-sm">No gaps in the current range.</p>
            ) : (
              skills.gaps.slice(0, 12).map((g) => (
                <div key={g.skill} className="space-y-1">
                  <BarRow
                    label={g.skill}
                    value={g.count}
                    max={Math.max(1, ...skills.gaps.map((x) => x.count))}
                  />
                  {g.course ? (
                    <a
                      href={g.course.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                      {g.course.provider}: {g.course.title}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
