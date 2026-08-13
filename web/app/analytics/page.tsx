import {
  getAnalyticsDashboardAction,
  getMatchQualityAction,
  getPipelineFunnelAction,
  getSourcePerformanceAction,
} from "@/lib/actions/analytics";
import { Separator } from "@/components/ui/separator";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";

export default async function AnalyticsPage() {
  const [summaryRes, funnelRes, matchesRes, sourcesRes] = await Promise.all([
    getAnalyticsDashboardAction(),
    getPipelineFunnelAction(),
    getMatchQualityAction(),
    getSourcePerformanceAction(),
  ]);

  const summary = summaryRes.ok ? summaryRes.data : null;
  const funnel = funnelRes.ok ? (funnelRes.data?.funnel ?? []) : [];
  const matches = matchesRes.ok ? (matchesRes.data?.series ?? []) : [];
  const sources = sourcesRes.ok ? (sourcesRes.data?.sources ?? []) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline funnel, match quality, and source performance.
        </p>
      </div>

      <Separator className="mb-6" />

      {!summary ? (
        <p className="text-sm text-destructive" role="alert">
          {summaryRes.ok ? "No data" : summaryRes.error}
        </p>
      ) : (
        <AnalyticsDashboard
          initialSummary={summary}
          initialFunnel={funnel}
          initialMatches={matches}
          initialSources={sources}
        />
      )}
    </div>
  );
}
