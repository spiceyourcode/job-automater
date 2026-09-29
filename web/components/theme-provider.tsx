"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: "class" | "data-theme";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);
  const [mounted, setMounted] = React.useState(false);
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    let resolved: "light" | "dark" = "light";

    if (theme === "system") {
      if (enableSystem && window.matchMedia) {
        resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } else {
      resolved = theme;
    }

    setResolvedTheme(resolved);

    if (attribute === "class") {
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
    } else {
      root.setAttribute("data-theme", resolved);
    }

    localStorage.setItem("theme", theme);
  }, [theme, attribute, enableSystem, mounted]);

  React.useEffect(() => {
    if (!enableSystem || !mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored === "system") {
        const root = document.documentElement;
        const resolved = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(resolved);
        if (attribute === "class") {
          root.classList.remove("light", "dark");
          root.classList.add(resolved);
        } else {
          root.setAttribute("data-theme", resolved);
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [enableSystem, attribute, mounted]);

  // Always provide context - use default values on server
  const contextValue = React.useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

const ThemeContext = React.createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
} | null>(null);

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}