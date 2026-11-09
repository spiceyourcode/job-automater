import { SourcesManager } from "@/components/sources-manager";
import { GmailConnect } from "@/components/gmail-connect";
import { listSourceCatalogAction, listSourcesAction } from "@/lib/actions/sources";
import { Suspense } from "react";

export default async function SourcesSettingsPage() {
  const [listed, catalogListed] = await Promise.all([
    listSourcesAction(),
    listSourceCatalogAction(),
  ]);
  const sources = listed.ok && listed.data ? listed.data.sources : [];
  const catalogEntries =
    catalogListed.ok && catalogListed.data ? catalogListed.data.entries : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Job sources</h1>
        <p className="text-sm text-muted-foreground">
          Pick job boards from the catalog or add a custom feed — then Run now
          to collect.
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

      <SourcesManager
        initialSources={sources}
        catalogEntries={catalogEntries}
      />
    </div>
  );
}
