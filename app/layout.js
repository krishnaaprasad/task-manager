import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import Header from "@/components/Header";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Task Manager",
  description: "Creative Team Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-gray-100 dark:bg-gray-900`}
      >
        <ThemeProvider>
          <Header />
          <Toaster position="top-right" />
          <main className="pt-20 px-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
