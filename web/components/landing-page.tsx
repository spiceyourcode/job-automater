import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Marketing landing — HG-1: no API keys or secrets in client bundle.
 * Uses product neutral palette (shadcn new-york); brand is the hero signal.
 */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
        <p className="text-sm font-semibold tracking-tight">JobAutomater</p>
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

      <section
        className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden px-6 pb-16 pt-28 md:px-10 md:pb-20"
        aria-labelledby="landing-brand"
      >
        {/* Full-bleed atmosphere — product pipeline silhouette, not a card */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,oklch(0.92_0_0),transparent_55%),radial-gradient(ellipse_at_80%_10%,oklch(0.88_0_0),transparent_50%),linear-gradient(180deg,oklch(0.97_0_0),oklch(1_0_0)_45%,oklch(0.96_0_0))]"
          aria-hidden
        />
        <div
          className="landing-grid pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
        />
        <svg
          className="landing-hero-art pointer-events-none absolute -right-8 top-24 h-[55vh] w-[70vw] max-w-3xl text-foreground/10 md:right-0 md:top-16"
          viewBox="0 0 640 420"
          fill="none"
          aria-hidden
        >
          <rect x="40" y="40" width="200" height="280" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="220" y="80" width="200" height="280" rx="4" stroke="currentColor" strokeWidth="2" />
          <rect x="400" y="120" width="200" height="280" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M140 120h80M140 160h60M140 200h90" stroke="currentColor" strokeWidth="2" />
          <path d="M320 160h80M320 200h70M320 240h90" stroke="currentColor" strokeWidth="2" />
          <circle cx="500" cy="200" r="36" stroke="currentColor" strokeWidth="2" />
          <path d="M500 172v28l18 10" stroke="currentColor" strokeWidth="2" />
        </svg>

        <div className="relative z-10 max-w-2xl">
          <h1
            id="landing-brand"
            className="landing-fade-up text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
          >
            JobAutomater
          </h1>
          <p className="landing-fade-up landing-delay-1 mt-5 max-w-lg text-lg text-muted-foreground md:text-xl">
            Collect roles, match your CV, and apply only after you approve.
          </p>
          <div className="landing-fade-up landing-delay-2 mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="cursor-pointer">
              <Link href="/register">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="cursor-pointer">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        className="border-t px-6 py-20 md:px-10"
        aria-labelledby="how-heading"
      >
        <h2 id="how-heading" className="text-2xl font-semibold tracking-tight">
          From feed to approved apply
        </h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          One pipeline. You stay in control of every submission.
        </p>
        <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Collect", "RSS, APIs, and email sources land in one inbox."],
            ["Match", "Scores explain fit against your indexed CV."],
            ["Generate", "Tailored docs stay grounded in your content."],
            ["Approve", "Nothing submits until you say yes."],
          ].map(([title, body], i) => (
            <li key={title} className="space-y-2">
              <p className="text-xs tabular-nums text-muted-foreground">
                0{i + 1}
              </p>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="border-t bg-muted/40 px-6 py-20 md:px-10"
        aria-labelledby="trust-heading"
      >
        <h2 id="trust-heading" className="text-2xl font-semibold tracking-tight">
          Built for careful automation
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Approval gates, rate limits, and private document handling keep
          high-stakes apply flows from running away on their own.
        </p>
      </section>

      <footer className="mt-auto border-t px-6 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} JobAutomater</p>
          <div className="flex gap-4">
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
