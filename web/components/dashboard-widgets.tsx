import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DashboardSummary, FunnelStage, SourceRow } from "@/lib/actions/analytics";

export function MetricsBar({ summary }: { summary: DashboardSummary }) {
  const items = [
    { label: "New matches", value: summary.highMatches },
    { label: "Jobs collected", value: summary.jobsCollected },
    { label: "Applied", value: summary.applicationsSubmitted },
    { label: "Interviewing", value: summary.interviewing },
    { label: "Offers", value: summary.offered },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((m) => (
        <div key={m.label} className="rounded-md border px-4 py-3">
          <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
          <p className="text-xs text-muted-foreground">{m.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PipelineSnapshot({ funnel }: { funnel: FunnelStage[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {funnel.map((s) => (
        <li key={s.stage} className="rounded-md border px-3 py-2">
          <p className="text-lg font-medium tabular-nums">{s.count}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </li>
      ))}
    </ul>
  );
}

export function SourceHealth({ sources }: { sources: SourceRow[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sources yet.{" "}
        <Link href="/settings/sources" className="underline underline-offset-4">
          Add a source
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {sources.slice(0, 5).map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-muted-foreground">
              {s.type} · {s.jobsCollected} jobs
            </p>
          </div>
          <Badge variant={s.lastRunStatus === "success" ? "default" : "secondary"}>
            {s.lastRunStatus ?? "idle"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
