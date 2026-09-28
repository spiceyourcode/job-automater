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
    let resolvedTheme: "light" | "dark" = "light";

    if (theme === "system") {
      if (enableSystem && window.matchMedia) {
        resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
    } else {
      resolvedTheme = theme;
    }

    if (attribute === "class") {
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
    } else {
      root.setAttribute("data-theme", resolvedTheme);
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
        const resolvedTheme = mediaQuery.matches ? "dark" : "light";
        if (attribute === "class") {
          root.classList.remove("light", "dark");
          root.classList.add(resolvedTheme);
        } else {
          root.setAttribute("data-theme", resolvedTheme);
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [enableSystem, attribute, mounted]);

  if (!mounted) {
    return (
      <div
        style={{
          visibility: "hidden",
          position: "fixed",
          left: -9999,
        }}
        aria-hidden="true"
      >
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const ThemeContext = React.createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}