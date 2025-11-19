"use client";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle dark / light"
      className={
        "flex items-center gap-2 px-3 py-1 rounded-lg border transition shadow-sm " +
        "bg-white/90 dark:bg-gray-800/90 text-sm " +
        className
      }
    >
      {theme === "dark" ? (
        <>
          <span className="text-lg">🌙</span>
          <span className="hidden sm:inline">Dark</span>
        </>
      ) : (
        <>
          <span className="text-lg">☀️</span>
          <span className="hidden sm:inline">Light</span>
        </>
      )}
    </button>
  );
}
