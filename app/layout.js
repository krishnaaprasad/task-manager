// app/layout.js
"use client";

import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import HeaderWrapper from "@/components/HeaderWrapper";
import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";

export default function RootLayout({ children }) {

  useEffect(() => {
    // Persist session between refresh
    supabase.auth.getSession();

    // Auth State Listener
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        console.log("Signed in:", session.user.email);
      }
      if (event === "SIGNED_OUT") {
        window.location.href = "/"; // redirect to login
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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
