"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  generateInterviewPrepAction,
  type InterviewPrepPublic,
} from "@/lib/actions/applications";
import { formatSalaryCents } from "@/lib/jobs";

export function InterviewPrepPanel({
  applicationId,
  initial,
  status,
}: {
  applicationId: string;
  initial: InterviewPrepPublic | null;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const prep = initial;
  const generating = status === "pending" || status === "generating" || busy;

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
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Interview prep
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Q&A, STAR stories, and negotiation from your CV chunks only.
          </p>
        </div>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={pending || generating}
          onClick={generate}
        >
          {generating ? "Generating…" : prep ? "Regenerate" : "Generate prep"}
        </Button>
      </div>

      {!prep && (
        <p className="text-sm text-muted-foreground">
          Generate a pack after you have indexed your CV. Stories stay grounded
          in uploaded experience.
        </p>
      )}

      {prep?.errorCode ? (
        <p className="text-sm text-destructive">Prep failed. Try again after re-indexing your CV.</p>
      ) : null}

      {prep && prep.status === "ready" ? (
        <Tabs defaultValue="qa">
          <TabsList>
            <TabsTrigger value="qa">Q&A</TabsTrigger>
            <TabsTrigger value="star">STAR</TabsTrigger>
            <TabsTrigger value="nego">Negotiation</TabsTrigger>
          </TabsList>
          <TabsContent value="qa" className="mt-4 space-y-4">
            {prep.questions.map((q) => (
              <Card key={q.question}>
                <CardHeader>
                  <CardTitle className="text-base">{q.question}</CardTitle>
                  <p className="text-xs text-muted-foreground">{q.category}</p>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">
                  {q.suggestedAnswer}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="star" className="mt-4 space-y-4">
            {prep.starStories.map((s) => (
              <Card key={s.title + s.chunkIds.join()}>
                <CardHeader>
                  <CardTitle className="text-base">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Situation. </span>
                    {s.situation}
                  </p>
                  <p>
                    <span className="font-medium">Task. </span>
                    {s.task}
                  </p>
                  <p>
                    <span className="font-medium">Action. </span>
                    {s.action}
                  </p>
                  <p>
                    <span className="font-medium">Result. </span>
                    {s.result}
                  </p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="nego" className="mt-4">
            {prep.negotiation ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Salary script</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    Range:{" "}
                    {formatSalaryCents(
                      prep.negotiation.rangeMinCents,
                      prep.negotiation.rangeMaxCents,
                      prep.negotiation.currency,
                    ) ?? "Not listed on this job"}
                  </p>
                  <p>
                    Target:{" "}
                    {formatSalaryCents(
                      prep.negotiation.targetCents,
                      prep.negotiation.targetCents,
                      prep.negotiation.currency,
                    ) ?? "—"}
                  </p>
                  <p>
                    Walk-away:{" "}
                    {formatSalaryCents(
                      prep.negotiation.walkawayCents,
                      prep.negotiation.walkawayCents,
                      prep.negotiation.currency,
                    ) ?? "—"}
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {prep.negotiation.talkingPoints.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">No salary data.</p>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
