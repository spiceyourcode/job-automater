"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Controller, ControllerRenderProps } from "react-hook-form";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  if (!password) return null;

  // Zxcvbn-inspired scoring (simplified)
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  score = Object.values(checks).filter(Boolean).length;

  // Bonus for length
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Cap at 5
  score = Math.min(score, 5);

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-destructive", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span className="font-medium text-muted-foreground">
          {labels[score - 1] ?? ""}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", colors[score - 1] ?? "")}
          style={{ width: `${(score / 5) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
        {Object.entries(checks).map(([key, passed]) => (
          <span key={key} className="flex items-center gap-1">
            {passed ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </span>
        ))}
        {password.length >= 12 && (
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> 12+ chars
          </span>
        )}
      </div>
    </div>
  );
}

interface PasswordInputProps {
  label: string;
  name: string;
  control: any;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  showStrengthMeter?: boolean;
}

export function PasswordInput({ label, name, control, placeholder, autoComplete = "new-password", required = true, showStrengthMeter = true }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? "Required" : false }}
      render={({ field }) => (
        <div className="space-y-1">
          <label htmlFor={name} className="block text-sm font-medium">
            {label}
          </label>
          <div className="relative">
            <input
              id={name}
              type={showPassword ? "text" : "password"}
              autoComplete={autoComplete}
              required={required}
              placeholder={placeholder}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              className="w-full pr-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-describedby={`${name}-strength`}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {showStrengthMeter && <PasswordStrengthMeter password={field.value} />}
        </div>
      )}
    />
  );
}