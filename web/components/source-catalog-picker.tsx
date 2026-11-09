"use client";

import { useMemo, useState } from "react";
import { Briefcase, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { SourceCatalogEntry } from "@/lib/actions/sources";

const REGION_LABELS: Record<string, string> = {
  global: "Global & remote",
  africa: "Africa",
  kenya: "Kenya",
  europe: "Europe",
  americas: "Americas",
};

const REGION_ORDER = ["global", "kenya", "africa", "europe", "americas"];

type Props = {
  entries: SourceCatalogEntry[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Hide entries that need credentials or a custom URL until Settings */
  onboardingMode?: boolean;
};

export function SourceCatalogPicker({
  entries,
  selected,
  onChange,
  onboardingMode = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [showBeta, setShowBeta] = useState(!onboardingMode);

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (onboardingMode && e.userFields?.length) return false;
      if (!showBeta && e.status === "beta") return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [entries, onboardingMode, showBeta, query]);

  const byRegion = useMemo(() => {
    const map = new Map<string, SourceCatalogEntry[]>();
    for (const e of visible) {
      const list = map.get(e.region) ?? [];
      list.push(e);
      map.set(e.region, list);
    }
    return map;
  }, [visible]);

  function toggle(id: string, checked: boolean) {
    onChange(
      checked ? [...new Set([...selected, id])] : selected.filter((x) => x !== id),
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-9"
          placeholder="Search boards…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search job sources"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="show-beta-sources"
          checked={showBeta}
          onCheckedChange={(v) => setShowBeta(v === true)}
        />
        <Label htmlFor="show-beta-sources" className="text-sm font-normal">
          Show experimental (beta) feeds
        </Label>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No sources match your filters.</p>
      )}

      <div className="space-y-5 max-h-[min(28rem,50vh)] overflow-y-auto pr-1">
        {REGION_ORDER.filter((r) => byRegion.has(r)).map((region) => (
          <motionlessRegionBlock
            key={region}
            region={region}
            items={byRegion.get(region)!}
            selected={selected}
            onToggle={toggle}
          />
        ))}
        {Array.from(byRegion.keys())
          .filter((r) => !REGION_ORDER.includes(r))
          .map((region) => (
            <motionlessRegionBlock
              key={region}
              region={region}
              items={byRegion.get(region)!}
              selected={selected}
              onToggle={toggle}
            />
          ))}
      </div>
    </div>
  );
}

function motionlessRegionBlock({
  region,
  items,
  selected,
  onToggle,
}: {
  region: string;
  items: SourceCatalogEntry[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {REGION_LABELS[region] ?? region}
      </h3>
      <ul className="space-y-2">
        {items.map((opt) => (
          <li key={opt.id}>
            <label className="flex gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
              <Checkbox
                checked={selected.includes(opt.id)}
                onCheckedChange={(checked) => onToggle(opt.id, checked === true)}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Briefcase
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{opt.name}</span>
                  {opt.status === "beta" && (
                    <Badge variant="secondary" className="text-[10px]">
                      Beta
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {opt.description}
                </p>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
