"use client";

import {
  Banknote,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { JobPublic } from "@/lib/jobs";
import { formatSalaryCents } from "@/lib/jobs";
import { createApplicationAction } from "@/lib/actions/applications";
import { MatchScoreBadge } from "@/components/match-score-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useState, useTransition } from "react";

type Props = {
  job: JobPublic | null;
  open: boolean;
  similar?: JobPublic[];
  onOpenChange: (open: boolean) => void;
  onToggleSave?: (job: JobPublic) => void;
  onSelectSimilar?: (job: JobPublic) => void;
};

const BREAKDOWN: Array<{
  key: keyof NonNullable<JobPublic["score"]>;
  label: string;
}> = [
  { key: "skillMatch", label: "Skills" },
  { key: "experienceMatch", label: "Experience" },
  { key: "locationMatch", label: "Location" },
  { key: "salaryMatch", label: "Salary" },
  { key: "cultureMatch", label: "Culture" },
];

export function JobDetailDialog({
  job,
  open,
  similar = [],
  onOpenChange,
  onToggleSave,
  onSelectSimilar,
}: Props) {
  const router = useRouter();
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!job) return null;

  const salary = formatSalaryCents(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency ?? "USD",
  );
  const locationLabel = job.isRemote
    ? job.location
      ? `${job.location} (Remote)`
      : "Remote"
    : (job.location ?? "Location TBD");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-xl">{job.title}</DialogTitle>
              <DialogDescription className="text-base text-foreground/80">
                {job.company}
              </DialogDescription>
            </div>
            {job.score && <MatchScoreBadge score={job.score.overall} size="lg" />}
          </div>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" aria-hidden />
            {locationLabel}
          </span>
          {salary && (
            <span className="flex items-center gap-1">
              <Banknote className="h-4 w-4" aria-hidden />
              {salary}
            </span>
          )}
        </div>

        {job.score && (
          <>
            <Separator />
            <section aria-labelledby="match-breakdown-heading">
              <h3
                id="match-breakdown-heading"
                className="mb-3 text-sm font-medium"
              >
                Match breakdown
              </h3>
              <ul className="space-y-3">
                {BREAKDOWN.map(({ key, label }) => {
                  const value = job.score?.[key];
                  if (typeof value !== "number") return null;
                  return (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.round(value)}%
                        </span>
                      </div>
                      <Progress
                        value={value}
                        aria-label={`${label} ${Math.round(value)} percent`}
                      />
                    </li>
                  );
                })}
              </ul>

              <Collapsible
                open={reasoningOpen}
                onOpenChange={setReasoningOpen}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer px-0"
                    aria-expanded={reasoningOpen}
                  >
                    {reasoningOpen ? "Hide reasoning" : "View reasoning"}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="mt-2 rounded-md border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                    {job.score.reasoning}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </section>
          </>
        )}

        {job.description && (
          <>
            <Separator />
            <section aria-labelledby="job-desc-heading">
              <h3 id="job-desc-heading" className="mb-2 text-sm font-medium">
                Description
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {job.description}
              </p>
            </section>
          </>
        )}

        {similar.length > 0 && (
          <>
            <Separator />
            <section aria-labelledby="similar-jobs-heading">
              <h3 id="similar-jobs-heading" className="mb-2 text-sm font-medium">
                Similar jobs
              </h3>
              <ul className="space-y-1">
                {similar.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                      onClick={() => onSelectSimilar?.(s)}
                    >
                      <span className="font-medium">{s.title}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {s.company}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {genError && (
          <p className="text-sm text-destructive" role="alert">
            {genError}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={pending}
            onClick={() => {
              setGenError(null);
              startTransition(async () => {
                const res = await createApplicationAction(job.id);
                if (!res.ok || !res.data?.application) {
                  setGenError(
                    !res.ok ? res.error : "Could not start generation",
                  );
                  return;
                }
                onOpenChange(false);
                router.push(`/applications/${res.data.application.id}/review`);
              });
            }}
          >
            {pending ? "Starting…" : "Generate documents"}
          </Button>
          {onToggleSave && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => onToggleSave(job)}
            >
              {job.isSaved ? (
                <>
                  <BookmarkCheck className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Save
                </>
              )}
            </Button>
          )}
          {job.applicationUrl && (
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open posting
                <ExternalLink className="ml-2 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
