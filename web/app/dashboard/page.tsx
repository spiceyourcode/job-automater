import { logoutAction } from "@/lib/actions/auth";
import { listApplicationsAction } from "@/lib/actions/applications";
import { listJobsAction } from "@/lib/actions/jobs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JobsBoard } from "@/components/jobs-board";
import { PipelineBoard } from "@/components/pipeline-board";

export default async function DashboardPage() {
  const [jobsResult, appsResult] = await Promise.all([
    listJobsAction({ sort: "score" }),
    listApplicationsAction(),
  ]);
  const jobs = jobsResult.ok ? (jobsResult.data?.jobs ?? []) : [];
  const applications = appsResult.ok
    ? (appsResult.data?.applications ?? [])
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
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

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Ranked matches and your application pipeline.
          </p>
        </div>

        <Separator className="mb-6" />

        <section aria-labelledby="pipeline-heading" className="mb-10">
          <h2 id="pipeline-heading" className="mb-4 text-lg font-medium">
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

        <section aria-labelledby="jobs-heading">
          <h2 id="jobs-heading" className="mb-4 text-lg font-medium">
            Top matches
          </h2>
          {!jobsResult.ok ? (
            <p className="text-sm text-destructive" role="alert">
              {jobsResult.error}
            </p>
          ) : (
            <JobsBoard initialJobs={jobs} />
          )}
        </section>
      </main>
    </div>
  );
}
