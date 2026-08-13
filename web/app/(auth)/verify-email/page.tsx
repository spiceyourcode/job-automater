import { Suspense } from "react";
import VerifyEmailClient from "./client";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading verification…</p>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
