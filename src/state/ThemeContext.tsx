// ThemeContext.tsx — Exposes the App's light/dark state to children that
// can't use Tailwind's `dark:` variant — namely SVG fills inside pet and
// furniture renderers. Mirrors the inline state pattern in App.tsx
// (localStorage-backed); App is the only writer.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppTheme = "light" | "dark";

const THEME_PREF_KEY = "triptych.app.theme";

function loadTheme(): AppTheme {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(THEME_PREF_KEY) === "dark" ? "dark" : "light";
}

type ThemeContextValue = {
  theme: AppTheme;
  dark: boolean;
  toggle: () => void;
  setTheme: (t: AppTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(loadTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_PREF_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, dark: theme === "dark", toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
