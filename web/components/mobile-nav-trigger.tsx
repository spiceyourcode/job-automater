"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { MobileNav } from "@/components/mobile-nav";

export function MobileNavTrigger({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={false} onOpenChange={onOpenChange}>
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
        <MobileNav />
      </SheetContent>
    </Sheet>
  );
}