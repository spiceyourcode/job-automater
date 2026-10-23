"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyOtpAction } from "@/lib/actions/auth";
import dynamic from "next/dynamic";

// CodeSlots is a JS/JSX component — load it client-only to avoid SSR issues
const CodeSlots = dynamic(() => import("@/components/ui/CodeSlots"), {
  ssr: false,
});

type SlotStatus = "idle" | "error" | "success";

export default function VerifyOtpClient() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [status, setStatus] = useState<SlotStatus>("idle");
  const [isPending, startTransition] = useTransition();

  // Theme-aware CodeSlots palette
  const palette = {
    accentColor: isDark ? "#f5f5f5" : "#18181b",
    inkColor: isDark ? "#f5f5f5" : "#18181b",
    slotColor: isDark ? "#27272a" : "#e4e4e7",
    digitColor: isDark ? "#18181b" : "#fafafa",
  };

  const handleComplete = (code: string) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await verifyOtpAction({ code });
      if (result?.error) {
        setStatus("error");
        toast.error(result.error);
      } else {
        setStatus("success");
        // Brief pause so the success animation plays before redirect
        setTimeout(() => router.push("/dashboard"), 900);
      }
    });
  };

  return (
    <Card className="w-full max-w-md border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>Check your inbox</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent to your email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CodeSlots — themed to match the app's dark/light palette */}
        <div className="flex justify-center">
          <CodeSlots
            length={6}
            status={status}
            onChange={() => {
              if (status === "error") setStatus("idle");
            }}
            onComplete={handleComplete}
            autoFocus
            {...palette}
            dangerColor="#ef4444"
            slotSize={48}
            gap={10}
            radius={12}
            bounce={0.25}
            settle={0.3}
            rise={8}
            cascade={30}
          />
        </div>

        {status === "error" && (
          <p className="text-center text-sm text-destructive" role="alert">
            Incorrect code — try again.
          </p>
        )}

        {isPending && status !== "success" && (
          <p className="text-center text-sm text-muted-foreground animate-pulse">
            Verifying…
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            onClick={() => toast.info("Resend not yet wired to API")}
          >
            Resend
          </button>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
