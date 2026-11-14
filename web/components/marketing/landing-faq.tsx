"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { landingFaqs as faqs } from "@/components/marketing/landing-faq-data";

export function LandingFaq() {
  const [open, setOpen] = useState<string | undefined>(faqs[0]?.q);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {faqs.map((item) => (
        <Collapsible
          key={item.q}
          open={open === item.q}
          onOpenChange={(isOpen) => setOpen(isOpen ? item.q : undefined)}
          className="rounded-xl border border-border/80 bg-card/50 px-4 data-[state=open]:shadow-sm"
        >
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-sm font-medium tracking-tight hover:text-foreground">
            {item.q}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open === item.q && "rotate-180",
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
            {item.a}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
