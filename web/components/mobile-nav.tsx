"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut, Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { APP_NAV, isNavActive, SETTINGS_LINKS, type AppNavItem } from "@/lib/nav";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type Props = {
  items?: readonly AppNavItem[];
};

/** Mobile navigation — Sheet portals to body as overlay with expandable sections. */
export function MobileNav({ items = APP_NAV }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const handleClose = () => setOpen(false);
  const toggleSettings = () => setSettingsExpanded((prev) => !prev);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 max-w-[85vw] p-0"
        style={{ zIndex: 100 }}
      >
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
          className="h-full flex flex-col"
        >
          <SheetHeader className="border-b px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <SheetTitle className="text-lg font-semibold">JobAutomater</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={handleClose}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <GooeyInput
              placeholder="Search jobs, companies..."
              collapsedWidth={160}
              expandedWidth={220}
              expandedOffset={44}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const query = (e.currentTarget as HTMLInputElement).value.trim();
                  window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                  handleClose();
                }
              }}
              aria-label="Search jobs"
            />
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Mobile navigation">
            {items.map((item) => {
              const active = isNavActive(item.href, pathname);
              const Icon = item.icon;
              const isSettings = item.href.startsWith("/settings");

              if (isSettings) {
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent",
                        active && "bg-accent font-medium",
                      )}
                      onClick={toggleSettings}
                      aria-expanded={settingsExpanded}
                      aria-controls="settings-submenu"
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {item.label}
                      <motion.span
                        className="ml-auto shrink-0"
                        animate={{ rotate: settingsExpanded ? 90 : 0 }}
                        transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </motion.span>
                    </button>
                    <motion.ul
                      id="settings-submenu"
                      initial={false}
                      animate={{
                        height: settingsExpanded ? "auto" : 0,
                        opacity: settingsExpanded ? 1 : 0,
                        paddingTop: settingsExpanded ? 4 : 0,
                      }}
                      transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      {SETTINGS_LINKS.map((s) => (
                        <li key={s.href}>
                          <Link
                            href={s.href}
                            aria-current={pathname === s.href ? "page" : undefined}
                            className={cn(
                              "flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent pl-6",
                              pathname === s.href && "bg-accent font-medium",
                            )}
                            onClick={handleClose}
                          >
                            <s.icon className="h-4 w-4 shrink-0" aria-hidden />
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </motion.ul>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent",
                    active && "bg-accent font-medium",
                  )}
                  onClick={handleClose}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            <form action={logoutAction} className="mt-4 border-t pt-3">
              <button
                type="submit"
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent text-destructive",
                )}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </form>
          </nav>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}