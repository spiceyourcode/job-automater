"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  completeOnboardingAction,
  saveIdentityAction,
  savePreferencesAction,
  saveSkillsAction,
  uploadCvAction,
} from "@/lib/actions/profile";

const STEPS = [
  { id: "identity", title: "Professional identity" },
  { id: "skills", title: "Skills & expertise" },
  { id: "preferences", title: "Preferences" },
  { id: "cv", title: "CV upload" },
  { id: "sources", title: "Source quick-start" },
] as const;

const identitySchema = z.object({
  headline: z.string().min(1, "Headline is required").max(120),
  summary: z.string().min(1, "Summary is required").max(500),
  yearsExperience: z.coerce.number().int().nonnegative(),
  currentRole: z.string().min(1, "Current role is required").max(255),
  currentCompany: z.string().max(255).optional(),
});

const skillItemSchema = z.object({
  name: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  years: z.coerce.number().int().nonnegative().optional(),
});

const skillsSchema = z.object({
  skills: z
    .array(skillItemSchema)
    .min(5, "Add at least 5 skills")
    .refine((s) => s.some((x) => x.level === "expert"), {
      message: "At least one skill must be marked expert",
    }),
});

const preferencesSchema = z
  .object({
    roles: z.string().min(1, "Enter at least one target role"),
    locations: z.string().min(1, "Enter at least one location"),
    remoteOk: z.boolean(),
    salaryMinDollars: z.coerce.number().int().nonnegative(),
    salaryMaxDollars: z.coerce.number().int().positive(),
    employmentTypes: z.array(z.string()).min(1, "Select an employment type"),
    visaStatus: z.string().optional(),
  })
  .refine((d) => d.salaryMinDollars < d.salaryMaxDollars, {
    message: "Minimum salary must be less than maximum",
    path: ["salaryMaxDollars"],
  });

const SOURCE_OPTIONS = [
  { id: "linkedin_rss", label: "LinkedIn RSS" },
  { id: "indeed_email", label: "Indeed email alerts" },
  { id: "telegram", label: "Telegram channels" },
  { id: "career_pages", label: "Company career pages" },
] as const;

const LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [cvReady, setCvReady] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState({
    name: "",
    level: "intermediate" as (typeof LEVELS)[number],
    years: 1,
  });

  const identityForm = useForm<z.infer<typeof identitySchema>>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      headline: "",
      summary: "",
      yearsExperience: 0,
      currentRole: "",
      currentCompany: "",
    },
  });

  const skillsForm = useForm<z.infer<typeof skillsSchema>>({
    resolver: zodResolver(skillsSchema),
    defaultValues: { skills: [] },
  });

  const preferencesForm = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      roles: "",
      locations: "",
      remoteOk: true,
      salaryMinDollars: 80000,
      salaryMaxDollars: 150000,
      employmentTypes: ["full-time"],
      visaStatus: "",
    },
  });

  const progress = ((step + 1) / STEPS.length) * 100;
  const skills = skillsForm.watch("skills");

  function addSkill() {
    if (!skillDraft.name.trim()) {
      toast.error("Skill name is required");
      return;
    }
    const next = [...skillsForm.getValues("skills"), { ...skillDraft }];
    skillsForm.setValue("skills", next, { shouldValidate: true });
    setSkillDraft({ name: "", level: "intermediate", years: 1 });
  }

  function removeSkill(index: number) {
    const next = skillsForm.getValues("skills").filter((_, i) => i !== index);
    skillsForm.setValue("skills", next, { shouldValidate: true });
  }

  function onIdentity(values: z.infer<typeof identitySchema>) {
    startTransition(async () => {
      const result = await saveIdentityAction(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStep(1);
    });
  }

  function onSkills(values: z.infer<typeof skillsSchema>) {
    startTransition(async () => {
      const result = await saveSkillsAction({ technicalSkills: values.skills });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStep(2);
    });
  }

  function onPreferences(values: z.infer<typeof preferencesSchema>) {
    startTransition(async () => {
      const result = await savePreferencesAction({
        preferredRoles: values.roles
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((title) => ({ title })),
        preferredLocations: values.locations
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((city) => ({ city, remoteOk: values.remoteOk })),
        salaryMinDollars: values.salaryMinDollars,
        salaryMaxDollars: values.salaryMaxDollars,
        employmentTypes: values.employmentTypes,
        visaStatus: values.visaStatus,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setStep(3);
    });
  }

  function onCv(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      toast.error("Choose a PDF or DOCX file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const result = await uploadCvAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCvReady(true);
      toast.success("CV uploaded");
      setStep(4);
    });
  }

  function onSourcesComplete() {
    if (sources.length < 1) {
      toast.error("Select at least one source");
      return;
    }
    startTransition(async () => {
      const result = await completeOnboardingAction(sources);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You're all set");
      router.push("/dashboard");
    });
  }

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step].title}</span>
        </div>
        <Progress value={progress} aria-label="Onboarding progress" />
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Professional identity</CardTitle>
            <CardDescription>
              Tell us how you present yourself to employers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...identityForm}>
              <form
                onSubmit={identityForm.handleSubmit(onIdentity)}
                className="space-y-4"
              >
                <FormField
                  control={identityForm.control}
                  name="headline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Senior Backend Engineer"
                          maxLength={120}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={identityForm.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Summary</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief professional summary"
                          maxLength={500}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={identityForm.control}
                  name="yearsExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of experience</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={identityForm.control}
                  name="currentRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current role</FormLabel>
                      <FormControl>
                        <Input placeholder="Staff Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={identityForm.control}
                  name="currentCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current company (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={isPending}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills & expertise</CardTitle>
            <CardDescription>
              Add at least 5 skills; at least one must be expert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {skills.map((s, i) => (
                <Badge key={`${s.name}-${i}`} variant="secondary" className="gap-1">
                  {s.name} · {s.level}
                  <button
                    type="button"
                    className="cursor-pointer ml-1"
                    aria-label={`Remove ${s.name}`}
                    onClick={() => removeSkill(i)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            {skillsForm.formState.errors.skills && (
              <p className="text-sm text-destructive" role="alert">
                {skillsForm.formState.errors.skills.message ||
                  skillsForm.formState.errors.skills.root?.message}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <Input
                placeholder="Skill name"
                value={skillDraft.name}
                onChange={(e) =>
                  setSkillDraft((d) => ({ ...d, name: e.target.value }))
                }
                aria-label="Skill name"
              />
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={skillDraft.level}
                onChange={(e) =>
                  setSkillDraft((d) => ({
                    ...d,
                    level: e.target.value as (typeof LEVELS)[number],
                  }))
                }
                aria-label="Skill level"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                className="w-20"
                value={skillDraft.years}
                onChange={(e) =>
                  setSkillDraft((d) => ({
                    ...d,
                    years: Number(e.target.value),
                  }))
                }
                aria-label="Years with skill"
              />
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={addSkill}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setStep(0)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 cursor-pointer"
                disabled={isPending}
                onClick={skillsForm.handleSubmit(onSkills)}
              >
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Job preferences</CardTitle>
            <CardDescription>
              Roles, locations, and salary range (USD)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...preferencesForm}>
              <form
                onSubmit={preferencesForm.handleSubmit(onPreferences)}
                className="space-y-4"
              >
                <FormField
                  control={preferencesForm.control}
                  name="roles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target roles (comma-separated)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Senior Engineer, Staff Engineer"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={preferencesForm.control}
                  name="locations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Locations (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="San Francisco, Remote" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={preferencesForm.control}
                  name="remoteOk"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Remote OK</FormLabel>
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={preferencesForm.control}
                    name="salaryMinDollars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary min (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={preferencesForm.control}
                    name="salaryMaxDollars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary max (USD)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={preferencesForm.control}
                  name="employmentTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment types</FormLabel>
                      <div className="space-y-2">
                        {["full-time", "contract", "freelance"].map((type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={field.value.includes(type)}
                              onCheckedChange={(checked) => {
                                const next = checked
                                  ? [...field.value, type]
                                  : field.value.filter((t) => t !== type);
                                field.onChange(next);
                              }}
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer"
                    onClick={() => setStep(1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 cursor-pointer"
                    disabled={isPending}
                  >
                    {isPending && (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden
                      />
                    )}
                    Continue
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload your CV</CardTitle>
            <CardDescription>PDF or DOCX, max 10MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 cursor-pointer hover:bg-muted/40">
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">
                Click to choose a file
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(e) => onCv(e.target.files)}
              />
            </label>
            {cvReady && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4" aria-hidden /> CV uploaded
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 cursor-pointer"
                disabled={!cvReady || isPending}
                onClick={() => setStep(4)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect sources</CardTitle>
            <CardDescription>
              Pick at least one channel to watch (wiring to collectors is Phase 2)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {SOURCE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer"
                >
                  <Checkbox
                    checked={sources.includes(opt.id)}
                    onCheckedChange={(checked) => {
                      setSources((prev) =>
                        checked
                          ? [...prev, opt.id]
                          : prev.filter((id) => id !== opt.id),
                      );
                    }}
                  />
                  <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={() => setStep(3)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 cursor-pointer"
                disabled={isPending || sources.length < 1}
                onClick={onSourcesComplete}
              >
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Finish → Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
