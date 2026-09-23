"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { APP_NAV, isNavActive } from "@/lib/nav";
import { NavPill } from "@/components/ui/nav-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNavTrigger } from "@/components/mobile-nav-trigger";
import { Briefcase, FileText, Users, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/lib/actions/auth";

interface TopNavProps {
  title?: string;
}

export function TopNav({ title }: TopNavProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const links = APP_NAV;
    let newIndex = index;

    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        newIndex = (index + 1) % links.length;
        break;
      case "ArrowLeft":
        e.preventDefault();
        newIndex = (index - 1 + links.length) % links.length;
        break;
      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;
      case "End":
        e.preventDefault();
        newIndex = links.length - 1;
        break;
      default:
        return;
    }

    const nextLink = document.querySelector(
      `[data-nav-index="${newIndex}"]`
    ) as HTMLElement;
    nextLink?.focus();
  };

  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="shrink-0 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Briefcase className="h-5 w-5" aria-hidden />
            </div>
            <span className="hidden sm:block text-sm font-semibold tracking-tight">
              JobAutomater
            </span>
          </Link>

          {title && (
            <span className="hidden sm:block min-w-0 truncate text-sm text-muted-foreground">
              / {title}
            </span>
          )}
        </div>

        <nav className="hidden md:flex flex-1 max-w-2xl justify-center" aria-label="Main navigation">
          <NavPill activeHref={pathname} className="flex items-center gap-1">
            {APP_NAV.map((item, index) => {
              const active = isNavActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-nav-index={index}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={cn(
                    "relative flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </NavPill>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <GooeyInput
              placeholder="Search jobs, companies..."
              collapsedWidth={132}
              expandedWidth={280}
              expandedOffset={44}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const query = (e.currentTarget as HTMLInputElement).value.trim();
                  window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                }
              }}
              aria-label="Search jobs"
            />
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />

            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label="User menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Users className="h-4 w-4" aria-hidden />
                </div>
              </Button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                    aria-hidden
                  />
                  <motion.div
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
                      <Link
                        href="/settings/profile"
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                        )}
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        <Settings className="h-4 w-4" aria-hidden />
                        Settings
                      </Link>
                      <Link
                        href="/settings/cv"
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                        )}
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                        CV & Documents
                      </Link>
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
                </>
              )}
            </div>

            <div className="md:hidden">
              <MobileNavTrigger />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}