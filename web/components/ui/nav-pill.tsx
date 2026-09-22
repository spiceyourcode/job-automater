"use client";

import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface NavPillProps {
  activeHref: string;
  children: React.ReactNode;
  className?: string;
}

export function NavPill({ activeHref, children, className }: NavPillProps) {
  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <motion.nav
      layout
      className={cn("relative flex items-center gap-1", className)}
      role="navigation"
      aria-label="Main navigation"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeHref}
          layoutId="active-pill"
          className="absolute h-full rounded-md bg-primary/10"
          transition={prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 30 }}
          initial={false}
          style={{ pointerEvents: "none" }}
        />
      </AnimatePresence>
      {children}
    </motion.nav>
  );
}