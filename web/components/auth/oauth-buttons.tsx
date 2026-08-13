"use client";

import { Button } from "@/components/ui/button";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "linkedin", label: "Continue with LinkedIn" },
] as const;

/**
 * OAuth start hits the API (secrets stay server-side — HG-1).
 * No client_id/secret in the browser bundle.
 */
export function OAuthButtons() {
  return (
    <div className="grid gap-2">
      {PROVIDERS.map((p) => (
        <Button key={p.id} variant="outline" className="w-full" asChild>
          <a href={`${API_URL}/api/v1/auth/oauth/${p.id}`}>{p.label}</a>
        </Button>
      ))}
    </div>
  );
}
