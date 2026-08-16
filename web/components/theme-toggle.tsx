"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;

/** Cycles light → dark → system. Mount-gated to avoid next-themes SSR mismatch. */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Same markup on server + first client paint (theme from localStorage is client-only).
  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="cursor-pointer"
        aria-label="Toggle theme"
        title="Toggle theme"
      >
        <Monitor className="h-4 w-4" aria-hidden />
      </Button>
    );
  }

  const current = (
    (ORDER as readonly string[]).includes(theme ?? "")
      ? theme
      : "system"
  ) as (typeof ORDER)[number];

  const label =
    current === "dark"
      ? "Theme: dark. Switch to system"
      : current === "light"
        ? "Theme: light. Switch to dark"
        : "Theme: system. Switch to light";

  const Icon =
    current === "dark" || (current === "system" && resolvedTheme === "dark")
      ? Moon
      : current === "light"
        ? Sun
        : Monitor;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="cursor-pointer"
      aria-label={label}
      title={label}
      onClick={() => {
        const idx = ORDER.indexOf(current);
        setTheme(ORDER[(idx + 1) % ORDER.length]!);
      }}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
