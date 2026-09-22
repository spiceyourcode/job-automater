import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  badge?: string;
  icon: LucideIcon;
};

export const APP_NAV: readonly AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", shortLabel: "Jobs", icon: Briefcase },
  { href: "/applications", label: "Applications", shortLabel: "Apps", icon: FileText },
  { href: "/analytics", label: "Analytics", shortLabel: "Charts", icon: BarChart3 },
  { href: "/crm", label: "CRM", shortLabel: "CRM", icon: Users },
  { href: "/settings/profile", label: "Settings", shortLabel: "Set.", icon: Settings },
] as const;

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
