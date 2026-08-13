"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  activateCvVersionAction,
  deleteCvVersionAction,
  reindexCvAction,
  uploadCvAction,
  type CvVersionRow,
} from "@/lib/actions/profile";

export function CvVersionsManager({
  initialVersions,
}: {
  initialVersions: CvVersionRow[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [versions, setVersions] = useState(initialVersions);

  function refresh() {
    router.refresh();
  }

  function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const r = await uploadCvAction(fd);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("CV uploaded");
        refresh();
      }
    });
  }

  function activate(version: number) {
    startTransition(async () => {
      const r = await activateCvVersionAction(version);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Activated v${version}`);
        setVersions((prev) =>
          prev.map((v) => ({ ...v, isActive: v.version === version })),
        );
        refresh();
      }
    });
  }

  function remove(version: number) {
    if (!confirm(`Delete CV version ${version}? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteCvVersionAction(version);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Deleted v${version}`);
        setVersions((prev) => prev.filter((v) => v.version !== version));
        refresh();
      }
    });
  }

  function reindex(version: number) {
    startTransition(async () => {
      const r = await reindexCvAction(version);
      if (!r.ok) toast.error(r.error);
      else toast.success(`Reindex queued for v${version}`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Manage versions. Activate sets the CV used for matching and apply.
        </p>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf"
            className="sr-only"
            onChange={(e) => onUpload(e.target.files)}
          />
          <Button
            type="button"
            className="cursor-pointer"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="mr-2 h-4 w-4" aria-hidden />
            )}
            Upload new CV
          </Button>
        </div>
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No CV versions yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-sm text-muted-foreground">
                    {v.filename ?? "resume"}
                  </span>
                  {v.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Archived</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.chunkCount} chunks ·{" "}
                  {new Date(v.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!v.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={pending}
                    onClick={() => activate(v.version)}
                  >
                    Activate
                  </Button>
                )}
                <Button size="sm" variant="outline" className="cursor-pointer" asChild>
                  <a href={v.fileUrl} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="cursor-pointer"
                  disabled={pending}
                  onClick={() => reindex(v.version)}
                >
                  Reindex
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="cursor-pointer"
                  disabled={pending}
                  onClick={() => remove(v.version)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
