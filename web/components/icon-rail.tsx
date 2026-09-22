"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APP_NAV, isNavActive, type AppNavItem } from "@/lib/nav";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/cv", label: "CV & Documents" },
  { href: "/settings/sources", label: "Sources" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/email-review", label: "Email review" },
  { href: "/settings/privacy", label: "Privacy" },
] as const;

interface IconRailProps {
  items?: readonly AppNavItem[];
  onToggle?: () => void;
}

export function IconRail({ items = APP_NAV, onToggle }: IconRailProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("icon-rail-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("icon-rail-collapsed", String(collapsed));
  }, [collapsed]);

  const handleToggle = () => {
    setCollapsed((c) => !c);
    onToggle?.();
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-background transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
      aria-label="Navigation rail"
    >
      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Main navigation">
        {items.map((item) => {
          const active = isNavActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-accent font-medium",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
        {!collapsed && pathname.startsWith("/settings") && (
          <div className="mt-2 space-y-1 border-t pt-2 pl-2">
            {SETTINGS_LINKS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-current={pathname === s.href ? "page" : undefined}
                className={cn(
                  "block min-h-9 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  pathname === s.href && "bg-accent text-foreground",
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
      <Button
        variant="ghost"
        size="icon"
        className="mx-2 mb-2"
        onClick={handleToggle}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
      >
        {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
    </aside>
  );
}