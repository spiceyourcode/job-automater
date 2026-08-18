"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addInterviewAction,
  bulkActionAction,
  patchApplicationMetaAction,
  updateApplicationStageAction,
  type ApplicationPublic,
  type PipelineStage,
} from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLUMNS: Array<{ id: PipelineStage; label: string }> = [
  { id: "applied", label: "Applied" },
  { id: "screening", label: "Screening" },
  { id: "interviewing", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "archived", label: "Archived" },
];

type Props = {
  initial: ApplicationPublic[];
};

function stageOf(app: ApplicationPublic): PipelineStage | null {
  return app.pipelineStage ?? null;
}

function mergeApp(
  prev: ApplicationPublic,
  next: ApplicationPublic,
): ApplicationPublic {
  return {
    ...prev,
    ...next,
    jobTitle: prev.jobTitle,
    jobCompany: prev.jobCompany,
  };
}

export function PipelineBoard({ initial }: Props) {
  const [apps, setApps] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [interviewFor, setInterviewFor] = useState<string | null>(null);
  const [interviewStage, setInterviewStage] = useState("phone_screen");
  const [interviewWhen, setInterviewWhen] = useState("");
  const [announce, setAnnounce] = useState("");

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, ApplicationPublic[]> = {
      applied: [],
      screening: [],
      interviewing: [],
      offer: [],
      archived: [],
    };
    for (const app of apps) {
      const stage = stageOf(app);
      if (stage) map[stage].push(app);
    }
    return map;
  }, [apps]);

  const applyUpdate = (id: string, next: ApplicationPublic) => {
    setApps((prev) => prev.map((a) => (a.id === id ? mergeApp(a, next) : a)));
  };

  const move = (id: string, stage: PipelineStage) => {
    setError(null);
    startTransition(async () => {
      const res = await updateApplicationStageAction(id, stage);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.application) {
        applyUpdate(id, res.data.application);
        const label = COLUMNS.find((c) => c.id === stage)?.label ?? stage;
        setAnnounce(`Moved application to ${label}`);
      }
    });
  };

  const runBulk = (action: "archive" | "withdraw" | "followup") => {
    if (selectedIds.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await bulkActionAction(selectedIds, action);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (action === "archive" || action === "withdraw") {
        const status = action === "archive" ? "archived" : "withdrawn";
        setApps((prev) =>
          prev.map((a) =>
            selectedIds.includes(a.id)
              ? { ...a, status, pipelineStage: "archived" }
              : a,
          ),
        );
      }
      setSelected({});
    });
  };

  const pipelineApps = apps.filter((a) => stageOf(a) != null);

  if (pipelineApps.length === 0) {
    return (
      <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        No applications on the pipeline yet. Approve a reviewed draft to start
        the apply flow.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk("archive")}
        >
          Archive selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk("withdraw")}
        >
          Withdraw selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={pending || selectedIds.length === 0}
          onClick={() => runBulk("followup")}
        >
          Follow up in 7 days
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            aria-labelledby={`col-${col.id}`}
            className="min-w-[220px] flex-1 rounded-lg border bg-muted/20 p-3"
          >
            <h3
              id={`col-${col.id}`}
              className="mb-3 flex items-center justify-between text-sm font-medium"
            >
              <span>{col.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {byStage[col.id].length}
              </span>
            </h3>
            <ul className="space-y-2">
              {byStage[col.id].map((app) => (
                <li
                  key={app.id}
                  className="rounded-md border bg-background p-3 shadow-sm"
                >
                  <label className="mb-2 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 min-h-4 min-w-4 cursor-pointer"
                      checked={Boolean(selected[app.id])}
                      aria-label={`Select ${app.jobTitle ?? "application"} at ${app.jobCompany ?? ""}`}
                      onChange={(e) =>
                        setSelected((s) => ({
                          ...s,
                          [app.id]: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      <span className="block font-medium leading-snug">
                        {app.jobCompany ?? "Company"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {app.jobTitle ?? "Role"}
                      </span>
                    </span>
                  </label>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {app.status}
                    {app.submitError ? ` · ${app.submitError}` : ""}
                    {app.nextFollowupAt
                      ? ` · follow-up ${app.nextFollowupAt.slice(0, 10)}`
                      : ""}
                  </p>
                  {(app.interviewStages ?? []).length > 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {(app.interviewStages ?? []).length} interview
                      {(app.interviewStages ?? []).length === 1 ? "" : "s"}
                    </p>
                  ) : null}
                  <div className="mt-2">
                    <label className="sr-only" htmlFor={`move-${app.id}`}>
                      Move to stage
                    </label>
                    <Select
                      disabled={pending}
                      value={col.id}
                      onValueChange={(v) => move(app.id, v as PipelineStage)}
                    >
                      <SelectTrigger
                        id={`move-${app.id}`}
                        className="h-8 cursor-pointer text-xs"
                      >
                        <SelectValue placeholder="Move to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMNS.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-xs"
                      disabled={pending}
                      onClick={() => {
                        setInterviewFor(app.id);
                        setInterviewStage("phone_screen");
                        setInterviewWhen("");
                      }}
                    >
                      Interview
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-xs"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          const res = await bulkActionAction(
                            [app.id],
                            "withdraw",
                          );
                          if (!res.ok) setError(res.error);
                          else {
                            applyUpdate(app.id, {
                              ...app,
                              status: "withdrawn",
                              pipelineStage: "archived",
                            });
                          }
                        });
                      }}
                    >
                      Withdraw
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-xs"
                      disabled={pending}
                      onClick={() => {
                        const note = window.prompt(
                          "Notes",
                          app.userNotes ?? "",
                        );
                        if (note === null) return;
                        setError(null);
                        startTransition(async () => {
                          const res = await patchApplicationMetaAction(app.id, {
                            userNotes: note,
                          });
                          if (!res.ok) setError(res.error);
                          else if (res.data?.application) {
                            applyUpdate(app.id, res.data.application);
                          }
                        });
                      }}
                    >
                      Notes
                    </Button>
                  </div>
                  {interviewFor === app.id ? (
                    <form
                      className="mt-2 space-y-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!interviewWhen) return;
                        const scheduledAt = new Date(
                          interviewWhen,
                        ).toISOString();
                        setError(null);
                        startTransition(async () => {
                          const res = await addInterviewAction(app.id, {
                            stage: interviewStage,
                            scheduledAt,
                          });
                          if (!res.ok) setError(res.error);
                          else if (res.data?.application) {
                            applyUpdate(app.id, res.data.application);
                            setInterviewFor(null);
                          }
                        });
                      }}
                    >
                      <input
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        placeholder="Stage"
                        value={interviewStage}
                        onChange={(e) => setInterviewStage(e.target.value)}
                      />
                      <input
                        type="datetime-local"
                        className="h-8 w-full rounded-md border bg-background px-2 text-xs"
                        value={interviewWhen}
                        onChange={(e) => setInterviewWhen(e.target.value)}
                        required
                      />
                      <div className="flex gap-1">
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 cursor-pointer px-2 text-xs"
                          disabled={pending}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 cursor-pointer px-2 text-xs"
                          onClick={() => setInterviewFor(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : null}
                  {app.status === "draft" ? null : (
                    <nav
                      className="mt-1 flex flex-wrap items-center gap-x-1 text-xs"
                      aria-label="Application documents"
                    >
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-xs"
                      >
                        <a href={`/applications/${app.id}/review`}>Documents</a>
                      </Button>
                      <span className="text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-xs"
                      >
                        <a href={`/applications/${app.id}/prep`}>Prep</a>
                      </Button>
                      <span className="text-muted-foreground" aria-hidden>
                        ·
                      </span>
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-xs"
                      >
                        <a href={`/applications/${app.id}/video-script`}>
                          Video
                        </a>
                      </Button>
                    </nav>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
