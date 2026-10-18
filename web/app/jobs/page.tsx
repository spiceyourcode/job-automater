import { JobsBoard } from "@/components/jobs-board";
import { listJobsAction } from "@/lib/actions/jobs";

type Props = {
  searchParams: Promise<{ q?: string; job?: string }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const { q: qParam, job: jobParam } = await searchParams;
  const initialQ = qParam?.trim() ?? "";
  const initialJobId = jobParam?.trim() || undefined;

  // The jobs API only returns jobs collected in the last 5 days.
  const jobsResult = await listJobsAction({
    sort: "score",
    q: initialQ || undefined,
  });
  const jobs = jobsResult.ok ? (jobsResult.data?.jobs ?? []) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Scored matches collected from your sources in the last 5 days. Filter and open a role to apply.
        </p>
      </div>
      {!jobsResult.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {jobsResult.error}
        </p>
      ) : (
        <JobsBoard
          key={`${initialQ}:${initialJobId ?? ""}`}
          initialJobs={jobs}
          initialQ={initialQ}
          initialJobId={initialJobId}
        />
      )}
    </div>
  );
}
