"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { StatefulButton } from "@/components/ui/stateful-button";
import { AnimatedList } from "@/components/ui/animated-list";
import { BlurText } from "@/components/ui/blur-text";
import RubberSegment from "@/components/ui/rubber-segment";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateInterviewPrepAction,
  getInterviewPrepAction,
  type InterviewPrepPublic,
} from "@/lib/actions/applications";
import { formatSalaryCents } from "@/lib/jobs";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const PREP_SECTIONS = ["qa", "star", "nego"] as const;
type PrepSection = (typeof PREP_SECTIONS)[number];

const GEN_STEPS = [
  { text: "Reading CV chunks" },
  { text: "Building STAR stories" },
  { text: "Drafting Q&A and negotiation" },
];

const CATEGORY_STYLES: Record<string, string> = {
  company: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  behavioral: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  technical: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  negotiation: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

const STAR_FIELDS = [
  { key: "situation", label: "Situation", tone: "border-l-sky-500" },
  { key: "task", label: "Task", tone: "border-l-violet-500" },
  { key: "action", label: "Action", tone: "border-l-emerald-500" },
  { key: "result", label: "Result", tone: "border-l-amber-500" },
] as const;

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize",
        CATEGORY_STYLES[category] ??
          "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      {category}
    </Badge>
  );
}

export function InterviewPrepPanel({
  applicationId,
  initial,
  status,
}: {
  applicationId: string;
  initial: InterviewPrepPublic | null;
  status: string;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [prep, setPrep] = useState<InterviewPrepPublic | null>(initial);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [section, setSection] = useState<PrepSection>("qa");
  const generating =
    currentStatus === "pending" ||
    currentStatus === "generating" ||
    busy;

  const segmentItems = useMemo(
    () => [
      { value: "qa", label: "Q&A" },
      { value: "star", label: "STAR" },
      { value: "nego", label: "Negotiation" },
    ],
    [],
  );

  useEffect(() => {
    if (currentStatus === "pending" || currentStatus === "generating") {
      const interval = setInterval(async () => {
        const res = await getInterviewPrepAction(applicationId);
        if (res.ok && res.data) {
          setPrep(res.data.prep);
          setCurrentStatus(res.data.status);
          if (res.data.status === "ready" && res.data.prep) {
            toast.success("Interview prep ready");
          } else if (res.data.status === "failed") {
            toast.error("Interview prep failed");
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [applicationId, currentStatus]);

  function generate() {
    setBusy(true);
    start(async () => {
      const res = await generateInterviewPrepAction(applicationId);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Interview prep queued");
      setCurrentStatus("generating");
    });
  }

  const ready = Boolean(prep && prep.status === "ready" && !prep.errorCode);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <BlurText
            text="Interview prep"
            className="text-2xl font-semibold tracking-tight text-foreground"
            animateBy="words"
            delay={40}
          />
          <p className="text-sm text-muted-foreground">
            Q&A, STAR stories, and negotiation grounded in your indexed CV only.
          </p>
        </div>
        <StatefulButton
          type="button"
          className="cursor-pointer shrink-0"
          disabled={pending || generating}
          onClick={generate}
        >
          {generating ? "Generating…" : prep ? "Regenerate" : "Generate prep"}
        </StatefulButton>
      </div>

      {generating && (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="pt-6 pb-4">
            <MultiStepLoader
              variant="inline"
              loading
              loop
              loadingStates={GEN_STEPS}
            />
          </CardContent>
        </Card>
      )}

      {!prep && !generating && (
        <p className="text-sm text-muted-foreground">
          Generate a pack after you have indexed your CV. Stories stay grounded in
          uploaded experience.
        </p>
      )}

      {prep?.errorCode ? (
        <p className="text-sm text-destructive">
          Prep failed. Try again after re-indexing your CV.
        </p>
      ) : null}

      {ready ? (
        <div className="space-y-6">
          <RubberSegment
            theme={theme}
            size="sm"
            value={section}
            aria-label="Prep section"
            items={segmentItems}
            onChange={(value) => setSection(value as PrepSection)}
          />

          {section === "qa" ? (
            <AnimatedList aria-label="Interview questions" className="space-y-4">
              {prep!.questions.map((q) => (
                <Card
                  key={q.question}
                  className="border-border/60 bg-card/80 shadow-sm backdrop-blur-sm"
                >
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug font-medium">
                        {q.question}
                      </CardTitle>
                      <CategoryBadge category={q.category} />
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm leading-relaxed text-muted-foreground">
                    {q.suggestedAnswer}
                  </CardContent>
                </Card>
              ))}
            </AnimatedList>
          ) : null}

          {section === "star" ? (
            <AnimatedList aria-label="STAR stories" className="space-y-6">
              {prep!.starStories.map((s) => (
                <Card
                  key={s.title + s.chunkIds.join()}
                  className="overflow-hidden border-border/60 bg-gradient-to-br from-card/90 to-muted/20"
                >
                  <CardHeader>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {STAR_FIELDS.map(({ key, label, tone }) => (
                        <div
                          key={key}
                          className={cn(
                            "rounded-lg border border-border/50 bg-background/60 p-3",
                            "border-l-4 pl-3",
                            tone,
                          )}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-1.5 text-sm leading-relaxed">
                            {s[key]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </AnimatedList>
          ) : null}

          {section === "nego" ? (
            prep!.negotiation ? (
              <Card className="border-border/60 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-base">Salary script</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <dt className="text-xs text-muted-foreground">Range</dt>
                      <dd className="mt-1 font-medium">
                        {formatSalaryCents(
                          prep!.negotiation!.rangeMinCents,
                          prep!.negotiation!.rangeMaxCents,
                          prep!.negotiation!.currency,
                        ) ?? "Not listed on this job"}
                      </dd>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <dt className="text-xs text-muted-foreground">Target</dt>
                      <dd className="mt-1 font-medium">
                        {formatSalaryCents(
                          prep!.negotiation!.targetCents,
                          prep!.negotiation!.targetCents,
                          prep!.negotiation!.currency,
                        ) ?? "—"}
                      </dd>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <dt className="text-xs text-muted-foreground">
                        Walk-away
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatSalaryCents(
                          prep!.negotiation!.walkawayCents,
                          prep!.negotiation!.walkawayCents,
                          prep!.negotiation!.currency,
                        ) ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <AnimatedList aria-label="Talking points" className="space-y-2">
                    {prep!.negotiation!.talkingPoints.map((p) => (
                      <div
                        key={p}
                        className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-sm"
                      >
                        {p}
                      </div>
                    ))}
                  </AnimatedList>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">No salary data.</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
