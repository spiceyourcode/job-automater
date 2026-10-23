import { type FC } from "react";

export interface CodeSlotsProps {
  length?: number;
  /** Controlled value. Omit for uncontrolled usage. */
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
  status?: "idle" | "error" | "success";
  mask?: boolean;
  caret?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  accentColor?: string;
  inkColor?: string;
  slotColor?: string;
  digitColor?: string;
  dangerColor?: string;
  slotSize?: number;
  gap?: number;
  radius?: number;
  bounce?: number;
  settle?: number;
  rise?: number;
  cascade?: number;
  ariaLabel?: string;
  className?: string;
}

declare const CodeSlots: FC<CodeSlotsProps>;
export default CodeSlots;
