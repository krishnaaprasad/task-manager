// app/api/notifications/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * GET  /api/notifications?user=email@example.com  -> { notifications: [...] }
 * POST /api/notifications  -> create notification (body: { user_email, title, message, task_id })
 * PATCH /api/notifications/mark-read  -> body { user_email } marks all unread read
 */

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const user = url.searchParams.get("user");
    if (!user) return NextResponse.json({ error: "Missing user param" }, { status: 400 });

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", user)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notifications: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { user_email, title, message = "", task_id = null } = body;
    if (!user_email || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const { data, error } = await supabase
      .from("notifications")
      .insert([{ user_email, title, message, task_id }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ notification: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** mark all unread as read for user */
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { user_email } = body;
    if (!user_email) return NextResponse.json({ error: "Missing user_email" }, { status: 400 });

    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_email", user_email)
      .eq("read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
