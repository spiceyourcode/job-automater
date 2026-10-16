"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { getCurrencyInfo } from "@/lib/currency";

interface SalaryBenchmarkData {
  sampleSize: number;
  currency: string;
  p25Cents: number | null;
  p50Cents: number | null;
  p75Cents: number | null;
  minCents: number | null;
  maxCents: number | null;
  title: string | null;
  location: string | null;
}

function formatCents(cents: number, currency: string): string {
  const info = getCurrencyInfo(currency);
  const amount = cents / 100;
  if (amount >= 1000 && info.decimalDigits === 0) {
    return `${info.symbol}${Math.round(amount / 1000)}k`;
  }
  if (amount >= 1000) {
    return `${info.symbol}${(amount / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: info.decimalDigits,
    minimumFractionDigits: info.decimalDigits,
  }).format(amount);
}

const STAT_META = [
  { key: "p25Cents", label: "P25", caption: "25th percentile" },
  { key: "p50Cents", label: "Median", caption: "50th percentile" },
  { key: "p75Cents", label: "P75", caption: "75th percentile" },
] as const;

export function SalaryBenchmark({
  benchmark,
  className,
}: {
  benchmark: SalaryBenchmarkData;
  className?: string;
}) {
  const { currency, sampleSize, title, location } = benchmark;
  const lo =
    benchmark.minCents ?? benchmark.p25Cents ?? benchmark.p50Cents ?? null;
  const hi =
    benchmark.maxCents ?? benchmark.p75Cents ?? benchmark.p50Cents ?? null;
  const hasAxis = lo !== null && hi !== null && hi > lo;
  const span = hasAxis ? hi - lo : 1;
  const pct = (cents: number) =>
    Math.min(100, Math.max(0, ((cents - lo!) / span) * 100));

  const p25 = benchmark.p25Cents;
  const p50 = benchmark.p50Cents;
  const p75 = benchmark.p75Cents;
  const bandLeft = p25 !== null ? pct(p25) : 0;
  const bandRight = p75 !== null ? pct(p75) : 100;
  const bandWidth = Math.max(bandRight - bandLeft, 1);

  return (
    <div
      className={cn(
        "space-y-5 rounded-lg border p-4",
        className,
      )}
      aria-label="Salary benchmark"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-lg font-medium">Salary benchmark</h2>
          <p className="text-sm text-muted-foreground">
            {title ? title : "Collected jobs"}
            {location ? ` · ${location}` : null}
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {sampleSize} samples
        </span>
      </div>

      {hasAxis ? (
        <div className="px-1 pt-6" aria-hidden="true">
          <div className="relative h-12">
            {p25 !== null ? (
              <motion.span
                className="absolute -top-6 text-xs font-medium tabular-nums"
                style={{ left: `${pct(p25)}%` }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                {formatCents(p25, currency)}
              </motion.span>
            ) : null}
            {p50 !== null ? (
              <motion.span
                className="absolute -top-6 -translate-x-1/2 text-xs font-semibold tabular-nums"
                style={{ left: `${pct(p50)}%` }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                {formatCents(p50, currency)}
              </motion.span>
            ) : null}
            {p75 !== null ? (
              <motion.span
                className="absolute -top-6 -translate-x-full text-xs font-medium tabular-nums"
                style={{ left: `${pct(p75)}%` }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                {formatCents(p75, currency)}
              </motion.span>
            ) : null}

            <div className="absolute inset-x-0 top-4 h-2 overflow-hidden rounded-full bg-muted">
              {p25 !== null && p75 !== null ? (
                <motion.div
                  className="h-full bg-foreground/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${bandWidth}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ marginLeft: `${bandLeft}%` }}
                />
              ) : null}
            </div>
            {p50 !== null ? (
              <motion.div
                className="absolute top-3 h-4 w-0.5 -translate-x-1/2 rounded bg-foreground"
                style={{ left: `${pct(p50)}%` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              />
            ) : null}

            <span className="absolute left-0 top-6 text-[11px] text-muted-foreground tabular-nums">
              {formatCents(lo!, currency)}
            </span>
            <span className="absolute right-0 top-6 text-[11px] text-muted-foreground tabular-nums">
              {formatCents(hi!, currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {STAT_META.map((stat, i) => {
          const value = benchmark[stat.key];
          return (
            <motion.div
              key={stat.key}
              className="rounded-md border bg-muted/20 px-3 py-2.5"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">
                {value !== null ? formatCents(value, currency) : "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stat.caption}
              </p>
            </motion.div>
          );
        })}
      </div>

      {lo !== null && hi !== null ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          Observed range {formatCents(lo, currency)}–{formatCents(hi, currency)}{" "}
          across {sampleSize} jobs with salary data.
        </p>
      ) : null}
    </div>
  );
}
