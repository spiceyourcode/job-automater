"use client";

import { useState, useTransition } from "react";
import { classifyEmailAction } from "@/lib/actions/emails";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "application_confirmation",
  "interview_invitation",
  "rejection",
  "offer",
  "follow_up_request",
  "spam",
  "other",
] as const;

export type ReviewEmail = {
  id: string;
  fromEmail: string;
  subject: string | null;
  snippet: string | null;
  category: string | null;
  confidence: string | null;
};

export function EmailReviewQueue({ initial }: { initial: ReviewEmail[] }) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No emails waiting for review. Low-confidence classifications appear here
        and never auto-update application status.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {error ? (
        <li className="text-sm text-destructive" role="alert">
          {error}
        </li>
      ) : null}
      {items.map((email) => (
        <li key={email.id} className="rounded-lg border p-4">
          <p className="text-sm font-medium">{email.subject ?? "(no subject)"}</p>
          <p className="text-xs text-muted-foreground">{email.fromEmail}</p>
          {email.snippet ? (
            <p className="mt-1 text-sm text-muted-foreground">{email.snippet}</p>
          ) : null}
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            suggested {email.category ?? "other"} · {email.confidence ?? "?"}
          </p>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const category = String(fd.get("category") ?? "other");
              setError(null);
              startTransition(async () => {
                const res = await classifyEmailAction(email.id, category);
                if (!res.ok) setError(res.error);
                else setItems((prev) => prev.filter((x) => x.id !== email.id));
              });
            }}
          >
            <select
              name="category"
              defaultValue={email.category ?? "other"}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              className="cursor-pointer"
              disabled={pending}
            >
              Confirm
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
