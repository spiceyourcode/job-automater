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
  icon: LucideIcon;
};

export const APP_NAV: readonly AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/settings/profile", label: "Settings", icon: Settings },
] as const;

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href.startsWith("/settings")) return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
