"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard#matches", label: "Jobs", icon: Briefcase },
  { href: "/dashboard#pipeline", label: "Applications", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings/profile", label: "Settings", icon: Settings },
] as const;

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/cv", label: "CV & Documents" },
  { href: "/settings/sources", label: "Sources" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/notifications", label: "Notifications" },
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
      <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex h-full items-center gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight"
          >
            JobAutomater
          </Link>
          {title ? (
            <span className="text-sm text-muted-foreground">/ {title}</span>
          ) : null}
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="ghost"
                size="sm"
                className="cursor-pointer"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <NotificationBell />
            <form action={logoutAction}>
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
          </nav>
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
          <nav className="flex flex-col gap-1 p-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href.split("#")[0]!);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
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
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
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

        <main className="flex-1 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
