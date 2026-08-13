import { Suspense } from "react";
import ResetPasswordForm from "./form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading reset form…</p>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
