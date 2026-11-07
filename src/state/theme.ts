import { useCallback, useState } from "react";

// Dark is the default. The choice is kept per browser and applied to <html data-theme>.

export type Theme = "dark" | "light";
const KEY = "dmb.theme";

export function storedTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // Storage can be blocked; the theme still changes for this visit.
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}
