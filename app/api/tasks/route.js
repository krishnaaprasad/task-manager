// app/api/tasks/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------
// EMAIL SENDER
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST || !to) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Task Manager" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.log("Email error:", err);
  }
}

// ---------------------------------------------------------------------
// Notification helper (writes to notifications table)
async function createNotification(user_email, title, message = "", task_id = null) {
  try {
    if (!user_email || !title) return;
    await supabase.from("notifications").insert([{ user_email, title, message, task_id }]);
  } catch (err) {
    console.log("Notification error:", err.message || err);
  }
}

// =====================================================================
// GET ALL TASKS (supports optional viewerEmail query param for visibility)
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const viewerEmail = url.searchParams.get("viewerEmail") || null;

    // If viewerEmail provided, determine role and filter accordingly
    if (viewerEmail) {
      const { data: viewer } = await supabase
        .from("employees")
        .select("*")
        .eq("email", viewerEmail)
        .maybeSingle();

      const isManager = viewer?.role === "Manager";

      if (isManager) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ tasks: data });
      }

      // Non-manager: show tasks created by them OR tasks assigned to them but ONLY if approval_status === 'approved'
      const { data: createdTasks, error: cErr } = await supabase
        .from("tasks")
        .select("*")
        .or(`created_by_email.eq.${viewerEmail},assigned_to_email.eq.${viewerEmail}`)
        .order("created_at", { ascending: false });

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

      // Filter assigned tasks to only include those approved
      const visible = (createdTasks || []).filter(t => {
        if (t.created_by_email === viewerEmail) return true;
        if (t.assigned_to_email === viewerEmail) return t.approval_status === "approved";
        return false;
      });

      return NextResponse.json({ tasks: visible });
    }

    // No viewerEmail: return everything (fallback)
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tasks: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// =====================================================================
// CREATE TASK (with correct task_number)
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      title,
      brief,
      priority = "Medium",
      assigned_to_name = null,
      assigned_to_email = null,
      created_by_email,
      created_by_name,
      start_date,
      due_date,
      attachments = [],
    } = body;

    if (!title || !created_by_email)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // GET HIGHEST task_number
    const { data: lastTask } = await supabase
      .from("tasks")
      .select("task_number")
      .order("task_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNumber = lastTask?.task_number ? lastTask.task_number + 1 : 1;

    const task = {
      task_number: nextNumber,
      title,
      brief,
      priority,
      assigned_to_name,
      assigned_to_email,
      created_by_email,
      created_by_name,
      start_date,
      due_date,
      attachments: attachments || [],
      stage: "Not Started",
      approval_status: "pending",
      approval_required: true,
      pending_action: null,
      pending_value: null,
      activity: [
        {
          action: "Created",
          user: created_by_email,
          comment: "Task created",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert([task])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // notify manager
    const { data: manager } = await supabase
      .from("employees")
      .select("*")
      .eq("role", "Manager")
      .limit(1)
      .maybeSingle();

    if (manager?.email) {
      // email manager for approval
      sendEmail(
        manager.email,
        `Task Approval Needed: ${title}`,
        `<p>${created_by_name || created_by_email} created a new task <strong>${title}</strong>. Please review and approve.</p>`
      );

      // in-app notification
      await createNotification(
        manager.email,
        "New task awaiting approval",
        `${created_by_name || created_by_email} created "${title}"`,
        data.id
      );
    }

    // send confirmation email to creator (optional but requested)
    sendEmail(
      created_by_email,
      `Task created: ${title}`,
      `<p>You created task <strong>${title}</strong>. It will be visible to assignee after manager approval.</p>`
    );

    // NOTE: DO NOT email assignee here — per requirement assignee should get mail only AFTER manager approval.
    // we still create an in-app notification for assignee? We'll not notify assignee until approved.

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// =====================================================================
// UPDATE TASK (PUT)
export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, requester_email, updates } = body;

    if (!id)
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    if (!requester_email)
      return NextResponse.json({ error: "Missing requester_email" }, { status: 400 });

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // requester info
    const { data: requester } = await supabase
      .from("employees")
      .select("*")
      .eq("email", requester_email)
      .maybeSingle();

    const requesterName = requester?.full_name || requester_email;
    const isManager = requester?.role === "Manager";
    const isCreator = task.created_by_email === requester_email;
    const isAssignedEmployee = requester?.full_name && requester.full_name === task.assigned_to_name;

    // EMPLOYEE REQUESTS REASSIGN (non-manager → creates pending reassign)
    if (
      updates.assigned_to_name &&
      updates.assigned_to_name !== task.assigned_to_name &&
      !isManager
    ) {
      const pending = {
        pending_action: "reassign",
        pending_value: updates.assigned_to_name,
        approval_status: "pending",
        activity: [
          ...(task.activity || []),
          {
            action: "Reassign Requested",
            user: requester_email,
            comment: `Requested assign to ${updates.assigned_to_name}`,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await supabase.from("tasks").update(pending).eq("id", id);

      const { data: manager } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();

      if (manager?.email) {
        sendEmail(
          manager.email,
          `Reassign Request: ${task.title}`,
          `<p>${requesterName} requested reassign of "${task.title}" to ${updates.assigned_to_name}.</p>`
        );

        await createNotification(
          manager.email,
          "Reassign requested",
          `${requesterName} requested to assign "${task.title}" to ${updates.assigned_to_name}`,
          task.id
        );
      }

      return NextResponse.json({ pending: true });
    }

    // EMPLOYEE REQUEST DELETE
    if (updates.delete_task) {
      if (!isManager) {
        const pending = {
          pending_action: "delete",
          pending_value: null,
          approval_status: "pending",
          activity: [
            ...(task.activity || []),
            {
              action: "Delete Requested",
              user: requester_email,
              comment: `Requested deletion`,
              timestamp: new Date().toISOString(),
            },
          ],
        };

        await supabase.from("tasks").update(pending).eq("id", id);

        const { data: manager } = await supabase
          .from("employees")
          .select("*")
          .eq("role", "Manager")
          .limit(1)
          .maybeSingle();

        if (manager?.email) {
          sendEmail(
            manager.email,
            `Delete Request: ${task.title}`,
            `<p>${requesterName} requested deletion of "${task.title}".</p>`
          );
          await createNotification(
            manager.email,
            "Delete request",
            `${requesterName} requested deletion of "${task.title}"`,
            task.id
          );
        }

        return NextResponse.json({ pending: true });
      }

      // Manager deletes directly
      await supabase.from("tasks").delete().eq("id", id);
      return NextResponse.json({ deleted: true });
    }

    // MANUAL COMPLETION (Manager or Creator Only)
    if (updates.mark_complete === true) {
      if (!isManager && !isCreator) {
        return NextResponse.json({ error: "Only creator or manager can mark complete" }, { status: 403 });
      }

      const updated = {
        completion_date: new Date().toISOString(),
        stage: "Done",
        updated_at: new Date().toISOString(),
        activity: [
          ...(task.activity || []),
          {
            action: "Task Completed",
            user: requester_email,
            timestamp: new Date().toISOString(),
            comment: "Marked completed manually",
          },
        ],
      };

      const { data, error } = await supabase
        .from("tasks")
        .update(updated)
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // EMAIL + in-app notifications to creator, assignee, manager
      if (task.assigned_to_email) {
        sendEmail(
          task.assigned_to_email,
          `Task completed: ${task.title}`,
          `<p>The task <strong>${task.title}</strong> has been marked completed by ${requesterName}.</p>`
        );
        await createNotification(task.assigned_to_email, "Task marked complete", `"${task.title}" was marked complete`, id);
      }

      if (task.created_by_email) {
        sendEmail(
          task.created_by_email,
          `Task completed: ${task.title}`,
          `<p>Your task <strong>${task.title}</strong> was marked completed by ${requesterName}.</p>`
        );
        await createNotification(task.created_by_email, "Task marked complete", `"${task.title}" was marked complete`, id);
      }

      // notify manager (first manager found)
      const { data: manager } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();
      if (manager?.email) {
        sendEmail(
          manager.email,
          `Task completed: ${task.title}`,
          `<p>The task <strong>${task.title}</strong> was marked completed by ${requesterName}.</p>`
        );
        await createNotification(manager.email, "Task completed", `"${task.title}" was completed`, id);
      }

      return NextResponse.json({ task: data });
    }

    // ======== WORK STATUS UPDATE (includes "Send For Review") ========
    if (updates.stage) {
      // re-compute isAssignedEmployee (in case requester lookup earlier didn't match)
      const { data: requesterLatest } = await supabase
        .from("employees")
        .select("*")
        .eq("email", requester_email)
        .maybeSingle();

      const isAssignedEmployeeNow = requesterLatest?.full_name && requesterLatest.full_name === task.assigned_to_name;

      if (!isAssignedEmployeeNow && !isManager) {
        return NextResponse.json({ error: "Only assigned employee or manager can change stage" }, { status: 403 });
      }

      // SEND FOR REVIEW
      if (updates.stage === "Send For Review" || updates.stage === "Send for Review") {
        const newActivity = [
          ...(task.activity || []),
          {
            action: "Sent For Review",
            user: requester_email,
            timestamp: new Date().toISOString(),
            comment: `Task sent for review`,
          },
        ];

        const { data: updatedTask, error } = await supabase
          .from("tasks")
          .update({
            stage: "Send For Review",
            updated_at: new Date().toISOString(),
            activity: newActivity,
          })
          .eq("id", id)
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // notify creator
        await createNotification(
          updatedTask.created_by_email,
          "Task sent for review",
          `${requesterName} sent "${updatedTask.title}" for review`,
          id
        );

        // notify manager
        const { data: manager } = await supabase
          .from("employees")
          .select("*")
          .eq("role", "Manager")
          .limit(1)
          .maybeSingle();

        if (manager?.email) {
          await createNotification(manager.email, "Review Requested", `${requesterName} sent "${updatedTask.title}" for review`, id);
        }

        // notify assignee (if creator reviewing and assignee is not the requester)
        if (updatedTask.assigned_to_email && updatedTask.assigned_to_email !== requester_email) {
          await createNotification(updatedTask.assigned_to_email, "Task sent for review", `"${updatedTask.title}" was sent for review`, id);
        }

        return NextResponse.json({ task: updatedTask });
      }

      // NORMAL STAGE CHANGE
      const newActivity = [
        ...(task.activity || []),
        {
          action: "Stage Changed",
          user: requester_email,
          timestamp: new Date().toISOString(),
          comment: `Stage -> ${updates.stage}`,
        },
      ];

      const { data: updatedTask, error } = await supabase
        .from("tasks")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          activity: newActivity,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // notifications for normal stage change
      await createNotification(updatedTask.created_by_email, "Task status changed", `${requesterName} changed status of "${updatedTask.title}" to ${updatedTask.stage}`, id);

      if (updatedTask.assigned_to_email && updatedTask.assigned_to_email !== requester_email) {
        await createNotification(updatedTask.assigned_to_email, "Task status changed", `Status of "${updatedTask.title}" changed to ${updatedTask.stage}`, id);
      }

      const { data: manager2 } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();

      if (manager2?.email) {
        await createNotification(manager2.email, "Task status changed", `${requesterName} changed status of "${updatedTask.title}" to ${updatedTask.stage}`, id);
      }

      return NextResponse.json({ task: updatedTask });
    }

    // ================= NORMAL UPDATE (No auto completion) =================
    // Ensure activities array exists before using it (fix bug)
    const activities = [...(task.activity || [])];

    const updatedData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Handle new attachments
    if (updates.attachments && updates.attachments.length > 0) {
      updatedData.attachments = [
        ...(task.attachments || []),
        ...updates.attachments,
      ];

      activities.push({
        action: "Files Added",
        user: requester_email,
        timestamp: new Date().toISOString(),
        comment: `${updates.attachments.length} file(s) uploaded`,
        new_value: updates.attachments.map(f => f.name).join(", "),
      });
    }

    // detect brief/title change to add activity
    if (updates.title && updates.title !== task.title) {
      activities.push({
        action: "Title Changed",
        user: requester_email,
        timestamp: new Date().toISOString(),
        comment: `Title -> ${updates.title}`,
      });
    }
    if (Object.prototype.hasOwnProperty.call(updates, "brief") && updates.brief !== task.brief) {
      activities.push({
        action: "Brief Changed",
        user: requester_email,
        timestamp: new Date().toISOString(),
        comment: `Brief updated`,
      });
    }

    if (activities.length) updatedData.activity = activities;

    const { data, error } = await supabase
      .from("tasks")
      .update(updatedData)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // if brief/title changed -> notify creator/assignee/manager
    if (activities.length) {
      const titleMsg = updates.title ? `Title updated to "${updates.title}"` : null;
      const briefMsg = updates.brief ? `Brief updated` : null;
      const shortMsg = [titleMsg, briefMsg].filter(Boolean).join(" • ");

      if (data.assigned_to_email) {
        await createNotification(data.assigned_to_email, "Task updated", shortMsg, data.id);
      }

      if (data.created_by_email && data.created_by_email !== requester_email) {
        await createNotification(data.created_by_email, "Task updated", shortMsg, data.id);
      }

      const { data: manager3 } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();
      if (manager3?.email) {
        await createNotification(manager3.email, "Task updated", shortMsg, data.id);
      }
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// =====================================================================
// PATCH → MANAGER APPROVAL (approve/reject pending actions)
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, approve, manager_email } = body;

    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (task.approval_status !== "pending")
      return NextResponse.json({ error: "No pending action" }, { status: 400 });

    // APPROVE
    if (approve) {
      // REASSIGN APPROVAL
      if (task.pending_action === "reassign") {
        // lookup the employee email for the pending_value (full_name)
        const { data: newAssignee } = await supabase
          .from("employees")
          .select("*")
          .eq("full_name", task.pending_value)
          .maybeSingle();

        const updated = {
          assigned_to_name: task.pending_value,
          assigned_to_email: newAssignee?.email || null,
          approval_status: "approved",
          approval_required: false,
          pending_action: null,
          pending_value: null,
          activity: [
            ...(task.activity || []),
            {
              action: "Reassign Approved",
              user: manager_email,
              timestamp: new Date().toISOString(),
              comment: `Assigned to ${task.pending_value}`,
            },
          ],
        };

        const { error } = await supabase.from("tasks").update(updated).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // notify new assignee & creator (and email)
        if (newAssignee?.email) {
          await createNotification(
            newAssignee.email,
            "You were assigned a task",
            `You were assigned "${task.title}"`,
            id
          );
          sendEmail(
            newAssignee.email,
            `Assigned: ${task.title}`,
            `<p>You have been assigned task <strong>${task.title}</strong> (approved by manager).</p>`
          );
        }

        await createNotification(task.created_by_email, "Task reassigned", `Task "${task.title}" was reassigned to ${task.pending_value}`, id);
        sendEmail(task.created_by_email, `Task reassigned: ${task.title}`, `<p>Your task was reassigned to ${task.pending_value}.</p>`);

        return NextResponse.json({ success: true });
      }

      // DELETE approval
      if (task.pending_action === "delete") {
        await supabase.from("tasks").delete().eq("id", id);
        await createNotification(task.created_by_email, "Task deleted", `"${task.title}" was deleted by manager`, id);
        sendEmail(task.created_by_email, `Task deleted: ${task.title}`, `<p>Your task "${task.title}" was deleted by manager.</p>`);
        return NextResponse.json({ deleted: true });
      }

      // NORMAL APPROVAL (no pending_action)
      const { error: upErr } = await supabase
        .from("tasks")
        .update({
          approval_status: "approved",
          approval_required: false,
          pending_action: null,
          pending_value: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      // After approval: notify & email assignee & creator
      if (task.assigned_to_email) {
        await createNotification(task.assigned_to_email, "Task approved", `"${task.title}" has been approved by manager.`, id);
        sendEmail(task.assigned_to_email, `Task assigned: ${task.title}`, `<p>You have been assigned the task <strong>${task.title}</strong> (approved by manager).</p>`);
      }
      await createNotification(task.created_by_email, "Task approved", `"${task.title}" approved by manager`, id);
      sendEmail(task.created_by_email, `Task approved: ${task.title}`, `<p>Your task "${task.title}" has been approved by manager.</p>`);

      return NextResponse.json({ approved: true });
    }

    // REJECT
    await supabase
      .from("tasks")
      .update({
        approval_status: "rejected",
        pending_action: null,
        pending_value: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await createNotification(task.created_by_email, "Task action rejected", `"${task.title}" action rejected by manager`, id);
    sendEmail(task.created_by_email, `Task rejected: ${task.title}`, `<p>Your task "${task.title}" action was rejected by manager.</p>`);

    return NextResponse.json({ rejected: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
