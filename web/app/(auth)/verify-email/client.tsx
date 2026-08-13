"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyEmailAction } from "@/lib/actions/auth";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing verification token");
      return;
    }
    startTransition(async () => {
      const result = await verifyEmailAction({ token });
      if (result?.error) {
        setStatus("error");
        setError(result.error);
      } else {
        setStatus("ok");
      }
    });
  }, [token]);

  return (
    <Card className="w-full max-w-md border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>
          Confirming your email address for JobAutomater.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(pending || status === "idle") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Verifying…
          </p>
        )}
        {status === "ok" && (
          <p className="text-sm text-foreground">
            Email verified. You can continue to the dashboard.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {error ?? "Verification failed"}
          </p>
        )}
        <Button asChild className="cursor-pointer">
          <Link href={status === "ok" ? "/dashboard" : "/login"}>
            {status === "ok" ? "Go to dashboard" : "Back to sign in"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
