import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "stajio-theme";

function getInitialTheme(defaultTheme: "light" | "dark"): "light" | "dark" {
  if (typeof window === "undefined") return defaultTheme;
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return defaultTheme;
}

export function useTheme(defaultTheme: "light" | "dark" = "light") {
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme(defaultTheme));

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, setTheme, toggleTheme };
}
