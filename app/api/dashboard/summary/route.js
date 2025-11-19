// app/api/dashboard/summary/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  try {
    // total tasks (last 30 days)
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [{ count: totalTasksCount }] = await Promise.all([
      (async () => {
        const { data, error, count } = await supabase
          .from("tasks")
          .select("id", { count: "exact", head: false })
          .gte("created_at", since.toISOString());
        return { count: data?.length ?? 0 };
      })(),
    ]);

    // completed this month
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: completedRows } = await supabase
      .from("tasks")
      .select("id, completion_date")
      .gte("completion_date", monthStart.toISOString());

    const completedThisMonth = (completedRows || []).length;

    // pending approval, overdue, in-progress
    const { data: pending } = await supabase.from("tasks").select("id").eq("approval_status", "pending");
    const pendingApproval = (pending || []).length;

    const { data: overdueRows } = await supabase
      .from("tasks")
      .select("id, due_date")
      .lt("due_date", new Date().toISOString())
      .is("completion_date", null);

    const overdue = (overdueRows || []).length;

    const { data: inProgressRows } = await supabase.from("tasks").select("id").eq("stage", "Started");
    const inProgress = (inProgressRows || []).length;

    // by priority
    const { data: byPriorityRaw } = await supabase
      .from("tasks")
      .select("priority, count:task_number", { count: "exact" });

    // build priority counts (safe fallback)
    const priorities = ["Critical", "High", "Medium", "Low"];
    const byPriority = {};
    for (const p of priorities) byPriority[p] = 0;
    (byPriorityRaw || []).forEach(r => {
      const k = r.priority || "Medium";
      byPriority[k] = (byPriority[k] || 0) + 1;
    });

    // completed by day (last 30 days)
    const { data: allCompleted } = await supabase
      .from("tasks")
      .select("completion_date")
      .is("completion_date", null, { invert: true })
      .gte("completion_date", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString());

    const days = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0,10);
      days[key] = 0;
    }
    (allCompleted || []).forEach(r => {
      if (!r.completion_date) return;
      const k = new Date(r.completion_date).toISOString().slice(0,10);
      if (days[k] !== undefined) days[k] = days[k] + 1;
    });

    // by stage distribution
    const { data: byStageRaw } = await supabase
      .from("tasks")
      .select("stage, id");

    const byStage = { "Not Started": 0, "Started": 0, "Done": 0 };
    (byStageRaw || []).forEach(r => {
      const k = r.stage || "Not Started";
      byStage[k] = (byStage[k] || 0) + 1;
    });

    return NextResponse.json({
      totalTasks: totalTasksCount ?? 0,
      completedThisMonth,
      pendingApproval,
      overdue,
      inProgress,
      byPriority,
      completedByDay: Object.entries(days).map(([date, count]) => ({ date, count })),
      byStage,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
