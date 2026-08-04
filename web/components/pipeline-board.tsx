"use client";

import { useMemo, useState, useTransition } from "react";
import {
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

export function PipelineBoard({ initial }: Props) {
  const [apps, setApps] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const move = (id: string, stage: PipelineStage) => {
    setError(null);
    startTransition(async () => {
      const res = await updateApplicationStageAction(id, stage);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.application) {
        setApps((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...res.data!.application,
                  jobTitle: a.jobTitle,
                  jobCompany: a.jobCompany,
                }
              : a,
          ),
        );
      }
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
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
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
                  <p className="text-sm font-medium leading-snug">
                    {app.jobCompany ?? "Company"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {app.jobTitle ?? "Role"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {app.status}
                    {app.submitError ? ` · ${app.submitError}` : ""}
                  </p>
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
                  {app.status === "draft" ? null : (
                    <Button
                      asChild
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto px-0 text-xs"
                    >
                      <a href={`/applications/${app.id}/review`}>Documents</a>
                    </Button>
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
