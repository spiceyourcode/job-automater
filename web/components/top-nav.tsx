"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { APP_NAV, isNavActive, SETTINGS_LINKS } from "@/lib/nav";
import PillNav from "@/components/ui/pill-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNavTrigger } from "@/components/mobile-nav-trigger";
import { Briefcase, LogOut, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GooeyInput } from "@/components/ui/gooey-input";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/lib/actions/auth";

export function TopNav() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const settingsActive = isNavActive("/settings/profile", pathname);

  const pillItems = APP_NAV.filter(
    (item) => !item.href.startsWith("/settings"),
  ).map((item) => ({
    label: item.label,
    href: item.href,
    icon: <item.icon aria-hidden />,
  }));

  const activeHref = pillItems.find((item) =>
    isNavActive(item.href, pathname),
  )?.href;

  return (
    <header className="sticky top-0 z-50 h-14 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full items-center gap-2 px-4">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-5 w-5" aria-hidden />
          </div>
          <span className="hidden text-sm font-semibold tracking-tight sm:block">
            JobAutomater
          </span>
        </Link>

        <div
          className={cn("hidden shrink-0", navCollapsed && "md:block")}
        >
          <MobileNavTrigger />
        </div>

        <div
          className="hidden w-[140px] shrink-0 md:block"
          aria-hidden
        />

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center md:flex"
          aria-label="Main navigation"
        >
          <PillNav
            items={pillItems}
            activeHref={activeHref}
            linkComponent={Link}
            theme={resolvedTheme}
            size="sm"
            surface="none"
            itemStyle="pill"
            hoverEffect="fill"
            indicator="dot"
            collapse="auto"
            onCollapseChange={setNavCollapsed}
            className="data-[collapsed]:invisible"
            ariaLabel="Main navigation"
          />
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden w-[280px] justify-end md:flex">
            <GooeyInput
              placeholder="Search jobs, companies..."
              collapsedWidth={132}
              expandedWidth={280}
              expandedOffset={0}
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

            <div
              className="relative hidden md:block"
              onMouseEnter={() => setSettingsOpen(true)}
              onMouseLeave={() => setSettingsOpen(false)}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "cursor-pointer",
                  settingsActive && "text-primary",
                )}
                onClick={() => setSettingsOpen((o) => !o)}
                aria-expanded={settingsOpen}
                aria-haspopup="true"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" aria-hidden />
              </Button>

              {settingsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSettingsOpen(false)}
                    aria-hidden
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={
                      reducedMotion ? { duration: 0 } : { duration: 0.15 }
                    }
                    className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-md border bg-popover p-1 shadow-lg"
                    role="menu"
                  >
                    <nav className="py-1" aria-label="Settings">
                      {SETTINGS_LINKS.map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          aria-current={pathname === s.href ? "page" : undefined}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
                            pathname === s.href && "bg-accent font-medium",
                          )}
                          onClick={() => setSettingsOpen(false)}
                          role="menuitem"
                        >
                          <s.icon className="h-4 w-4 shrink-0" aria-hidden />
                          {s.label}
                        </Link>
                      ))}
                    </nav>
                  </motion.div>
                </>
              )}
            </div>

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
                    className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-md border bg-popover p-1 shadow-lg"
                    role="menu"
                  >
                    <div className="border-b border-border px-3 py-2">
                      <p className="truncate text-sm font-medium">Signed in</p>
                      <p className="truncate text-xs text-muted-foreground">
                        user@example.com
                      </p>
                    </div>
                    <nav className="py-1" aria-label="User menu">
                      {SETTINGS_LINKS.slice(0, 2).map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => setUserMenuOpen(false)}
                          role="menuitem"
                        >
                          <s.icon className="h-4 w-4" aria-hidden />
                          {s.label}
                        </Link>
                      ))}
                      <Separator className="my-1" />
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-accent"
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
