"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  Layers,
  LineChart,
  Lock,
  Radar,
  Sparkles,
  Workflow,
} from "lucide-react";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { LandingProductPreview } from "@/components/marketing/landing-product-preview";
import { LandingFaq } from "@/components/marketing/landing-faq";
import { WavesBackground } from "@/components/waves-background";
import Aurora from "@/components/Aurora";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const sourceChips = [
  "Remote boards",
  "Company feeds",
  "Email alerts",
  "Curated catalogs",
];

const pipelineSteps = [
  {
    label: "Collect",
    icon: Radar,
    detail: "RSS, APIs, and presets from one catalog.",
  },
  {
    label: "Match",
    icon: LineChart,
    detail: "Scores tied to your indexed CV.",
  },
  {
    label: "Draft",
    icon: Sparkles,
    detail: "Tailored materials with source grounding.",
  },
  {
    label: "Approve",
    icon: Lock,
    detail: "Nothing submits until you confirm.",
  },
];

/**
 * Marketing landing — HG-1: no API keys or secrets in client bundle.
 */
export function LandingPage() {
  const reduceMotion = useReducedMotion() ?? false;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="relative flex min-h-screen flex-col text-foreground">
      <LandingBackdrop reduceMotion={reduceMotion} />

      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-10">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            JobAutomater
          </Link>
          <nav
            className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
            aria-label="Primary"
          >
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pipeline" className="transition-colors hover:text-foreground">
              Pipeline
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2" aria-label="Account">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="cursor-pointer shadow-sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero — split; waves + mesh live in this section so they stay visible */}
      <section
        className="relative isolate min-h-[min(100svh,920px)] overflow-hidden px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-20"
        aria-labelledby="landing-hero"
      >
        <HeroAtmosphere reduceMotion={reduceMotion} isDark={isDark} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="text-center lg:text-left landing-fade-up">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5 rounded-full bg-primary">
                {!reduceMotion && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                )}
              </span>
              Approval-first job automation
            </p>

            <h1
              id="landing-hero"
              className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl lg:text-[3.35rem] lg:leading-[1.08]"
            >
              Your job search,{" "}
              <span className="text-primary">orchestrated.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:mx-0 mx-auto">
              Stop juggling tabs and copy-paste. We collect roles, score fit against your CV,
              draft grounded applications—and wait for your sign-off before anything goes out.
            </p>

            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center">
              <Button asChild size="lg" className="group h-12 cursor-pointer px-8">
                <Link href="/register">
                  Start free
                  <ArrowRight
                    className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 cursor-pointer border-border/80 bg-background/80 px-8 shadow-sm backdrop-blur-sm"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground lg:justify-start">
              {["No credit card", "GDPR-conscious", "You approve every apply"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <LandingProductPreview className="lg:justify-self-end" />
        </div>
      </section>

      {/* Source strip */}
      <section
        className="relative z-10 border-y border-border/50 bg-muted/40 px-6 py-8 backdrop-blur-sm md:px-10"
        aria-label="Supported sources"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Works with your stack
          </p>
          <ul className="flex flex-wrap justify-center gap-2">
            {sourceChips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bento features */}
      <section
        id="features"
        className="relative z-10 scroll-mt-24 bg-background px-6 py-20 md:px-10 md:py-28"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              Why JobAutomater
            </p>
            <h2
              id="features-heading"
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Premium automation, human judgment
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              The polish of a modern SaaS landing—with the control model of a serious workflow tool.
            </p>
          </div>

          <BentoGrid>
            <BentoGridItem
              className="md:col-span-2"
              title="Curated job sources"
              description="Pick boards from our catalog during onboarding—no CSS selectors, no feed archaeology."
              icon={<Layers className="h-5 w-5 text-primary" />}
              header={
                <div className="flex h-full min-h-[6rem] w-full flex-1 items-center justify-between rounded-lg border border-border/50 bg-gradient-to-br from-primary/15 via-muted/40 to-background p-4">
                  <Layers className="h-8 w-8 text-primary" aria-hidden />
                  <div className="flex gap-1">
                    {["RSS", "API", "IMAP"].map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              }
            />
            <BentoGridItem
              title="Match scores you can trust"
              description="Every role is ranked against your indexed CV with explainable fit—not a black box."
              icon={<LineChart className="h-5 w-5 text-primary" />}
              header={
                <div className="flex h-full min-h-[6rem] items-end justify-end rounded-lg bg-muted/40 p-4">
                  <span className="text-4xl font-semibold tracking-tight text-primary">92</span>
                </div>
              }
            />
            <BentoGridItem
              title="Grounded documents"
              description="CV and cover letter drafts trace back to your content. You confirm before anything ships."
              icon={<Sparkles className="h-5 w-5 text-primary" />}
              header={
                <div className="min-h-[6rem] space-y-2 rounded-lg bg-muted/40 p-4 text-[10px] text-muted-foreground">
                  <p className="rounded border border-border/60 bg-background/80 px-2 py-1">
                    · Led API migration to event-driven stack
                  </p>
                  <p className="rounded border border-dashed border-primary/30 px-2 py-1">
                    Sourced from your CV — not invented
                  </p>
                </div>
              }
            />
            <BentoGridItem
              className="md:col-span-2"
              title="Pipeline you can audit"
              description="Collect → match → draft → approve. Every step visible. Rate limits and gates built in."
              icon={<Workflow className="h-5 w-5 text-primary" />}
              header={
                <div className="flex min-h-[6rem] items-center justify-center gap-3 rounded-lg bg-muted/30 px-4 text-xs text-muted-foreground">
                  {pipelineSteps.map((s) => (
                    <span key={s.label} className="rounded-full border border-border/60 px-3 py-1">
                      {s.label}
                    </span>
                  ))}
                </div>
              }
            />
          </BentoGrid>
        </div>
      </section>

      {/* Pipeline */}
      <section
        id="pipeline"
        className="relative z-10 scroll-mt-24 border-t border-border/50 bg-background px-6 py-20 md:px-10 md:py-28"
        aria-labelledby="pipeline-heading"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 id="pipeline-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Four stages. Zero surprise submissions.
            </h2>
            <p className="mt-4 text-muted-foreground md:text-lg">
              Designed like the job search should have been—continuous, measured, and under your control.
            </p>
          </div>

          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pipelineSteps.map((step, stepIndex) => (
              <li
                key={step.label}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span className="absolute -top-3 left-6 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {String(stepIndex + 1).padStart(2, "0")}
                </span>
                <step.icon className="mb-4 h-6 w-6 text-primary" aria-hidden />
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-24 border-t border-border/50 bg-muted/20 px-6 py-20 md:px-10 md:py-28"
        aria-labelledby="faq-heading"
      >
        <div className="mx-auto max-w-6xl">
          <h2
            id="faq-heading"
            className="text-center text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Questions, answered
          </h2>
          <p className="mx-auto mt-4 mb-10 max-w-lg text-center text-muted-foreground">
            Straightforward policies for a product that touches your career data.
          </p>
          <LandingFaq />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:px-10 md:py-24" aria-labelledby="cta-heading">
        <div className="landing-cta-glow mx-auto max-w-4xl rounded-3xl border border-border/80 bg-card/60 px-8 py-14 text-center backdrop-blur-md md:px-16">
          <h2 id="cta-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready when you are
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground md:text-lg">
            Create an account, connect sources from the catalog, and let the pipeline run while you sleep.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="group h-12 cursor-pointer px-8">
              <Link href="/register">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 cursor-pointer">
              <Link href="/login">I already have one</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border/50 px-6 py-10 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JobAutomater
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Page-wide subtle tone below the hero (hero has its own atmosphere). */
function LandingBackdrop({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-20 bg-background"
      aria-hidden
    >
      <div
        className={`landing-hero-atmosphere absolute inset-0 opacity-60 ${reduceMotion ? "" : "landing-atmosphere-pulse"}`}
      />
    </div>
  );
}

function HeroAtmosphere({
  reduceMotion,
  isDark,
}: {
  reduceMotion: boolean;
  isDark: boolean;
}) {
  const auroraStops = isDark
    ? ["#3f3f46", "#71717a", "#27272a"]
    : ["#e5e5e5", "#a3a3a3", "#525252"];

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="landing-mesh landing-hero-atmosphere absolute inset-0 opacity-40"
        animate={
          reduceMotion
            ? {}
            : {
                opacity: [0.35, 0.5, 0.35],
              }
        }
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 h-full min-h-[420px]">
        <Aurora
          colorStops={auroraStops}
          amplitude={0.9}
          blend={0.48}
          speed={reduceMotion ? 0 : 0.55}
          height={0.52}
          scale={1.05}
          glow={0.55}
          brightness={isDark ? 1.1 : 0.85}
          layers={2}
          direction="top"
          mouseInteraction={!reduceMotion}
          intro={!reduceMotion}
          opacity={isDark ? 0.85 : 0.65}
          lightMode={!isDark}
          paused={reduceMotion}
          className="h-full w-full"
        />
      </div>
      <WavesBackground
        lineColor="currentColor"
        backgroundColor="transparent"
        waveSpeedX={0.012}
        waveSpeedY={0.004}
        waveAmpX={32}
        waveAmpY={16}
        xGap={14}
        yGap={28}
        friction={0.92}
        tension={0.003}
        maxCursorMove={100}
        className="absolute inset-0 text-foreground opacity-[0.14] dark:opacity-[0.28]"
      />
      <div className="landing-grid absolute inset-0 opacity-[0.35] dark:opacity-[0.45]" />
    </div>
  );
}

export default LandingPage;
