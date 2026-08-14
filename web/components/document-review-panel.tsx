"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveApplicationAction,
  downloadDocAction,
  getApplicationAction,
  markReviewedAction,
  regenerateApplicationAction,
  setTemplateAction,
  type ApplicationPublic,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [template, setTemplate] = useState<"modern" | "classic" | "minimal">(
    (initial.application.cvTemplate as "modern" | "classic" | "minimal") ||
      "modern",
  );
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
          if (res.data.application.cvTemplate) {
            setTemplate(
              res.data.application.cvTemplate as
                | "modern"
                | "classic"
                | "minimal",
            );
          }
        }
      });
    }, 2000);
    return () => clearInterval(t);
  }, [applicationId, app.tailoredCvContent, app.coverLetterContent]);

  const ready = Boolean(app.tailoredCvContent && app.coverLetterContent);
  const reviewed = Boolean(app.documentsReviewedAt);
  const canApprove = Boolean(app.canApprove ?? app.canApply);
  const approved = Boolean(app.approvedAt) || app.status === "approved";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="w-full space-y-1.5 sm:w-48">
          <Label htmlFor="cv-template">Template</Label>
          <Select
            value={template}
            disabled={pending}
            onValueChange={(v) => {
              const next = v as "modern" | "classic" | "minimal";
              setTemplate(next);
              setError(null);
              startTransition(async () => {
                const res = await setTemplateAction(applicationId, next, next);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setApp((a) => ({
                  ...a,
                  ...(res.data?.application ?? {}),
                  tailoredCvContent: null,
                  coverLetterContent: null,
                  documentsReviewedAt: null,
                  canApply: false,
                  canApprove: false,
                  cvTemplate: next,
                  clTemplate: next,
                }));
              });
            }}
          >
            <SelectTrigger id="cv-template" className="w-full cursor-pointer">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!ready ? (
        <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          Tailoring your CV and cover letter from your CV chunks ({template}{" "}
          template). This page refreshes automatically.
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
                Tailored CV ({template})
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
          disabled={!canApprove || pending || approved}
          title={
            approved
              ? "Already approved — submission queued"
              : canApprove
                ? "Approve and enqueue submission (HG-4)"
                : "Confirm review before approving"
          }
          onClick={() => {
            if (!canApprove) return;
            startTransition(async () => {
              const res = await approveApplicationAction(applicationId);
              if (!res.ok) setError(res.error);
              else if (res.data?.application) {
                setApp(res.data.application);
                router.push(`/dashboard?approved=${applicationId}`);
              }
            });
          }}
        >
          {approved ? "Approved" : "Approve & apply"}
        </Button>
      </div>
      {!canApprove && !approved && (
        <p className="text-xs text-muted-foreground">
          Approve stays disabled until you confirm review. Submission only
          runs after this approve call (HG-4).
        </p>
      )}
      {approved && (
        <p className="text-xs text-muted-foreground">
          Approved — submit worker will process this application.
        </p>
      )}
    </div>
  );
}
