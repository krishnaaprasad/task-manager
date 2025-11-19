"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (!emp) {
        router.replace("/login");
        return;
      }

      if (emp.role === "Manager") router.replace("/dashboard/manager");
      else router.replace("/dashboard/employee");
    }

    checkRole();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      Checking dashboard...
    </div>
  );
}
