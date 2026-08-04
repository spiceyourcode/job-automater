import { Inbox, Radio } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { listJobsAction } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { JobsBoard } from "@/components/jobs-board";

export default async function DashboardPage() {
  const result = await listJobsAction({ sort: "score" });
  const jobs = result.ok ? (result.data?.jobs ?? []) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            JobAutomater
          </span>
          <nav className="flex items-center gap-2" aria-label="Account">
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
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ranked matches from your sources. Open a card for score breakdown
            and reasoning.
          </p>
        </div>

        <Separator className="mb-6" />

        <section aria-labelledby="jobs-heading">
          <h2 id="jobs-heading" className="mb-4 text-lg font-medium">
            Top matches
          </h2>
          {!result.ok ? (
            <p className="text-sm text-destructive" role="alert">
              {result.error}
            </p>
          ) : (
            <JobsBoard initialJobs={jobs} />
          )}
        </section>

        <Separator className="my-8" />

        <section aria-labelledby="apps-empty-heading">
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" aria-hidden />
            <h2 id="apps-empty-heading" className="font-medium text-foreground">
              Applications
            </h2>
          </div>
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title="No applications yet"
            description="Your pipeline is empty. Once matches arrive, generate documents and move roles into review."
          />
        </section>
      </main>
    </div>
  );
}
