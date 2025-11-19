// app/api/tasks/export/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function toCSV(rows) {
  const header = ["task_id","task_number","task_title","action","comment","user","timestamp"];
  const lines = [header.map(h => `"${h}"`).join(",")];
  rows.forEach(r => {
    const line = header.map(h => {
      const v = r[h] ?? "";
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(",");
    lines.push(line);
  });
  return lines.join("\n");
}

export async function GET() {
  try {
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
          timestamp: a.timestamp || "",
        });
      });
    });

    const csv = toCSV(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="task-activity-${new Date().toISOString()}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
