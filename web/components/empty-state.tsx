import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type EmptyStateAction = {
  label: string;
  href: string;
  icon?: ReactNode;
};

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
};

/**
 * Canonical empty state per docs/UIUX_Design.md §9.2 — neutral, calm, one CTA.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && (
        <Button asChild className="cursor-pointer">
          <Link href={action.href}>
            {action.icon}
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
