import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  score: number;
  size?: "sm" | "md" | "lg";
};

function tone(score: number): string {
  if (score >= 90) return "border-foreground/40 bg-foreground text-background";
  if (score >= 70) return "border-foreground/30 bg-muted text-foreground";
  if (score >= 50) return "border-border text-muted-foreground";
  return "border-border text-muted-foreground/80";
}

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-sm",
};

export function MatchScoreBadge({ score, size = "md" }: Props) {
  const rounded = Math.round(score);
  return (
    <Badge
      variant="outline"
      className={cn(sizes[size], tone(rounded), "font-medium tabular-nums")}
      aria-label={`${rounded} percent match`}
    >
      {rounded}%
    </Badge>
  );
}
