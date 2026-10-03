"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, useReducedMotion } from "motion/react";
import { Briefcase, Sparkles, Zap, Shield, ArrowRight, Check } from "lucide-react";
import { WavesBackground } from "@/components/waves-background";
import { SplitText, FoldText } from "@/components/text-animations";
import { BlurText } from "@/components/ui/blur-text";

/**
 * Marketing landing — HG-1: no API keys or secrets in client bundle.
 * Uses product neutral palette (shadcn new-york); brand is the hero signal.
 */
export function LandingPage() {
  const reduceMotion = useReducedMotion() ?? false;

  const features = [
    {
      icon: Sparkles,
      title: "Collect",
      description: "RSS, APIs, and email sources land in one inbox.",
    },
    {
      icon: Zap,
      title: "Match",
      description: "Scores explain fit against your indexed CV.",
    },
    {
      icon: Briefcase,
      title: "Generate",
      description: "Tailored docs stay grounded in your content.",
    },
    {
      icon: Shield,
      title: "Approve",
      description: "Nothing submits until you say yes.",
    },
  ];

  const trustItems = [
    "Approval gates prevent runaway submissions",
    "Rate limits respect platform boundaries",
    "Private documents never leave your control",
    "GDPR compliant data handling",
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Animated atmospheric background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <AtmosphereBackground reduceMotion={reduceMotion} />
        <GridOverlay />
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/80 px-6 py-5 backdrop-blur-sm md:px-10">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          JobAutomater
        </p>
        <nav className="flex items-center gap-2" aria-label="Account">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="cursor-pointer">
            <Link href="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section
        className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-6 pb-16 pt-28 md:px-10 md:pb-20"
        aria-labelledby="landing-brand"
      >
        {/* Floating geometric shapes */}
        <FloatingShapes reduceMotion={reduceMotion} />

        {/* Waves background from ReactBits */}
        <WavesBackground
          lineColor="oklch(var(--primary) / 0.4)"
          backgroundColor="transparent"
          waveSpeedX={0.008}
          waveSpeedY={0.003}
          waveAmpX={40}
          waveAmpY={20}
          xGap={12}
          yGap={24}
          friction={0.93}
          tension={0.003}
          maxCursorMove={80}
          className="opacity-50 dark:opacity-80"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
              <span className="relative flex h-1.5 w-1.5 rounded-full bg-primary">
                <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
              </span>
              Free during beta
            </span>
          </motion.div>

          <SplitText
            text="JobAutomater"
            as="h1"
            splitType="chars"
            delay={40}
            duration={0.8}
            ease="easeOut"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            className="text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
            id="landing-brand"
          />

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut", delay: 0.2 }}
            className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground md:text-xl lg:text-2xl"
          >
            Collect roles, match your CV, and apply only after you approve.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut", delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button asChild size="lg" className="cursor-pointer group w-full sm:w-auto">
              <Link href="/register">
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="cursor-pointer group w-full sm:w-auto">
              <Link href="/login">
                I have an account
              </Link>
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut", delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span>GDPR compliant</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section
        className="relative px-6 py-20 md:px-10 lg:py-28"
        aria-labelledby="features-heading"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <FoldText
              text="From feed to approved apply"
              splitBy="word"
              hinge="top"
              duration={0.7}
              stagger={0.05}
              fontSize={48}
              fontWeight={700}
              className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
              id="features-heading"
            />
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground md:text-lg">
              One pipeline. You stay in control of every submission.
            </p>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut", delay: index * 0.1 }}
                className="group relative rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="relative flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline Visualization */}
      <section
        className="relative border-t px-6 py-20 md:px-10 lg:py-28"
        aria-labelledby="pipeline-heading"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
<BlurText
              text="One pipeline. Total control. Every step is visible. Nothing moves without you."
              animateBy="words"
              direction="top"
              delay={100}
              stepDuration={0.4}
              className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
              id="pipeline-heading"
            />
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground md:text-lg">
              Every step is visible. Nothing moves without you.
            </p>
          </motion.div>

          <div className="relative overflow-hidden">
            <PipelineVisualization reduceMotion={reduceMotion} />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section
        className="relative border-t bg-muted/40 px-6 py-20 md:px-10 lg:py-28"
        aria-labelledby="trust-heading"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
            className="text-center max-w-2xl mx-auto mb-12"
          >
            <h2 id="trust-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Built for careful automation
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground md:text-lg">
              Approval gates, rate limits, and private document handling keep
              high-stakes apply flows from running away on their own.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {trustItems.map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut", delay: index * 0.1 }}
                className="rounded-lg border border-border bg-card p-6"
              >
                <Check className="h-5 w-5 text-primary mb-2" aria-hidden />
                <p className="text-sm text-muted-foreground">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative border-t px-6 py-20 md:px-10 lg:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut" }}
          >
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Ready to take control of your job search?
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-muted-foreground md:text-lg">
              Join developers who let automation do the busywork.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.7, ease: "easeOut", delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button asChild size="lg" className="cursor-pointer group w-full sm:w-auto">
                <Link href="/register">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="cursor-pointer group w-full sm:w-auto">
                <Link href="/login">
                  I have an account
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="mt-auto border-t px-6 py-10 md:px-10">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} JobAutomater</p>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/register" className="hover:text-foreground">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* --- Background Components --- */

function AtmosphereBackground({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      className="landing-hero-atmosphere"
      animate={reduceMotion ? {} : { opacity: [1, 0.8, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function GridOverlay() {
  return <div className="landing-grid" style={{ opacity: 0.6 }} aria-hidden />;
}

function FloatingShapes({ reduceMotion }: { reduceMotion: boolean }) {
  const shapes = [
    { top: "10%", left: "5%", size: 120, delay: 0, color: "primary" },
    { top: "20%", right: "8%", size: 160, delay: 1, color: "secondary" },
    { bottom: "15%", left: "3%", size: 100, delay: 2, color: "destructive" },
    { bottom: "30%", right: "5%", size: 140, delay: 3, color: "accent" },
    { top: "50%", left: "50%", size: 80, delay: 0.5, color: "ring" },
  ];

  return (
    <>
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            top: shape.top,
            bottom: shape.bottom,
            left: shape.left,
            right: shape.right,
            width: shape.size,
            height: shape.size,
            backgroundColor: `var(--${shape.color})`,
            opacity: 0.08,
            border: "1px solid var(--border)",
          }}
          animate={reduceMotion
            ? {}
            : {
                x: [-30, 30, -30],
                y: [-20, 20, -20],
                rotate: [0, 180, 360],
                scale: [1, 1.1, 1],
              }}
          transition={{
            duration: 25 + i * 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: shape.delay,
          }}
        />
      ))}
    </>
  );
}

/* --- Feature Components --- */

function PipelineVisualization({ reduceMotion }: { reduceMotion: boolean }) {
  const stages = [
    { label: "Collect", icon: "📥", color: "blue", items: ["RSS feeds", "API sources", "Email alerts"] },
    { label: "Match", icon: "🎯", color: "purple", items: ["Skill fit", "Experience", "Location", "Salary"] },
    { label: "Generate", icon: "✍️", color: "green", items: ["Tailored CV", "Cover letter", "ATS-friendly PDF"] },
    { label: "Approve", icon: "✅", color: "orange", items: ["Review diffs", "Accept/reject", "One-click approve"] },
  ];

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute top-10 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative flex items-start justify-between gap-4 lg:gap-8">
        {stages.map((stage, index) => (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut", delay: index * 0.15 }}
            className="relative flex flex-col items-center w-full"
          >
            {/* Stage circle */}
            <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border-2 bg-background">
              <span className="text-2xl" aria-hidden>{stage.icon}</span>
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: stage.color }}
                animate={reduceMotion ? {} : { scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
              />
            </div>

            {/* Stage label */}
            <div className="mt-4 text-center">
              <h3 className="font-semibold text-sm">{stage.label}</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {stage.items.map((item) => (
                  <li key={item} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default LandingPage;