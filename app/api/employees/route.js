// app/api/employees/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabase.from("employees").select("id, full_name, email, role").order("full_name");
    if (error) return NextResponse.json({ error: error.message || error }, { status: 500 });
    return NextResponse.json({ employees: data });
  } catch (err) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
