"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  downloadDocAction,
  getApplicationAction,
  markReviewedAction,
  regenerateApplicationAction,
  type ApplicationPublic,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  applicationId: string;
  initial: {
    application: ApplicationPublic;
    job: { id: string; title: string; company: string } | null;
  };
};

export function DocumentReviewPanel({ applicationId, initial }: Props) {
  const router = useRouter();
  const [app, setApp] = useState(initial.application);
  const [job] = useState(initial.job);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Poll until documents arrive
  useEffect(() => {
    if (app.tailoredCvContent && app.coverLetterContent) return;
    const t = setInterval(() => {
      startTransition(async () => {
        const res = await getApplicationAction(applicationId);
        if (res.ok && res.data?.application) {
          setApp(res.data.application);
        }
      });
    }, 2000);
    return () => clearInterval(t);
  }, [applicationId, app.tailoredCvContent, app.coverLetterContent]);

  const ready = Boolean(app.tailoredCvContent && app.coverLetterContent);
  const reviewed = Boolean(app.documentsReviewedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Review documents
        </h1>
        <p className="text-sm text-muted-foreground">
          {job
            ? `${job.title} at ${job.company}`
            : "Application draft"}{" "}
          · Status: {app.status}
          {!ready && " · Generating…"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!ready ? (
        <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          Tailoring your CV and cover letter from your CV chunks. This page
          refreshes automatically.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby="orig-cv-heading"
            className="rounded-lg border p-4"
          >
            <h2 id="orig-cv-heading" className="mb-2 text-sm font-medium">
              Source grounding
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Every bullet is traced to a CV chunk (HG-9).
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-muted-foreground">
              {(app.bulletTraces ?? []).map((t, i) => (
                <li key={`${t.chunkId}-${i}`} className="rounded border p-2">
                  <span className="font-mono text-xs text-foreground/70">
                    {t.section}
                  </span>
                  <p className="mt-1">{t.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="tailored-heading"
            className="space-y-4 md:col-span-1"
          >
            <div className="rounded-lg border p-4">
              <h2 id="tailored-heading" className="mb-2 text-sm font-medium">
                Tailored CV
              </h2>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                {app.tailoredCvContent}
              </pre>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="mb-2 text-sm font-medium">Cover letter</h2>
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                {app.coverLetterContent}
              </pre>
            </div>
          </section>
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={!ready || pending}
          onClick={() => {
            startTransition(async () => {
              const res = await regenerateApplicationAction(applicationId);
              if (!res.ok) setError(res.error);
              else {
                setApp((a) => ({
                  ...a,
                  tailoredCvContent: null,
                  coverLetterContent: null,
                  documentsReviewedAt: null,
                  canApply: false,
                }));
              }
            });
          }}
        >
          Regenerate
        </Button>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={!reviewed || pending}
          onClick={() => {
            startTransition(async () => {
              const res = await downloadDocAction(applicationId, "cv");
              if (!res.ok || !res.data?.url) {
                setError(!res.ok ? res.error : "Download failed");
              } else {
                window.open(res.data.url, "_blank", "noopener,noreferrer");
              }
            });
          }}
        >
          Download CV
        </Button>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={!reviewed || pending}
          onClick={() => {
            startTransition(async () => {
              const res = await downloadDocAction(applicationId, "cl");
              if (!res.ok || !res.data?.url) {
                setError(!res.ok ? res.error : "Download failed");
              } else {
                window.open(res.data.url, "_blank", "noopener,noreferrer");
              }
            });
          }}
        >
          Download cover letter
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!ready || reviewed || pending}
          onClick={() => {
            startTransition(async () => {
              const res = await markReviewedAction(applicationId);
              if (!res.ok) setError(res.error);
              else if (res.data?.application) setApp(res.data.application);
            });
          }}
        >
          {reviewed ? "Reviewed" : "Confirm review"}
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!app.canApply}
          title={
            app.canApply
              ? "Continue to approval (Phase 4)"
              : "Confirm review before applying"
          }
          onClick={() => {
            if (!app.canApply) return;
            router.push(`/dashboard?apply=${applicationId}`);
          }}
        >
          Apply
        </Button>
      </div>
      {!app.canApply && (
        <p className="text-xs text-muted-foreground">
          Apply stays disabled until you confirm review. Submission still
          requires approval in a later step.
        </p>
      )}
    </div>
  );
}
