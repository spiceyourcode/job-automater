import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  MetricsBar,
  PipelineSnapshot,
  SourceHealth,
} from "@/components/dashboard-widgets";
import {
  getAnalyticsDashboardAction,
  getPipelineFunnelAction,
  getSourcePerformanceAction,
} from "@/lib/actions/analytics";

export default async function DashboardPage() {
  const [summaryResult, funnelResult, sourcesResult] = await Promise.all([
    getAnalyticsDashboardAction(),
    getPipelineFunnelAction(),
    getSourcePerformanceAction(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Metrics, pipeline health, and source status.
        </p>
      </div>

      <section aria-labelledby="metrics-heading" className="mb-8">
        <h2 id="metrics-heading" className="mb-3 text-lg font-medium">
          Metrics
        </h2>
        {summaryResult.ok && summaryResult.data ? (
          <MetricsBar summary={summaryResult.data} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {summaryResult.ok ? "No metrics yet." : summaryResult.error}
          </p>
        )}
      </section>

      <Separator className="mb-6" />

      <section aria-labelledby="snapshot-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="snapshot-heading" className="text-lg font-medium">
            Pipeline snapshot
          </h2>
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href="/applications">View applications</Link>
          </Button>
        </div>
        {funnelResult.ok && funnelResult.data ? (
          <PipelineSnapshot funnel={funnelResult.data.funnel} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            {funnelResult.ok ? "No funnel data" : funnelResult.error}
          </p>
        )}
      </section>

      <Separator className="mb-6" />

      <section aria-labelledby="sources-heading" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="sources-heading" className="text-lg font-medium">
            Source health
          </h2>
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link href="/jobs">View jobs</Link>
          </Button>
        </div>
        {sourcesResult.ok && sourcesResult.data ? (
          <SourceHealth sources={sourcesResult.data.sources} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            {sourcesResult.ok ? "No sources" : sourcesResult.error}
          </p>
        )}
      </section>
    </div>
  );
}
