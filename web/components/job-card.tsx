"use client";

import { MapPin, Banknote, Clock } from "lucide-react";
import type { JobPublic } from "@/lib/jobs";
import { formatSalaryCents } from "@/lib/jobs";
import { MatchScoreBadge } from "@/components/match-score-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  job: JobPublic;
  onSelect: (job: JobPublic) => void;
  selected?: boolean;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function JobCard({ job, onSelect, selected }: Props) {
  const salary = formatSalaryCents(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency ?? "USD",
  );
  const locationLabel = job.isRemote
    ? job.location
      ? `${job.location} · Remote`
      : "Remote"
    : job.location ?? "Location TBD";

  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      className={cn(
        "w-full cursor-pointer rounded-lg border bg-card text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring",
      )}
      aria-label={`${job.title} at ${job.company}${job.score ? `, ${Math.round(job.score.overall)} percent match` : ""}`}
    >
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold uppercase">
          {job.company.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold">{job.title}</h3>
              <p className="truncate text-sm text-muted-foreground">
                {job.company}
              </p>
            </div>
            {job.score ? (
              <MatchScoreBadge score={job.score.overall} size="sm" />
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Unscored
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {locationLabel}
            </span>
            {salary && (
              <span className="flex items-center gap-1">
                <Banknote className="h-3.5 w-3.5" aria-hidden />
                {salary}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {relativeTime(job.collectedAt)}
            </span>
            <Badge variant="secondary" className="text-xs font-normal">
              {job.source}
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}
