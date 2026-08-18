import { CvVersionsManager } from "@/components/cv-versions-manager";
import { listCvVersionsAction } from "@/lib/actions/profile";
import { getCvAbAction } from "@/lib/actions/analytics";

export default async function CvSettingsPage() {
  const listed = await listCvVersionsAction();
  const ab = await getCvAbAction();
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
  const variants = ab.ok ? (ab.data?.variants ?? []) : [];

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
      {variants.length > 0 ? (
        <section className="mt-10" aria-labelledby="ab-heading">
          <h2 id="ab-heading" className="text-lg font-medium">
            Resume A/B
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Response rate by CV version used on your applications.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {variants.map((v) => (
              <li key={v.cvVersion}>
                Version {v.cvVersion}: {v.submitted} submitted, {v.responses}{" "}
                responses ({v.responseRatePct}%)
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
