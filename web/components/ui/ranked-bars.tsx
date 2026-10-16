"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import CountUp from "@/components/ui/count-up";

interface RankedBarsItem {
  id: string;
  name: string;
  type: string;
  value: number;
}

interface RankedBarsProps {
  items: RankedBarsItem[];
  unitLabel?: string;
  className?: string;
}

export function RankedBars({ items, unitLabel = "jobs", className }: RankedBarsProps) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => {
        const pct = max > 0 ? item.value / max : 0;
        return (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-md border bg-muted/20"
          >
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0",
                index === 0 ? "bg-foreground/15" : "bg-foreground/8"
              )}
              initial={{ width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.7, delay: index * 0.06, ease: "easeOut" }}
              role="presentation"
            />
            <div className="relative flex items-center gap-3 px-3 py-2.5">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                  index === 0
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.type}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">
                  <CountUp to={item.value} duration={1} className="tabular-nums" />
                </p>
                <p className="text-[11px] text-muted-foreground">{unitLabel}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
