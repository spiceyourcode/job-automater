"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const mockJobs = [
  { title: "Senior Backend Engineer", company: "Northwind", score: 92, remote: true },
  { title: "Platform Engineer", company: "Lumen", score: 88, remote: true },
  { title: "Staff Python Developer", company: "Acme Labs", score: 81, remote: false },
];

export function LandingProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full max-w-lg mx-auto landing-fade-up landing-delay-2 lg:mx-0 lg:max-w-none",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-primary/5 blur-2xl"
        aria-hidden
      />
      <div className="landing-product-shell relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/5 dark:shadow-black/40">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.2_25)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.75_0.15_95)]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.65_0.15_145)]" aria-hidden />
          <span className="ml-2 flex-1 truncate rounded-md bg-background/80 px-3 py-1 text-[10px] text-muted-foreground">
            jobautomater.app/dashboard
          </span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Today&apos;s pipeline</p>
              <p className="text-lg font-semibold tracking-tight">Matched for you</p>
            </div>
            <Badge variant="secondary" className="font-normal">
              3 awaiting review
            </Badge>
          </div>

          <ul className="space-y-2" aria-hidden>
            {mockJobs.map((job) => (
              <li
                key={job.title}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3"
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                    job.score >= 90
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {job.score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{job.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {job.company}
                    {job.remote ? " · Remote" : ""}
                  </p>
                </div>
                <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
                  Review
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              Documents grounded in your CV ·{" "}
              <span className="font-medium text-foreground">Approve to apply</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
