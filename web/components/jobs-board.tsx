"use client";

import { useMemo, useState, useTransition } from "react";
import { Inbox, Plus, Search, Sparkles } from "lucide-react";
import type { JobPublic } from "@/lib/jobs";
import {
  getJobStatsAction,
  importJobAction,
  listJobsAction,
  listSimilarJobsAction,
  saveJobAction,
  unsaveJobAction,
} from "@/lib/actions/jobs";
import { bulkGenerateAction } from "@/lib/actions/applications";
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
  const [source, setSource] = useState<string>("all");
  const [location, setLocation] = useState("");
  const [salaryMinK, setSalaryMinK] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [statsLine, setStatsLine] = useState<string | null>(null);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [selected, setSelected] = useState<JobPublic | null>(null);
  const [similar, setSimilar] = useState<JobPublic[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = (next?: {
    sort?: "score" | "date";
    minScore?: string;
    q?: string;
    remoteOnly?: boolean;
    source?: string;
    location?: string;
    salaryMinK?: string;
    status?: string;
    savedOnly?: boolean;
  }) => {
    const s = next?.sort ?? sort;
    const ms = next?.minScore ?? minScore;
    const query = next?.q ?? q;
    const remote = next?.remoteOnly ?? remoteOnly;
    const src = next?.source ?? source;
    const loc = next?.location ?? location;
    const salK = next?.salaryMinK ?? salaryMinK;
    const st = next?.status ?? status;
    const saved = next?.savedOnly ?? savedOnly;
    startTransition(async () => {
      const min = Number(ms);
      const salMin = Number(salK);
      const result = await listJobsAction({
        sort: s,
        minScore: Number.isFinite(min) && min > 0 ? min : undefined,
        q: query.trim() || undefined,
        remoteOnly: remote || undefined,
        source: src !== "all" ? src : undefined,
        location: loc.trim() || undefined,
        salaryMin:
          Number.isFinite(salMin) && salMin > 0
            ? Math.round(salMin * 1000 * 100)
            : undefined,
        status: st !== "all" ? st : undefined,
        savedOnly: saved || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setJobs(result.data?.jobs ?? []);
      const stats = await getJobStatsAction();
      if (stats.ok && stats.data) {
        setStatsLine(
          `${stats.data.total} jobs · ${stats.data.scored} scored · ${stats.data.saved} saved`,
        );
        setSourceOptions(stats.data.bySource.map((x) => x.source));
      }
    });
  };

  const openJob = (job: JobPublic) => {
    setSelected(job);
    setOpen(true);
    setSimilar([]);
    startTransition(async () => {
      const res = await listSimilarJobsAction(job.id, 5);
      if (res.ok) setSimilar(res.data?.jobs ?? []);
    });
  };

  const toggleSave = (job: JobPublic) => {
    startTransition(async () => {
      const nextSaved = !job.isSaved;
      const res = nextSaved
        ? await saveJobAction(job.id)
        : await unsaveJobAction(job.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const patch = (j: JobPublic) =>
        j.id === job.id ? { ...j, isSaved: nextSaved } : j;
      setJobs((prev) => prev.map(patch));
      setSelected((prev) => (prev ? patch(prev) : prev));
      setSimilar((prev) => prev.map(patch));
    });
  };

  const heading = useMemo(() => {
    if (jobs.length === 0) return "No matches";
    return `${jobs.length} match${jobs.length === 1 ? "" : "es"}`;
  }, [jobs.length]);

  if (
    initialJobs.length === 0 &&
    jobs.length === 0 &&
    !q &&
    minScore === "0" &&
    !remoteOnly &&
    !importMsg
  ) {
    return (
      <div className="space-y-6">
        <ImportBar
          importUrl={importUrl}
          setImportUrl={setImportUrl}
          pending={pending}
          importMsg={importMsg}
          onImport={() => {
            const url = importUrl.trim();
            if (!url) return;
            startTransition(async () => {
              setImportMsg(null);
              const res = await importJobAction(url);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setError(null);
              setImportUrl("");
              setImportMsg(
                res.data?.deduped
                  ? "That URL was already imported."
                  : "Job imported — scoring in progress.",
              );
              if (res.data?.job) {
                setJobs((prev) => [res.data!.job, ...prev]);
                openJob(res.data.job);
              }
            });
          }}
        />
        <EmptyState
          icon={<Inbox className="h-8 w-8" aria-hidden />}
          title="No job matches yet"
          description="Paste a job URL above, or connect a source to start collecting openings."
          action={{
            label: "Add sources",
            href: "/settings/sources",
            icon: <Plus className="mr-2 h-4 w-4" aria-hidden />,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ImportBar
        importUrl={importUrl}
        setImportUrl={setImportUrl}
        pending={pending}
        importMsg={importMsg}
        onImport={() => {
          const url = importUrl.trim();
          if (!url) return;
          startTransition(async () => {
            setImportMsg(null);
            const res = await importJobAction(url);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setError(null);
            setImportUrl("");
            setImportMsg(
              res.data?.deduped
                ? "That URL was already imported."
                : "Job imported — scoring in progress.",
            );
            refresh({ sort: "date" });
            setSort("date");
            if (res.data?.job) openJob(res.data.job);
          });
        }}
      />

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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => setMoreFilters((v) => !v)}
        >
          {moreFilters ? "Fewer filters" : "More filters"}
        </Button>
        <Button type="submit" size="sm" className="cursor-pointer" disabled={pending}>
          {pending ? "Updating…" : "Apply"}
        </Button>
      </form>

      {moreFilters && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full space-y-1.5 sm:w-40">
            <Label htmlFor="jobs-source">Source</Label>
            <Select
              value={source}
              onValueChange={(v) => {
                setSource(v);
                refresh({ source: v });
              }}
            >
              <SelectTrigger id="jobs-source" className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any source</SelectItem>
                {sourceOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem] flex-1 space-y-1.5">
            <Label htmlFor="jobs-location">Location</Label>
            <Input
              id="jobs-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or region"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-36">
            <Label htmlFor="jobs-salary-min">Min salary ($k)</Label>
            <Input
              id="jobs-salary-min"
              inputMode="numeric"
              value={salaryMinK}
              onChange={(e) => setSalaryMinK(e.target.value)}
              placeholder="80"
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-36">
            <Label htmlFor="jobs-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                refresh({ status: v });
              }}
            >
              <SelectTrigger id="jobs-status" className="w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="scored">Scored</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="jobs-saved"
              checked={savedOnly}
              onCheckedChange={(c) => {
                const next = c === true;
                setSavedOnly(next);
                refresh({ savedOnly: next });
              }}
            />
            <Label htmlFor="jobs-saved" className="cursor-pointer font-normal">
              Saved only
            </Label>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {statsLine ?? heading}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setBulkMsg(null);
              const min = Number(minScore);
              const res = await bulkGenerateAction(
                10,
                Number.isFinite(min) && min > 0 ? min : undefined,
              );
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setError(null);
              setBulkMsg(
                `Queued ${res.data?.count ?? 0} draft document packs (no submit).`,
              );
            });
          }}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
          Generate top 10 drafts
        </Button>
        {bulkMsg && (
          <p className="text-sm text-muted-foreground" role="status">
            {bulkMsg}
          </p>
        )}
      </div>

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
                onSelect={openJob}
              />
            </li>
          ))}
        </ul>
      )}

      <JobDetailDialog
        job={selected}
        open={open}
        similar={similar}
        onToggleSave={toggleSave}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setSelected(null);
            setSimilar([]);
          }
        }}
        onSelectSimilar={openJob}
      />
    </div>
  );
}

function ImportBar({
  importUrl,
  setImportUrl,
  pending,
  importMsg,
  onImport,
}: {
  importUrl: string;
  setImportUrl: (v: string) => void;
  pending: boolean;
  importMsg: string | null;
  onImport: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          onImport();
        }}
        aria-label="Import job from URL"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="jobs-import-url">Import job URL</Label>
          <Input
            id="jobs-import-url"
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://company.com/careers/role"
          />
        </div>
        <Button type="submit" size="sm" className="cursor-pointer" disabled={pending || !importUrl.trim()}>
          {pending ? "Importing…" : "Import"}
        </Button>
      </form>
      {importMsg && (
        <p className="text-sm text-muted-foreground" role="status">
          {importMsg}
        </p>
      )}
    </div>
  );
}
