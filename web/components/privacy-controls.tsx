"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteOwnAccountAction,
  exportOwnDataAction,
} from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";

export function PrivacyControls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportOwnDataAction();
      if (!result.ok || !result.data) {
        setError(result.ok ? "Empty export" : result.error);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobautomater-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function onDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteOwnAccountAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/login");
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Export your data</h2>
        <p className="text-sm text-muted-foreground">
          Download a JSON copy of your profile, CV metadata, applications, and
          notifications.
        </p>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={pending}
          onClick={onExport}
        >
          Download export
        </Button>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium text-destructive">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          Permanently erase your account and associated personal data, including
          CV embeddings. This cannot be undone.
        </p>
        {confirmDelete ? (
          <p className="text-sm text-destructive">
            Click again to confirm permanent deletion.
          </p>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          className="cursor-pointer"
          disabled={pending}
          onClick={onDelete}
        >
          {confirmDelete ? "Confirm delete account" : "Delete my account"}
        </Button>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
