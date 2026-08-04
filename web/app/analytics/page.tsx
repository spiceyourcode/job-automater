import { logoutAction } from "@/lib/actions/auth";
import {
  getAnalyticsDashboardAction,
  getMatchQualityAction,
  getPipelineFunnelAction,
  getSourcePerformanceAction,
} from "@/lib/actions/analytics";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            JobAutomater
          </span>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/dashboard">Dashboard</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/settings/sources">Sources</a>
            </Button>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
              >
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
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
      </main>
    </div>
  );
}
