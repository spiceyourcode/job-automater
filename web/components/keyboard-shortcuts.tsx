"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SHORTCUTS: Array<{ keys: string; action: string; href?: string }> = [
  { keys: "g then d", action: "Go to Dashboard", href: "/dashboard" },
  { keys: "g then j", action: "Go to Jobs", href: "/dashboard#matches" },
  { keys: "g then p", action: "Go to Pipeline", href: "/dashboard#pipeline" },
  { keys: "g then a", action: "Go to Analytics", href: "/analytics" },
  { keys: "g then s", action: "Go to Settings", href: "/settings/profile" },
  { keys: "?", action: "Show keyboard shortcuts" },
  { keys: "Escape", action: "Close dialogs / help" },
];

/**
 * App keyboard shortcuts (P12.4 / UIUX §7).
 * Ignored while typing in inputs; no focus trap outside help dialog.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingGRef = useRef(false);

  useEffect(() => {
    const openHelp = () => setHelpOpen(true);
    window.addEventListener("jobautomater:shortcuts-help", openHelp);
    return () =>
      window.removeEventListener("jobautomater:shortcuts-help", openHelp);
  }, []);

  useEffect(() => {
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setHelpOpen(true);
        pendingGRef.current = false;
        return;
      }

      if (e.key === "Escape") {
        setHelpOpen(false);
        pendingGRef.current = false;
        return;
      }

      if (e.key === "g" || e.key === "G") {
        pendingGRef.current = true;
        if (clearTimer) clearTimeout(clearTimer);
        clearTimer = setTimeout(() => {
          pendingGRef.current = false;
        }, 1500);
        return;
      }

      if (!pendingGRef.current) return;

      const map: Record<string, string> = {
        d: "/dashboard",
        D: "/dashboard",
        j: "/dashboard#matches",
        J: "/dashboard#matches",
        p: "/dashboard#pipeline",
        P: "/dashboard#pipeline",
        a: "/analytics",
        A: "/analytics",
        s: "/settings/profile",
        S: "/settings/profile",
      };
      const href = map[e.key];
      if (href) {
        e.preventDefault();
        pendingGRef.current = false;
        router.push(href);
      } else {
        pendingGRef.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md" aria-describedby="kbd-help-desc">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription id="kbd-help-desc">
            Press ? anytime (outside text fields) to open this list.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0"
            >
              <span>{s.action}</span>
              <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
