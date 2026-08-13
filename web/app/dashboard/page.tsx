import { Separator } from "@/components/ui/separator";
import { JobsBoard } from "@/components/jobs-board";
import { PipelineBoard } from "@/components/pipeline-board";
import {
  MetricsBar,
  PipelineSnapshot,
  SourceHealth,
} from "@/components/dashboard-widgets";
import { listApplicationsAction } from "@/lib/actions/applications";
import { listJobsAction } from "@/lib/actions/jobs";
import {
  getAnalyticsDashboardAction,
  getPipelineFunnelAction,
  getSourcePerformanceAction,
} from "@/lib/actions/analytics";

export default async function DashboardPage() {
  const [jobsResult, appsResult, summaryResult, funnelResult, sourcesResult] =
    await Promise.all([
      listJobsAction({ sort: "score" }),
      listApplicationsAction(),
      getAnalyticsDashboardAction(),
      getPipelineFunnelAction(),
      getSourcePerformanceAction(),
    ]);

  const jobs = jobsResult.ok ? (jobsResult.data?.jobs ?? []) : [];
  const applications = appsResult.ok
    ? (appsResult.data?.applications ?? [])
    : [];
  const hasJobs = jobs.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Metrics, pipeline health, top matches, and source status.
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

      <section aria-labelledby="snapshot-heading" className="mb-8" id="pipeline">
        <h2 id="snapshot-heading" className="mb-3 text-lg font-medium">
          Pipeline snapshot
        </h2>
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
        <h2 id="sources-heading" className="mb-3 text-lg font-medium">
          Source health
        </h2>
        {sourcesResult.ok && sourcesResult.data ? (
          <SourceHealth sources={sourcesResult.data.sources} />
        ) : (
          <p className="text-sm text-destructive" role="alert">
            {sourcesResult.ok ? "No sources" : sourcesResult.error}
          </p>
        )}
      </section>

      <Separator className="mb-6" />

      <section aria-labelledby="kanban-heading" className="mb-10">
        <h2 id="kanban-heading" className="mb-4 text-lg font-medium">
          Application pipeline
        </h2>
        {!appsResult.ok ? (
          <p className="text-sm text-destructive" role="alert">
            {appsResult.error}
          </p>
        ) : (
          <PipelineBoard initial={applications} />
        )}
      </section>

      <Separator className="mb-6" />

      <section aria-labelledby="jobs-heading" id="matches">
        <h2 id="jobs-heading" className="mb-4 text-lg font-medium">
          Top matches
        </h2>
        {!jobsResult.ok ? (
          <p className="text-sm text-destructive" role="alert">
            {jobsResult.error}
          </p>
        ) : hasJobs ? (
          <JobsBoard initialJobs={jobs} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No scored jobs yet. Add sources and run collection to see matches
            here — this page is not empty-state-only once jobs exist.
          </p>
        )}
      </section>
    </div>
  );
}
