import { PipelineBoard } from "@/components/pipeline-board";
import { listApplicationsAction } from "@/lib/actions/applications";

export default async function ApplicationsPage() {
  const appsResult = await listApplicationsAction();
  const applications = appsResult.ok
    ? (appsResult.data?.applications ?? [])
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline board for drafts, interviews, and follow-ups.
        </p>
      </div>
      {!appsResult.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {appsResult.error}
        </p>
      ) : (
        <PipelineBoard initial={applications} />
      )}
    </div>
  );
}
