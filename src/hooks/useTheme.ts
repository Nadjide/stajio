import { useEffect, useState } from "react";

export function useTheme(defaultTheme: "light" | "dark" = "light") {
  const [theme, setTheme] = useState<"light" | "dark">(defaultTheme);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return { theme, setTheme, toggleTheme };
}
