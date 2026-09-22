"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/lib/actions/auth";
import { Settings, FileText, LogOut, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className={cn("relative inline-block", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        className="cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <ChevronDown className={cn("h-3 w-3 ml-1 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>

      {open && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.15 }}
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border bg-popover p-1 shadow-lg z-50"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium truncate">Signed in</p>
            <p className="text-xs text-muted-foreground truncate">user@example.com</p>
          </div>
          <nav className="py-1" aria-label="User menu">
            <button
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
              )}
              role="menuitem"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Settings
            </button>
            <button
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
              )}
              role="menuitem"
            >
              <FileText className="h-4 w-4" aria-hidden />
              CV & Documents
            </button>
            <Separator className="my-1" />
            <form action={logoutAction}>
              <button
                type="submit"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent text-destructive",
                )}
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </form>
          </nav>
        </motion.div>
      )}
    </div>
  );
}