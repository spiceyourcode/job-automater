"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeft, Keyboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";
import { RealtimeListener } from "@/components/realtime-listener";
import { ThemeToggle } from "@/components/theme-toggle";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { MobileNav } from "@/components/mobile-nav";
import { APP_NAV, isNavActive } from "@/lib/nav";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/cv", label: "CV & Documents" },
  { href: "/settings/sources", label: "Sources" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/email-review", label: "Email review" },
  { href: "/settings/privacy", label: "Privacy" },
] as const;

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const settingsOpen = pathname.startsWith("/settings");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <RealtimeListener />
      <KeyboardShortcuts />
      <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-full min-w-0 items-center gap-3 px-4">
          <MobileNav />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden cursor-pointer md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Link
            href="/dashboard"
            className="shrink-0 text-sm font-semibold tracking-tight"
          >
            JobAutomater
          </Link>
          {title ? (
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              / {title}
            </span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden cursor-pointer md:inline-flex"
              aria-label="Keyboard shortcuts. Press question mark"
              title="Keyboard shortcuts (?)"
              onClick={() => {
                window.dispatchEvent(new Event("jobautomater:shortcuts-help"));
              }}
            >
              <Keyboard className="h-4 w-4" aria-hidden />
            </Button>
            <form action={logoutAction} className="hidden md:block">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
              >
                <LogOut className="mr-1 h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            "hidden shrink-0 border-r bg-background transition-[width] duration-200 md:block",
            collapsed ? "w-16" : "w-64",
          )}
          aria-label="Sidebar"
        >
          <nav className="flex flex-col gap-1 p-2" aria-label="Sidebar">
            {APP_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-accent font-medium",
                    collapsed && "justify-center",
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
            {!collapsed && settingsOpen && (
              <div className="mt-2 space-y-1 border-t pt-2 pl-2">
                {SETTINGS_LINKS.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    aria-current={pathname === s.href ? "page" : undefined}
                    className={cn(
                      "block min-h-9 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      pathname === s.href && "bg-accent text-foreground",
                    )}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
