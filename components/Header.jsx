"use client";

import { useTheme } from "@/context/ThemeContext";
import { SunIcon, MoonIcon } from "@heroicons/react/24/solid";

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b dark:border-gray-700 flex items-center justify-between px-6 z-50 shadow-sm">
      
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Creative Team Dashboard
      </h1>

      <button
        onClick={toggleTheme}
        className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        {theme === "light" ? (
          <MoonIcon className="w-6 h-6 text-gray-900" />
        ) : (
          <SunIcon className="w-6 h-6 text-yellow-300" />
        )}
      </button>
    </header>
  );
}
