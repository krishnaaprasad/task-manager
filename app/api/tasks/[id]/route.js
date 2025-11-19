import { supabase } from "@/lib/supabaseClient";

// Helper to add activity logs
function addActivity(previous, action, user) {
  const record = {
    action,
    user,
    timestamp: new Date().toISOString(),
  };
  return [...previous, record];
}

// UPDATE / PATCH
export async function PATCH(req, { params }) {
  const id = params.id;
  const body = await req.json();

  // Fetch existing task
  const { data: existingTask, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existingTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // Only manager can update
  if (body.role !== "manager") {
    return Response.json(
      { error: "Only manager can update tasks" },
      { status: 403 }
    );
  }

  const updatedActivity = addActivity(
    existingTask.activity,
    body.action || "Task Updated",
    body.updated_by
  );

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...body.update,
      activity: updatedActivity,
      updated_at: new Date(),
    })
    .eq("id", id)
    .select("*");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data[0], { status: 200 });
}

// DELETE (only manager)
export async function DELETE(req, { params }) {
  const id = params.id;
  const body = await req.json();

  if (body.role !== "manager") {
    return Response.json(
      { error: "Only manager can delete tasks" },
      { status: 403 }
    );
  }

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ message: "Task deleted" }, { status: 200 });
}
