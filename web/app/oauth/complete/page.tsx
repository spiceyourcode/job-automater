import { Suspense } from "react";
import { OAuthCompleteClient } from "./client";

export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Completing sign-in…</p>
      }
    >
      <OAuthCompleteClient />
    </Suspense>
  );
}
