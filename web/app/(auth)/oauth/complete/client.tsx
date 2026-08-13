"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { completeOAuthAction } from "@/lib/actions/auth";

export function OAuthCompleteClient() {
  const params = useSearchParams();
  const code = params.get("code");
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    void (async () => {
      const result = await completeOAuthAction({ code });
      if (result?.error) setError(result.error);
    })();
  }, [code]);

  if (!code) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign-in failed</CardTitle>
          <CardDescription>Missing OAuth exchange code.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign-in failed</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Completing sign-in</CardTitle>
        <CardDescription>Finishing OAuth and setting your session…</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Loading</span>
      </CardContent>
    </Card>
  );
}
