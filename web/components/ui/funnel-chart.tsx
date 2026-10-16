"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import CountUp from "@/components/ui/count-up";

interface FunnelChartProps {
  stages: Array<{ stage: string; label: string; count: number }>;
  className?: string;
}

const STAGE_SHADES = [
  "bg-foreground",
  "bg-foreground/70",
  "bg-foreground/45",
  "bg-foreground/30",
  "bg-foreground/20",
  "bg-foreground/12",
  "bg-foreground/8",
];

export function FunnelChart({ stages, className }: FunnelChartProps) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className={cn("space-y-1", className)}>
      {stages.map((s, i) => {
        const pct = max > 0 ? s.count / max : 0;
        const prev = i > 0 ? stages[i - 1].count : null;
        const conversion =
          prev !== null && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        const shade = STAGE_SHADES[Math.min(i, STAGE_SHADES.length - 1)];

        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                <CountUp to={s.count} duration={1} className="tabular-nums" />
              </span>
            </div>
            <div className="flex justify-center">
              <motion.div
                className={cn("h-8 min-w-2 rounded-md", shade)}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct * 100, 3)}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                role="presentation"
              />
            </div>
            {conversion !== null ? (
              <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-muted-foreground">
                <span className="tabular-nums font-medium">{conversion}%</span>
                <span>of previous stage</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
