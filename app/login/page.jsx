"use client";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

export default function LoginPage() {
   const handleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#ff0044]/20 blur-[160px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-[#fcba03]/20 blur-[170px] rounded-full" />

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-8 animate-fadeIn">

        <div className="flex justify-center mb-6">
          <Image src="/smaaash-logo.png" width={180} height={60} alt="logo"/>
        </div>

        <h2 className="text-white text-center text-2xl font-semibold mb-2 tracking-wide">
          Marketing Team Dashboard
        </h2>

        <p className="text-gray-300 text-center text-sm mb-8">
          Login using your official Google account to continue
        </p>

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#ff0044] hover:bg-[#e6003e] text-white font-medium px-5 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-[#ff0044]/30"
        >
          Sign in with Google
        </button>

        <p className="text-gray-400 text-xs mt-6 text-center">
          © {new Date().getFullYear()} Smaaash Entertainment • Internal Use Only
        </p>
      </div>
    </div>
  );
}
