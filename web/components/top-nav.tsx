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
import { Briefcase, FileText, Users, Settings, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/lib/actions/auth";
import { Search, LogOut } from "lucide-react";

const SETTINGS_LINKS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/cv", label: "CV & Documents" },
  { href: "/settings/sources", label: "Sources" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/email-review", label: "Email review" },
  { href: "/settings/privacy", label: "Privacy" },
] as const;

interface TopNavProps {
  title?: string;
  onToggleIconRail?: () => void;
  showIconRail?: boolean;
}

export function TopNav({ title, onToggleIconRail, showIconRail = true }: TopNavProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          <MobileNavTrigger onOpenChange={setMobileMenuOpen} />

          {onToggleIconRail && showIconRail && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-pointer hidden sm:inline-flex"
              aria-label="Collapse sidebar"
              onClick={onToggleIconRail}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </Button>
          )}

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

        <NavPill activeHref={pathname} className="hidden md:flex flex-1 max-w-2xl justify-center">
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

        <div className="flex items-center gap-2">
          <div className="hidden lg:block relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search jobs, companies..."
              className="h-9 w-64 pl-10 pr-4 text-sm bg-background"
              aria-label="Search jobs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const query = (e.currentTarget as HTMLInputElement).value.trim();
                  window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                }
              }}
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

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer md:hidden"
                  aria-label="Open menu"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  <Menu className="h-4 w-4" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <div className="border-b p-3">
                  <Input
                    type="search"
                    placeholder="Search jobs, companies..."
                    className="h-9 w-full text-sm"
                    aria-label="Search jobs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const query = (e.currentTarget as HTMLInputElement).value.trim();
                        window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                        setMobileMenuOpen(false);
                      }
                    }}
                  />
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Mobile navigation">
                  {APP_NAV.map((item) => {
                    const active = isNavActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent",
                          active && "bg-accent font-medium",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                  {pathname.startsWith("/settings") && (
                    <div className="mt-2 space-y-1 border-t pt-2">
                      {SETTINGS_LINKS.map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          aria-current={pathname === s.href ? "page" : undefined}
                          className={cn(
                            "block min-h-9 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                            pathname === s.href && "bg-accent text-foreground",
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {s.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </nav>
                <form action={logoutAction} className="border-t p-3">
                  <Button type="submit" className="w-full cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" aria-hidden />
                    Sign out
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="lg:hidden border-t px-4 py-3">
          <Input
            type="search"
            placeholder="Search jobs, companies..."
            className="h-9 w-full text-sm"
            aria-label="Search jobs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const query = (e.currentTarget as HTMLInputElement).value.trim();
                window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                setMobileSearchOpen(false);
              }
            }}
          />
        </div>
      )}

      {mobileMenuOpen && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="right" className="w-72 p-0">
            <div className="border-b p-3">
              <Input
                type="search"
                placeholder="Search jobs, companies..."
                className="h-9 w-full text-sm"
                aria-label="Search jobs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const query = (e.currentTarget as HTMLInputElement).value.trim();
                    window.location.href = query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs";
                    setMobileMenuOpen(false);
                  }
                }}
              />
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Mobile navigation">
              {APP_NAV.map((item) => {
                const active = isNavActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent",
                      active && "bg-accent font-medium",
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
              {pathname.startsWith("/settings") && (
                <div className="mt-2 space-y-1 border-t pt-2">
                  {SETTINGS_LINKS.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      aria-current={pathname === s.href ? "page" : undefined}
                      className={cn(
                        "block min-h-9 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
                        pathname === s.href && "bg-accent text-foreground",
                      )}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              )}
            </nav>
            <form action={logoutAction} className="border-t p-3">
              <Button type="submit" className="w-full cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" aria-hidden />
                Sign out
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </header>
  );
}