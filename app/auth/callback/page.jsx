"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.replace("/dashboard");
      else router.replace("/");
    }
    check();
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center text-white bg-black">
      Checking session...
    </div>
  );
}
