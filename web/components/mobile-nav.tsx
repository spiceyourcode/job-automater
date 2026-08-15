"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";

type NavItem = { href: string; label: string };

type Props = {
  items: readonly NavItem[];
};

/** Mobile navigation — labeled controls; Escape closes (P12.4). */
export function MobileNav({ items }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        document.getElementById(triggerId)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, triggerId]);

  return (
    <div className="md:hidden">
      <Button
        id={triggerId}
        type="button"
        variant="ghost"
        size="icon"
        className="cursor-pointer"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <X className="h-4 w-4" aria-hidden />
        ) : (
          <Menu className="h-4 w-4" aria-hidden />
        )}
      </Button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-label="Main navigation"
          className="fixed inset-0 z-50 flex flex-col bg-background p-4 pt-16"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-4 top-4 cursor-pointer"
            onClick={() => {
              setOpen(false);
              document.getElementById(triggerId)?.focus();
            }}
          >
            Close
          </Button>
          <nav
            className="mx-auto flex w-full max-w-sm flex-col gap-1"
            aria-label="Mobile"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "min-h-11 rounded-md px-3 py-3 text-base hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                )}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <form action={logoutAction} className="mt-4 border-t pt-4">
              <Button
                type="submit"
                variant="outline"
                className="w-full cursor-pointer"
              >
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
