"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  disconnectGmailAction,
  gmailStatusAction,
  startGmailOAuthAction,
  syncGmailAction,
  type GmailStatus,
} from "@/lib/actions/emails";
import { Button } from "@/components/ui/button";

const GMAIL_WHY: Record<string, string> = {
  api_forbidden:
    "Google signed you in, but Gmail mailbox access failed (403). Enable the Gmail API on this OAuth project's Google Cloud Console, add yourself as a test user if the app is in Testing, then connect again.",
  no_refresh:
    "Google did not issue a refresh token. Click Connect Gmail again and approve offline access.",
  state: "That sign-in expired. Click Connect Gmail again.",
  token:
    "Google rejected the token exchange. Confirm API_PUBLIC_URL matches the authorized redirect URI /api/v1/auth/gmail/callback.",
  profile: "Could not read the Gmail profile. Enable the Gmail API and try again.",
  missing: "Google did not return an authorization code. Try Connect Gmail again.",
  unknown: "Gmail connection failed.",
};

export function GmailConnect() {
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flash = params.get("gmail");
  const why = params.get("why") ?? "unknown";

  useEffect(() => {
    void gmailStatusAction().then((res) => {
      if (res.ok && res.data) setStatus(res.data);
    });
  }, [flash]);

  return (
    <section className="mb-8 space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Gmail inbox</h2>
      <p className="text-sm text-muted-foreground">
        Connect Gmail with OAuth for watch + history sync. Tokens stay on the
        server. IMAP below is a fallback for non-Gmail mailboxes — Gmail IMAP
        will reject your normal Google password.
      </p>
      {flash === "connected" ? (
        <p className="text-sm text-green-700 dark:text-green-400">
          Gmail connected.
        </p>
      ) : null}
      {flash === "error" && !status?.connected ? (
        <p className="text-sm text-destructive" role="alert">
          {GMAIL_WHY[why] ?? GMAIL_WHY.unknown}
        </p>
      ) : null}
      {status?.connected ? (
        <p className="text-sm text-muted-foreground">
          Connected as {status.email}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not connected.</p>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!status?.connected ? (
          <Button
            type="button"
            className="cursor-pointer"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await startGmailOAuthAction();
                if (!res.ok || !res.data?.url) {
                  setError(!res.ok ? res.error : "Missing URL");
                  return;
                }
                window.location.assign(res.data.url);
              });
            }}
          >
            Connect Gmail
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await syncGmailAction();
                  if (!res.ok) setError(res.error);
                });
              }}
            >
              Sync history
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await disconnectGmailAction();
                  if (!res.ok) setError(res.error);
                  else setStatus({ connected: false });
                });
              }}
            >
              Disconnect
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
