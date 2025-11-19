// app/api/tasks/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------
// EMAIL SENDER (unchanged)
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST) return;

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
// GET ALL TASKS
export async function GET() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tasks: data });
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
      sendEmail(
        manager.email,
        `Task Approval Needed: ${title}`,
        `<p>${created_by_name || created_by_email} created a new task.</p>`
      );

      // create in-app notification for manager
      await createNotification(
        manager.email,
        "New task awaiting approval",
        `${created_by_name || created_by_email} created "${title}"`,
        data.id
      );
    }

    // notify assignee (if any)
    if (assigned_to_email) {
      await createNotification(
        assigned_to_email,
        "You were assigned a task",
        `You were assigned "${title}"`,
        data.id
      );
    }

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
      return NextResponse.json(
        { error: "Missing requester_email" },
        { status: 400 }
      );

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // requester
    const { data: requester } = await supabase
      .from("employees")
      .select("*")
      .eq("email", requester_email)
      .maybeSingle();

    const requesterName = requester?.full_name || requester_email;
    const isManager = requester?.role === "Manager";
    const isCreator = task.created_by_email === requester_email;
    const isAssignedEmployee =
      requester?.full_name &&
      requester.full_name === task.assigned_to_name;

    // =====================================================================
    // EMPLOYEE REQUESTS REASSIGN
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
            comment: `Request assign to ${updates.assigned_to_name}`,
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
          `<p>${requesterName} requested reassign to ${updates.assigned_to_name}.</p>`
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

    // =====================================================================
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
            `<p>${requesterName} requested deletion of ${task.title}.</p>`
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

    // =====================================================================
    // MANUAL COMPLETION (Manager or Creator Only)
    if (updates.mark_complete === true) {
      if (!isManager && !isCreator) {
        return NextResponse.json(
          { error: "Only creator or manager can mark complete" },
          { status: 403 }
        );
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

      // notify stakeholders (creator, assignee, manager)
      if (task.assigned_to_email) {
        await createNotification(
          task.assigned_to_email,
          "Task marked complete",
          `"${task.title}" was marked complete`,
          id
        );
      }
      await createNotification(
        task.created_by_email,
        "Task marked complete",
        `"${task.title}" was marked complete`,
        id
      );

      // notify manager (first manager found)
      const { data: manager } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();
      if (manager?.email) {
        await createNotification(
          manager.email,
          "Task completed",
          `"${task.title}" was completed`,
          id
        );
      }

      return NextResponse.json({ task: data });
    }

    // =====================================================================
    // =====================================================================
    // WORK STATUS UPDATE (includes "Send For Review")
    // =====================================================================
    if (updates.stage) {

      if (!isAssignedEmployee && !isManager) {
        return NextResponse.json(
          { error: "Only assigned employee or manager can change stage" },
          { status: 403 }
        );
      }

      // --- NEW FEATURE: SEND FOR REVIEW ---
      if (updates.stage === "Send For Review") {
        const newActivity = [
          ...(task.activity || []),
          {
            action: "Sent For Review",
            user: requester_email,
            timestamp: new Date().toISOString(),
            comment: `Task sent for review`,
          },
        ];

        // update task
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
          await createNotification(
            manager.email,
            "Review Requested",
            `${requesterName} sent "${updatedTask.title}" for review`,
            id
          );
        }

        // notify assignee (if creator reviewing)
        if (
          updatedTask.assigned_to_email &&
          updatedTask.assigned_to_email !== requester_email
        ) {
          await createNotification(
            updatedTask.assigned_to_email,
            "Task sent for review",
            `"${updatedTask.title}" was sent for review`,
            id
          );
        }

        return NextResponse.json({ task: updatedTask });
      }

      // --- NORMAL STAGE CHANGE ---
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
      await createNotification(
        updatedTask.created_by_email,
        "Task status changed",
        `${requesterName} changed status of "${updatedTask.title}" to ${updatedTask.stage}`,
        id
      );

      if (updatedTask.assigned_to_email && updatedTask.assigned_to_email !== requester_email) {
        await createNotification(
          updatedTask.assigned_to_email,
          "Task status changed",
          `Status of "${updatedTask.title}" changed to ${updatedTask.stage}`,
          id
        );
      }

      const { data: manager2 } = await supabase
        .from("employees")
        .select("*")
        .eq("role", "Manager")
        .limit(1)
        .maybeSingle();

      if (manager2?.email) {
        await createNotification(
          manager2.email,
          "Task status changed",
          `${requesterName} changed status of "${updatedTask.title}" to ${updatedTask.stage}`,
          id
        );
      }

      return NextResponse.json({ task: updatedTask });
    }


        // =====================================================================
        // NORMAL UPDATE (No auto completion)
        // We want to attach activity entries for brief/title changes and notify relevant parties
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
        const activities = [...(task.activity || [])];
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

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });

        // if brief/title changed -> notify creator/assignee/manager
        if (activities.length) {
          const titleMsg = updates.title ? `Title updated to "${updates.title}"` : null;
          const briefMsg = updates.brief ? `Brief updated` : null;
          const shortMsg = [titleMsg, briefMsg].filter(Boolean).join(" • ");

          // notify assignee
          if (data.assigned_to_email) {
            await createNotification(
              data.assigned_to_email,
              "Task updated",
              shortMsg,
              data.id
            );
          }

          // notify creator (if someone else updated)
          if (data.created_by_email && data.created_by_email !== requester_email) {
            await createNotification(
              data.created_by_email,
              "Task updated",
              shortMsg,
              data.id
            );
          }

          // notify manager
          const { data: manager3 } = await supabase
            .from("employees")
            .select("*")
            .eq("role", "Manager")
            .limit(1)
            .maybeSingle();
          if (manager3?.email) {
            await createNotification(
              manager3.email,
              "Task updated",
              shortMsg,
              data.id
            );
          }
        }

        return NextResponse.json({ task: data });
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

// =====================================================================
// PATCH → MANAGER APPROVAL
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, approve, manager_email } = body;

    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!task)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (task.approval_status !== "pending")
      return NextResponse.json({ error: "No pending action" }, { status: 400 });

    // APPROVE
    if (approve) {
      // REASSIGN
      if (task.pending_action === "reassign") {
        const updated = {
          assigned_to_name: task.pending_value,
          approval_status: "approved",
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

        // notify new assignee & creator
        const { data: newAssignee } = await supabase
          .from("employees")
          .select("*")
          .eq("full_name", task.pending_value)
          .maybeSingle();

        if (newAssignee?.email) {
          await createNotification(
            newAssignee.email,
            "You were assigned a task",
            `You were assigned "${task.title}"`,
            id
          );
        }
        await createNotification(task.created_by_email, "Task reassigned", `Task "${task.title}" was reassigned to ${task.pending_value}`, id);

        return NextResponse.json({ success: true });
      }

      // DELETE
      if (task.pending_action === "delete") {
        await supabase.from("tasks").delete().eq("id", id);
        await createNotification(task.created_by_email, "Task deleted", `"${task.title}" was deleted by manager`, id);
        return NextResponse.json({ deleted: true });
      }

      // NORMAL APPROVAL
      await supabase
        .from("tasks")
        .update({
          approval_status: "approved",
          approval_required: false,
          pending_action: null,
          pending_value: null,
        })
        .eq("id", id);

      // notify creator and assignee
      if (task.assigned_to_email) {
        await createNotification(
          task.assigned_to_email,
          "Task approved",
          `"${task.title}" approved by manager`,
          id
        );
      }
      await createNotification(
        task.created_by_email,
        "Task approved",
        `"${task.title}" approved by manager`,
        id
      );

      return NextResponse.json({ approved: true });
    }

    // REJECT
    await supabase
      .from("tasks")
      .update({
        approval_status: "rejected",
        pending_action: null,
        pending_value: null,
      })
      .eq("id", id);

    await createNotification(
      task.created_by_email,
      "Task action rejected",
      `"${task.title}" action rejected by manager`,
      id
    );

    return NextResponse.json({ rejected: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
