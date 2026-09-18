"use client";

import { cn } from "@/lib/utils";
import { motion, useAnimate, useReducedMotion } from "motion/react";
import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

type StatefulButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "onClick"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    children: React.ReactNode;
    onClick?: (
      event: React.MouseEvent<HTMLButtonElement>,
    ) => void | Promise<void>;
  };

export const StatefulButton = ({
  className,
  children,
  disabled,
  type = "button",
  variant = "outline",
  size = "default",
  ...props
}: StatefulButtonProps) => {
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = React.useState(false);
  const compact = size === "sm" || size === "xs" || size === "icon" || size === "icon-sm" || size === "icon-xs";

  const animateLoading = async () => {
    await animate(
      ".loader",
      { width: compact ? "16px" : "20px", scale: 1, display: "block" },
      { duration: reduceMotion ? 0 : 0.2 },
    );
  };

  const hideLoader = async () => {
    await animate(
      ".loader",
      { width: "0px", scale: 0, display: "none" },
      { duration: reduceMotion ? 0 : 0.2 },
    );
  };

  const animateSuccess = async () => {
    await hideLoader();
    await animate(
      ".check",
      { width: compact ? "16px" : "20px", scale: 1, display: "block" },
      { duration: reduceMotion ? 0 : 0.2 },
    );
    await animate(
      ".check",
      { width: "0px", scale: 0, display: "none" },
      { delay: reduceMotion ? 0 : 2, duration: reduceMotion ? 0 : 0.2 },
    );
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || busy) return;
    event.preventDefault();
    setBusy(true);
    try {
      await animateLoading();
      await props.onClick?.(event);
      await animateSuccess();
    } catch {
      await hideLoader();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      layout
      ref={scope}
      type={type === "submit" ? "button" : type}
      disabled={disabled || busy}
      aria-busy={busy}
      className={cn(
        buttonVariants({ variant, size }),
        !compact && "min-w-[120px]",
        "cursor-pointer",
        className,
      )}
      onClick={handleClick}
    >
      <motion.div layout className="flex items-center justify-center gap-2">
        <Loader />
        <CheckIcon />
        <motion.span layout className="inline-flex items-center gap-2">
          {children}
        </motion.span>
      </motion.div>
    </motion.button>
  );
};

const Loader = () => {
  return (
    <motion.svg
      animate={{ rotate: [0, 360] }}
      initial={{ scale: 0, width: 0, display: "none" }}
      style={{ scale: 0.5, display: "none" }}
      transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="loader text-current"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </motion.svg>
  );
};

const CheckIcon = () => {
  return (
    <motion.svg
      initial={{ scale: 0, width: 0, display: "none" }}
      style={{ scale: 0.5, display: "none" }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="check text-current"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </motion.svg>
  );
};
