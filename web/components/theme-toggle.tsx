"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;

/** Cycles light → dark → system. Icon-only control with aria-label (P12.4). */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const label =
    current === "dark"
      ? "Theme: dark. Switch to system"
      : current === "light"
        ? "Theme: light. Switch to dark"
        : "Theme: system. Switch to light";

  const Icon =
    !mounted
      ? Monitor
      : current === "dark" || (current === "system" && resolvedTheme === "dark")
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
  const idx = ORDER.indexOf(
      (ORDER as readonly string[]).includes(current) ? current : "system",
    );
        const next = ORDER[(idx + 1) % ORDER.length]!;
        setTheme(next);
      }}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
