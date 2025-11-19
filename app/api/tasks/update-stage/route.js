// app/api/tasks/update-stage/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { task_id, new_stage, changed_by } = await req.json();

    // Activity log entry
    const activityEntry = {
      action: `Stage changed to ${new_stage}`,
      by: changed_by,
      at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("tasks")
      .update({
        stage: new_stage,
        approved: new_stage === "Approved",
        updated_at: new Date(),
        activity: supabase.sql`coalesce(activity, '[]'::jsonb) || ${activityEntry}::jsonb`
      })
      .eq("id", task_id)
      .select();

    if (error) return NextResponse.json({ error }, { status: 400 });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
