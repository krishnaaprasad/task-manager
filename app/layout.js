"use client";

import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import HeaderWrapper from "@/components/HeaderWrapper";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="pt-16 bg-gray-100 dark:bg-gray-900">
        <ThemeProvider>
          <HeaderWrapper />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
