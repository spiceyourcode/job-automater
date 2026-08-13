import { CvVersionsManager } from "@/components/cv-versions-manager";
import { listCvVersionsAction } from "@/lib/actions/profile";

export default async function CvSettingsPage() {
  const listed = await listCvVersionsAction();
  const versions =
    listed.ok && listed.data
      ? listed.data.versions.map((v) => ({
          ...v,
          createdAt:
            typeof v.createdAt === "string"
              ? v.createdAt
              : new Date(v.createdAt as unknown as string).toISOString(),
        }))
      : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">CV manager</h1>
        <p className="text-sm text-muted-foreground">
          Activate, download, reindex, or delete versions you own.
        </p>
      </div>
      {!listed.ok && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {listed.error}
        </p>
      )}
      <CvVersionsManager initialVersions={versions} />
    </div>
  );
}
