"use client";

import {
  Children,
  useRef,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type AnimatedItemProps = {
  children: ReactNode;
  delay?: number;
  index: number;
};

function AnimatedItem({ children, delay = 0, index }: AnimatedItemProps) {
  const ref = useRef<HTMLLIElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { amount: 0.2, once: true });
  const visible = reduceMotion || inView;

  return (
    <motion.li
      ref={ref}
      data-index={index}
      initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
      animate={
        visible ? { scale: 1, opacity: 1 } : { scale: 0.92, opacity: 0 }
      }
      transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : delay }}
    >
      {children}
    </motion.li>
  );
}

type AnimatedListProps = {
  children: ReactNode;
  className?: string;
  /** Accessible name for the list. */
  "aria-label"?: string;
};

/**
 * React Bits AnimatedList (TS + Tailwind) — stagger in-view reveal.
 * @see https://www.reactbits.dev/components/animated-list
 */
export function AnimatedList({
  children,
  className,
  "aria-label": ariaLabel,
}: AnimatedListProps) {
  const items = Children.toArray(children);

  return (
    <ul className={cn("relative space-y-2", className)} aria-label={ariaLabel}>
      {items.map((child, index) => (
        <AnimatedItem
          key={(child as { key?: string | null }).key ?? index}
          index={index}
          delay={Math.min(index * 0.05, 0.35)}
        >
          {child}
        </AnimatedItem>
      ))}
    </ul>
  );
}

export default AnimatedList;
