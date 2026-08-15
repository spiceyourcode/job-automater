"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  saveIdentityAction,
  savePreferencesAction,
  saveSkillsAction,
  reindexCvAction,
  type ProfileRow,
} from "@/lib/actions/profile";

type Skill = { name: string; level: "beginner" | "intermediate" | "advanced" | "expert"; years?: number };
type Role = { title: string };
type Location = { city: string; remoteOk?: boolean };

function asSkills(raw: unknown[]): Skill[] {
  const out: Skill[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    if (typeof o.name !== "string") continue;
    const level = o.level;
    if (
      level !== "beginner" &&
      level !== "intermediate" &&
      level !== "advanced" &&
      level !== "expert"
    ) {
      continue;
    }
    out.push({
      name: o.name,
      level,
      years: typeof o.years === "number" ? o.years : undefined,
    });
  }
  return out;
}

function asRoles(raw: unknown[]): Role[] {
  const out: Role[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const title = (r as { title?: unknown }).title;
    if (typeof title === "string") out.push({ title });
  }
  return out;
}

function asLocations(raw: unknown[]): Location[] {
  const out: Location[] = [];
  for (const l of raw) {
    if (!l || typeof l !== "object") continue;
    const o = l as { city?: unknown; remoteOk?: unknown };
    if (typeof o.city !== "string") continue;
    out.push({ city: o.city, remoteOk: Boolean(o.remoteOk) });
  }
  return out;
}

export function ProfileSettingsEditor({ profile }: { profile: ProfileRow }) {
  const [pending, startTransition] = useTransition();
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [yearsExperience, setYears] = useState(profile.yearsExperience ?? 0);
  const [currentRole, setCurrentRole] = useState(profile.currentRole ?? "");
  const [currentCompany, setCompany] = useState(profile.currentCompany ?? "");
  const [skills, setSkills] = useState<Skill[]>(asSkills(profile.technicalSkills));
  const [roles, setRoles] = useState<Role[]>(asRoles(profile.preferredRoles));
  const [locations, setLocations] = useState<Location[]>(
    asLocations(profile.preferredLocations),
  );
  // Display dollars — API stores integer cents (HG-3)
  const [salaryMinDollars, setMin] = useState(
    profile.salaryMin != null ? Math.floor(profile.salaryMin / 100) : 0,
  );
  const [salaryMaxDollars, setMax] = useState(
    profile.salaryMax != null ? Math.floor(profile.salaryMax / 100) : 0,
  );
  const [employmentTypes, setEmploymentTypes] = useState(
    profile.employmentTypes?.length ? profile.employmentTypes.join(", ") : "full-time",
  );

  function saveOverview() {
    startTransition(async () => {
      const r = await saveIdentityAction({
        headline,
        summary,
        yearsExperience,
        currentRole,
        currentCompany: currentCompany || undefined,
      });
      if (!r.ok) toast.error(r.error);
      else toast.success("Overview saved");
    });
  }

  function saveSkills() {
    startTransition(async () => {
      const r = await saveSkillsAction({ technicalSkills: skills });
      if (!r.ok) toast.error(r.error);
      else toast.success("Skills saved");
    });
  }

  function savePrefs() {
    startTransition(async () => {
      const r = await savePreferencesAction({
        preferredRoles: roles,
        preferredLocations: locations,
        salaryMinDollars,
        salaryMaxDollars,
        employmentTypes: employmentTypes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        visaStatus: profile.visaStatus ?? undefined,
      });
      if (!r.ok) toast.error(r.error);
      else toast.success("Preferences saved");
    });
  }

  function reindex() {
    startTransition(async () => {
      const r = await reindexCvAction();
      if (!r.ok) toast.error(r.error);
      else toast.success("CV reindex queued");
    });
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="summary">Summary</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role">Current role</Label>
            <Input
              id="role"
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={currentCompany}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="years">Years experience</Label>
            <Input
              id="years"
              type="number"
              min={0}
              value={yearsExperience}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={saveOverview} disabled={pending} className="cursor-pointer">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save overview
        </Button>
      </TabsContent>

      <TabsContent value="skills" className="mt-4 space-y-4">
        <ul className="space-y-2">
          {skills.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-[10rem]"
                value={s.name}
                onChange={(e) => {
                  const next = [...skills];
                  next[i] = { ...s, name: e.target.value };
                  setSkills(next);
                }}
                aria-label={`Skill ${i + 1} name`}
              />
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={s.level}
                onChange={(e) => {
                  const next = [...skills];
                  next[i] = {
                    ...s,
                    level: e.target.value as Skill["level"],
                  };
                  setSkills(next);
                }}
                aria-label={`Skill ${i + 1} level`}
              >
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
                <option value="expert">expert</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                aria-label={`Remove skill ${s.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() =>
              setSkills([
                ...skills,
                { name: "New skill", level: "intermediate", years: 1 },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            Add skill
          </Button>
          <Button onClick={saveSkills} disabled={pending} className="cursor-pointer">
            Save skills
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={reindex}
            disabled={pending}
            className="cursor-pointer"
          >
            Re-index CV
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="preferences" className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>Target roles</Label>
          {roles.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={r.title}
                onChange={(e) => {
                  const next = [...roles];
                  next[i] = { title: e.target.value };
                  setRoles(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                aria-label={`Remove role ${r.title || i + 1}`}
                onClick={() => setRoles(roles.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setRoles([...roles, { title: "" }])}
          >
            Add role
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Locations</Label>
          {locations.map((l, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={l.city}
                onChange={(e) => {
                  const next = [...locations];
                  next[i] = { ...l, city: e.target.value };
                  setLocations(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                aria-label={`Remove location ${l.city || i + 1}`}
                onClick={() => setLocations(locations.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setLocations([...locations, { city: "", remoteOk: true }])}
          >
            Add location
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="salMin">Salary min (USD / year)</Label>
            <Input
              id="salMin"
              type="number"
              min={0}
              step={1000}
              value={salaryMinDollars}
              onChange={(e) => setMin(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salMax">Salary max (USD / year)</Label>
            <Input
              id="salMax"
              type="number"
              min={0}
              step={1000}
              value={salaryMaxDollars}
              onChange={(e) => setMax(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emp">Employment types (comma-separated)</Label>
          <Input
            id="emp"
            value={employmentTypes}
            onChange={(e) => setEmploymentTypes(e.target.value)}
          />
        </div>
        <Button onClick={savePrefs} disabled={pending} className="cursor-pointer">
          Save preferences
        </Button>
      </TabsContent>
    </Tabs>
  );
}
