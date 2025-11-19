"use client";

import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

export default function LoginPage() {
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) console.error(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] relative overflow-hidden">

      {/* LIGHT GRADIENT EFFECTS */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#ff0044]/20 blur-[160px] rounded-full"></div>
      <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-[#fcba03]/20 blur-[170px] rounded-full"></div>

      {/* CARD */}
      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-8 animate-fadeIn">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/smaaash-logo.png"
            alt="Smaaash Logo"
            width={180}
            height={60}
            className="drop-shadow-xl"
          />
        </div>

        <h2 className="text-white text-center text-2xl font-semibold mb-2 tracking-wide">
          Marketing Team Dashboard
        </h2>

        <p className="text-gray-300 text-center text-sm mb-8">
          Login using your official Google account to continue
        </p>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-[#ff0044] hover:bg-[#e6003e] text-white font-medium px-5 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-[#ff0044]/30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 488 512"
            className="w-5 h-5"
            fill="white"
          >
            <path d="M488 261.8C488 403.3 391.1 504 248.9 504 111.3 504 0 392.7 0 255.1 0 117.5 111.3 6.2 248.9 6.2c66.3 0 121.5 24.1 164.8 64.3l-66.8 64.3c-18.1-17-50.3-36.6-98-36.6-83.6 0-151.2 69.2-151.2 156.8s67.6 156.8 151.2 156.8c96.1 0 132.1-69 137.6-104.8H248.9v-84.3h238.9c2.3 13.4 3.2 26.8 3.2 40.4z" />
          </svg>
          Sign in with Google
        </button>

        <p className="text-gray-400 text-xs mt-6 text-center">
          © {new Date().getFullYear()} Smaaash Entertainment • Internal Use Only
        </p>
      </div>
    </div>
  );
}
