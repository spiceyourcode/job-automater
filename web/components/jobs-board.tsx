"use client";

import { useMemo, useState, useTransition } from "react";
import { Inbox, Plus, Search } from "lucide-react";
import type { JobPublic } from "@/lib/jobs";
import { listJobsAction } from "@/lib/actions/jobs";
import { JobCard } from "@/components/job-card";
import { JobDetailDialog } from "@/components/job-detail-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  initialJobs: JobPublic[];
};

export function JobsBoard({ initialJobs }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [sort, setSort] = useState<"score" | "date">("score");
  const [minScore, setMinScore] = useState<string>("0");
  const [q, setQ] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [selected, setSelected] = useState<JobPublic | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = (next?: {
    sort?: "score" | "date";
    minScore?: string;
    q?: string;
    remoteOnly?: boolean;
  }) => {
    const s = next?.sort ?? sort;
    const ms = next?.minScore ?? minScore;
    const query = next?.q ?? q;
    const remote = next?.remoteOnly ?? remoteOnly;
    startTransition(async () => {
      const min = Number(ms);
      const result = await listJobsAction({
        sort: s,
        minScore: Number.isFinite(min) && min > 0 ? min : undefined,
        q: query.trim() || undefined,
        remoteOnly: remote || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setJobs(result.data?.jobs ?? []);
    });
  };

  const heading = useMemo(() => {
    if (jobs.length === 0) return "No matches";
    return `${jobs.length} match${jobs.length === 1 ? "" : "es"}`;
  }, [jobs.length]);

  if (initialJobs.length === 0 && jobs.length === 0 && !q && minScore === "0" && !remoteOnly) {
    return (
      <EmptyState
        icon={<Inbox className="h-8 w-8" aria-hidden />}
        title="No job matches yet"
        description="Connect a source to start collecting openings. We’ll score them against your profile and surface the best fits here."
        action={{
          label: "Add sources",
          href: "/settings/sources",
          icon: <Plus className="mr-2 h-4 w-4" aria-hidden />,
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          refresh();
        }}
        aria-label="Filter job matches"
      >
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="jobs-q">Search</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="jobs-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Title or company"
              className="pl-8"
            />
          </div>
        </div>
        <div className="w-full space-y-1.5 sm:w-36">
          <Label htmlFor="jobs-sort">Sort</Label>
          <Select
            value={sort}
            onValueChange={(v) => {
              const next = v as "score" | "date";
              setSort(next);
              refresh({ sort: next });
            }}
          >
            <SelectTrigger id="jobs-sort" className="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Match score</SelectItem>
              <SelectItem value="date">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full space-y-1.5 sm:w-36">
          <Label htmlFor="jobs-min-score">Min score</Label>
          <Select
            value={minScore}
            onValueChange={(v) => {
              setMinScore(v);
              refresh({ minScore: v });
            }}
          >
            <SelectTrigger id="jobs-min-score" className="w-full cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any</SelectItem>
              <SelectItem value="50">50+</SelectItem>
              <SelectItem value="70">70+</SelectItem>
              <SelectItem value="85">85+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Checkbox
            id="jobs-remote"
            checked={remoteOnly}
            onCheckedChange={(c) => {
              const next = c === true;
              setRemoteOnly(next);
              refresh({ remoteOnly: next });
            }}
          />
          <Label htmlFor="jobs-remote" className="cursor-pointer font-normal">
            Remote only
          </Label>
        </div>
        <Button type="submit" size="sm" className="cursor-pointer" disabled={pending}>
          {pending ? "Updating…" : "Apply"}
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {heading}
      </p>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-8 w-8" aria-hidden />}
          title="No jobs match these filters"
          description="Try lowering the minimum score or clearing search."
        />
      ) : (
        <ul className="space-y-2" aria-label="Job matches">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard
                job={job}
                selected={selected?.id === job.id}
                onSelect={(j) => {
                  setSelected(j);
                  setOpen(true);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <JobDetailDialog
        job={selected}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSelected(null);
        }}
      />
    </div>
  );
}
