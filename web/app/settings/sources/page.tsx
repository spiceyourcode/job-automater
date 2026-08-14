import { SourcesManager } from "@/components/sources-manager";
import { GmailConnect } from "@/components/gmail-connect";
import { listSourcesAction } from "@/lib/actions/sources";
import { Suspense } from "react";

export default async function SourcesSettingsPage() {
  const listed = await listSourcesAction();
  const sources = listed.ok && listed.data ? listed.data.sources : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Job sources</h1>
        <p className="text-sm text-muted-foreground">
          Add feeds and mailboxes, then use Run now to enqueue collection.
        </p>
      </div>

      <Suspense fallback={null}>
        <GmailConnect />
      </Suspense>

      {!listed.ok && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {listed.error}
        </p>
      )}

      <SourcesManager initialSources={sources} />
    </div>
  );
}
