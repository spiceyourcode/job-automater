"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";
import { APP_NAV, isNavActive, type AppNavItem } from "@/lib/nav";
import { useState } from "react";

type Props = {
  items?: readonly AppNavItem[];
};

/** Mobile navigation — Sheet portals to body so header blur cannot trap it. */
export function MobileNav({ items = APP_NAV }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="cursor-pointer md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>JobAutomater</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Mobile">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent font-medium",
                )}
                onClick={() => setOpen(false)}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="border-t p-3">
          <Button
            type="submit"
            variant="outline"
            className="w-full cursor-pointer"
          >
            Sign out
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
