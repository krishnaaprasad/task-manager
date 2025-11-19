"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

export default function HeaderWrapper() {
  const pathname = usePathname();

  // Hide header ONLY on login page
  if (pathname === "/") return null;

  return <Header />;
}
