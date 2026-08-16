"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveApplicationAction,
  downloadDocAction,
  getApplicationAction,
  markReviewedAction,
  regenerateApplicationAction,
  setTemplateAction,
  updateBulletsAction,
  regenerateSectionAction,
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
import { Check, RotateCcw, X } from "lucide-react";

type Props = {
  applicationId: string;
  initial: {
    application: ApplicationPublic;
    job: { id: string; title: string; company: string } | null;
  };
};

const GEN_ERROR_HELP: Record<string, { title: string; body: string }> = {
  no_cv_chunks: {
    title: "No indexed CV chunks",
    body: "Document generation needs searchable pieces of your CV. Upload a CV (or re-index) under Settings → CV & Documents, wait until indexing finishes, then regenerate.",
  },
  grounding_failed: {
    title: "Grounding check failed",
    body: "Draft text could not be verified against your CV (HG-9). Try regenerate. If it keeps failing, re-upload your CV.",
  },
  job_not_found: {
    title: "Job missing",
    body: "The linked job could not be loaded. Return to the dashboard and open the match again.",
  },
  job_mismatch: {
    title: "Job mismatch",
    body: "This application no longer matches its job. Create a new application from the job card.",
  },
};

function generationStage(elapsedSec: number): string {
  if (elapsedSec < 4) return "Queued for the document worker";
  if (elapsedSec < 12) return "Reading your indexed CV chunks";
  if (elapsedSec < 30) return "Drafting tailored CV and cover letter";
  if (elapsedSec < 60) return "Validating every bullet against your CV (HG-9)";
  return "Still working — large CVs or a busy worker can take a minute";
}

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
  const [elapsedSec, setElapsedSec] = useState(0);

  const ready = Boolean(app.tailoredCvContent && app.coverLetterContent);
  const genError = app.generationError ?? null;
  const failed =
    Boolean(genError) || app.documentsStatus === "failed" || Boolean(
      app.generationModel?.startsWith("error:"),
    );
  const generating = !ready && !failed;

  const refreshApp = async () => {
    try {
      const res = await getApplicationAction(applicationId);
      if (res.ok && res.data?.application) {
        setApp(res.data.application);
        if (res.data.application.cvTemplate) {
          setTemplate(
            res.data.application.cvTemplate as "modern" | "classic" | "minimal",
          );
        }
      }
    } catch {
      // ignore transport errors while polling
    }
  };

  // Poll until documents arrive or generation fails
  useEffect(() => {
    if (!generating) return;
    void refreshApp();
    const t = setInterval(() => void refreshApp(), 2000);
    const onReady = () => void refreshApp();
    window.addEventListener("jobautomater:documents", onReady);
    return () => {
      clearInterval(t);
      window.removeEventListener("jobautomater:documents", onReady);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, generating]);

  useEffect(() => {
    if (!generating) {
      setElapsedSec(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [generating, applicationId, app.updatedAt]);

  const reviewed = Boolean(app.documentsReviewedAt);
  const canApprove = Boolean(app.canApprove ?? app.canApply);
  const approved = Boolean(app.approvedAt) || app.status === "approved";
  const traces = app.bulletTraces ?? [];
  const pendingCount = traces.filter(
    (t) => !t.status || t.status === "pending",
  ).length;
  const sections = Array.from(new Set(traces.map((t) => t.section)));
  const errorCode =
    genError ||
    (app.generationModel?.startsWith("error:")
      ? app.generationModel.slice("error:".length)
      : null);
  const errorHelp = errorCode
    ? GEN_ERROR_HELP[errorCode] ?? {
        title: "Document generation failed",
        body: `Worker reported: ${errorCode}. Fix the issue, then regenerate.`,
      }
    : null;

  const setBulletStatus = (
    index: number,
    status: "accepted" | "rejected" | "pending",
  ) => {
    const next = traces.map((t, i) =>
      i === index ? { ...t, status } : { ...t, status: t.status ?? "pending" },
    );
    setApp((a) => ({ ...a, bulletTraces: next, documentsReviewedAt: null }));
    startTransition(async () => {
      const res = await updateBulletsAction(applicationId, next);
      if (!res.ok) setError(res.error);
      else if (res.data?.application) setApp(res.data.application);
    });
  };

  const markLocalPending = () => {
    setApp((a) => ({
      ...a,
      tailoredCvContent: null,
      coverLetterContent: null,
      documentsReviewedAt: null,
      canApply: false,
      canApprove: false,
      generationError: null,
      documentsStatus: "pending",
      generationModel: "pending",
    }));
    setElapsedSec(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Review documents
          </h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {job
              ? `${job.title} at ${job.company}`
              : "Application draft"}{" "}
            · Status: {app.status}
            {generating && " · Generating…"}
            {failed && " · Generation failed"}
            {ready && " · Ready for review"}
          </p>
        </div>
        <div className="w-full space-y-1.5 sm:w-48">
          <Label htmlFor="cv-template">Template</Label>
          <Select
            value={template}
            disabled={pending || generating}
            onValueChange={(v) => {
              const next = v as "modern" | "classic" | "minimal";
              setTemplate(next);
              setError(null);
              markLocalPending();
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
                  documentsStatus: "pending",
                  generationModel: "pending",
                  generationError: null,
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

      {failed && errorHelp ? (
        <div
          className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">{errorHelp.title}</p>
          <p className="text-sm text-muted-foreground">{errorHelp.body}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="cursor-pointer">
              <Link href="/settings/cv">Open CV & Documents</Link>
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => {
                setError(null);
                markLocalPending();
                startTransition(async () => {
                  const res = await regenerateApplicationAction(applicationId);
                  if (!res.ok) setError(res.error);
                });
              }}
            >
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}

      {generating ? (
        <div className="space-y-4">
          <div
            className="rounded-md border bg-muted/40 p-4"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="text-sm font-medium">
              Tailoring your CV and cover letter ({template} template)
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {generationStage(elapsedSec)}
              {elapsedSec > 0 ? ` · ${elapsedSec}s` : null}
            </p>
            <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
              <li>{elapsedSec >= 0 ? "✓" : "·"} Queue worker</li>
              <li>{elapsedSec >= 4 ? "✓" : "·"} Load CV chunks</li>
              <li>{elapsedSec >= 12 ? "✓" : "·"} Draft CV + cover letter</li>
              <li>{elapsedSec >= 30 ? "✓" : "·"} Grounding validation</li>
            </ol>
            {elapsedSec >= 45 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Taking longer than usual? Confirm your CV is indexed under{" "}
                <Link href="/settings/cv" className="underline">
                  Settings → CV & Documents
                </Link>
                .
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2" aria-hidden>
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Tailored CV (preview)</p>
              <div className="space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-[83%] animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-medium">Cover letter (preview)</p>
              <div className="space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-[80%] animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ready ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section
            aria-labelledby="orig-cv-heading"
            className="rounded-lg border p-4"
          >
            <h2 id="orig-cv-heading" className="mb-2 text-sm font-medium">
              Source grounding
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Accept or reject each bullet (HG-9). Confirm review stays disabled
              until none are pending.
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm text-muted-foreground">
              {traces.map((t, i) => {
                const status = t.status ?? "pending";
                return (
                  <li
                    key={`${t.chunkId}-${i}`}
                    className="rounded border p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-mono text-xs text-foreground/70">
                          {t.section} · {status}
                        </span>
                        <p className="mt-1 text-foreground/90">{t.text}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant={status === "accepted" ? "default" : "outline"}
                          className="h-8 w-8 cursor-pointer"
                          disabled={pending}
                          aria-label="Accept bullet"
                          onClick={() => setBulletStatus(i, "accepted")}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant={
                            status === "rejected" ? "destructive" : "outline"
                          }
                          className="h-8 w-8 cursor-pointer"
                          disabled={pending}
                          aria-label="Reject bullet"
                          onClick={() => setBulletStatus(i, "rejected")}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {sections.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sections.map((section) => (
                  <Button
                    key={section}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={pending}
                    onClick={() => {
                      markLocalPending();
                      startTransition(async () => {
                        const res = await regenerateSectionAction(
                          applicationId,
                          section,
                        );
                        if (!res.ok) setError(res.error);
                        else {
                          setApp((a) => ({
                            ...a,
                            ...(res.data?.application ?? {}),
                            tailoredCvContent: null,
                            coverLetterContent: null,
                            documentsReviewedAt: null,
                            canApply: false,
                            documentsStatus: "pending",
                            generationModel: "pending",
                            generationError: null,
                          }));
                        }
                      });
                    }}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Regen {section}
                  </Button>
                ))}
              </div>
            )}
            {pendingCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {pendingCount} bullet{pendingCount === 1 ? "" : "s"} still
                pending.
              </p>
            )}
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
      ) : null}

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={(!ready && !failed) || pending}
          onClick={() => {
            setError(null);
            markLocalPending();
            startTransition(async () => {
              const res = await regenerateApplicationAction(applicationId);
              if (!res.ok) setError(res.error);
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
          variant="outline"
          className="cursor-pointer"
          disabled={!reviewed || pending}
          onClick={() => {
            startTransition(async () => {
              const res = await downloadDocAction(applicationId, "zip");
              if (!res.ok || !res.data?.url) {
                setError(!res.ok ? res.error : "Download failed");
              } else {
                window.open(res.data.url, "_blank", "noopener,noreferrer");
              }
            });
          }}
        >
          Download ZIP pack
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={!ready || reviewed || pending || pendingCount > 0}
          title={
            pendingCount > 0
              ? "Accept or reject every bullet first"
              : undefined
          }
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
