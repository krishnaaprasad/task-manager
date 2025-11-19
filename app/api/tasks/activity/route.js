// app/api/tasks/activity/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET: ?taskId=...  OR no query -> return flattened activity rows for all tasks
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");

    if (taskId) {
      const { data: task, error } = await supabase.from("tasks").select("activity").eq("id", taskId).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ activity: task?.activity || [] });
    }

    // Flatten activity across tasks
    const { data: tasks, error } = await supabase.from("tasks").select("id, task_number, title, activity");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = [];
    (tasks || []).forEach(t => {
      (t.activity || []).forEach(a => {
        rows.push({
          task_id: t.id,
          task_number: t.task_number,
          task_title: t.title,
          action: a.action,
          comment: a.comment || "",
          user: a.user || "",
          timestamp: a.timestamp || null,
        });
      });
    });

    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
