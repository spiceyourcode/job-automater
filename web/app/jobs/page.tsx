import { JobsBoard } from "@/components/jobs-board";
import { listJobsAction } from "@/lib/actions/jobs";

export default async function JobsPage() {
  const jobsResult = await listJobsAction({ sort: "score" });
  const jobs = jobsResult.ok ? (jobsResult.data?.jobs ?? []) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Scored matches from your sources. Filter and open a role to apply.
        </p>
      </div>
      {!jobsResult.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {jobsResult.error}
        </p>
      ) : jobs.length > 0 ? (
        <JobsBoard initialJobs={jobs} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No scored jobs yet. Add sources and run collection to see matches
          here.
        </p>
      )}
    </div>
  );
}
