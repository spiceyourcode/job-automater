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
import {
  generateVideoCoverAction,
  type VideoCoverPublic,
} from "@/lib/actions/applications";

export function VideoCoverPanel({
  applicationId,
  initial,
  status,
}: {
  applicationId: string;
  initial: VideoCoverPublic | null;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const pack = initial;
  const generating = status === "pending" || status === "generating" || busy;

  function generate() {
    setBusy(true);
    start(async () => {
      const res = await generateVideoCoverAction(applicationId);
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Video script queued");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Video cover letter
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spoken script from your CV chunks only. Company names come from the
            job listing.
          </p>
        </div>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={pending || generating}
          onClick={generate}
        >
          {generating ? "Generating…" : pack ? "Regenerate" : "Generate script"}
        </Button>
      </div>

      {!pack && (
        <p className="text-sm text-muted-foreground">
          Generate after you have indexed your CV. The script will not invent
          employers or achievements.
        </p>
      )}

      {pack?.errorCode ? (
        <p className="text-sm text-destructive">
          Script failed. Try again after re-indexing your CV.
        </p>
      ) : null}

      {pack && pack.status === "ready" && pack.script ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              About {pack.estimatedSeconds ?? "—"} seconds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed whitespace-pre-wrap">
            {pack.script}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
