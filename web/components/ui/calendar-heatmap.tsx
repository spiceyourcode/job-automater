"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CalendarHeatmapProps {
  data: Array<{ day: string; avgScore: number; count: number }>;
  className?: string;
}

const SCORE_LEVELS = [
  { min: 85, className: "bg-foreground", label: "85-100" },
  { min: 70, className: "bg-foreground/75", label: "70-84" },
  { min: 55, className: "bg-foreground/50", label: "55-69" },
  { min: 40, className: "bg-foreground/30", label: "40-54" },
  { min: 0, className: "bg-foreground/15", label: "0-39" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getScoreLevel(score: number) {
  for (const level of SCORE_LEVELS) {
    if (score >= level.min) return level;
  }
  return SCORE_LEVELS[SCORE_LEVELS.length - 1];
}

function toDateKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function CalendarHeatmap({ data, className }: CalendarHeatmapProps) {
  const weeks = useMemo(() => {
    if (data.length === 0) return [];

    const sortedData = [...data].sort(
      (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()
    );

    const firstDate = new Date(sortedData[0].day);
    const lastDate = new Date(sortedData[sortedData.length - 1].day);

    const startOfWeek = new Date(firstDate);
    startOfWeek.setDate(firstDate.getDate() - firstDate.getDay());

    const endOfWeek = new Date(lastDate);
    endOfWeek.setDate(lastDate.getDate() + (6 - lastDate.getDay()));

    const weeks: Array<Array<{ date: Date; data: typeof sortedData[0] | null }>> = [];
    let currentWeek: Array<{ date: Date; data: typeof sortedData[0] | null }> = [];

    const dataMap = new Map(sortedData.map((d) => [d.day, d]));

    for (
      let d = new Date(startOfWeek);
      d <= endOfWeek;
      d.setDate(d.getDate() + 1)
    ) {
      const dayStr = toDateKey(d);
      currentWeek.push({
        date: new Date(d),
        data: dataMap.get(dayStr) ?? null,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: new Date(NaN), data: null });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data]);

  const monthLabels = useMemo(() => {
    let prev = "";
    return weeks.map((week) => {
      const first = week.find((d) => !isNaN(d.date.getTime()));
      if (!first) return null;
      const month = first.date.toLocaleString("default", { month: "short" });
      if (month !== prev) {
        prev = month;
        return month;
      }
      return null;
    });
  }, [weeks]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          Less
          <span className="w-3 h-3 rounded bg-muted/60 border border-border" />
          <span className="w-3 h-3 rounded bg-foreground/15" />
          <span className="w-3 h-3 rounded bg-foreground/30" />
          <span className="w-3 h-3 rounded bg-foreground/50" />
          <span className="w-3 h-3 rounded bg-foreground/75" />
          <span className="w-3 h-3 rounded bg-foreground" />
          More
        </span>
        <span className="ml-auto">
          Shade = avg match score (0-100) · time flows left → right
        </span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="border-separate border-spacing-1"
          role="img"
          aria-label="Match quality calendar heatmap — time flows left to right, darker cells mean higher average match score"
        >
          <thead>
            <tr>
              <th className="w-8" />
              {weeks.map((_, weekIndex) => (
                <th
                  key={weekIndex}
                  className="text-[11px] text-muted-foreground font-normal px-1 pb-1 text-center"
                  scope="col"
                >
                  {monthLabels[weekIndex]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((weekday, dayIndex) => (
              <tr key={weekday}>
                <td className="text-[11px] text-muted-foreground w-8 pr-1 text-right align-middle">
                  {weekday}
                </td>
                {weeks.map((week, weekIndex) => {
                  const day = week[dayIndex];
                  return (
                    <td key={weekIndex} className="p-0">
                      {day.data ? (
                        <button
                          type="button"
                          className={cn(
                            "w-8 h-8 rounded transition-all duration-150",
                            "hover:scale-110 hover:ring-2 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            getScoreLevel(day.data.avgScore).className
                          )}
                          title={`${day.date.toLocaleDateString("default", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })} — ${day.data.avgScore}% avg · ${day.data.count} job${day.data.count === 1 ? "" : "s"}`}
                          aria-label={`${day.date.toLocaleDateString("default", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}: ${day.data.avgScore}% match score, ${day.data.count} job${day.data.count === 1 ? "" : "s"}`}
                        />
                      ) : !isNaN(day.date.getTime()) ? (
                        <div
                          className="w-8 h-8 rounded bg-muted/60 border border-border"
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="w-8 h-8" aria-hidden="true" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
        <span>Days with data: {data.length}</span>
        <span>
          Avg score:{" "}
          {data.length > 0
            ? Math.round(data.reduce((sum, d) => sum + d.avgScore, 0) / data.length)
            : 0}
          %
        </span>
        <span>Total jobs: {data.reduce((sum, d) => sum + d.count, 0)}</span>
      </div>
    </div>
  );
}
