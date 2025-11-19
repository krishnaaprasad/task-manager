// app/api/daily-summary/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import nodemailer from "nodemailer";

/**
 * Requirements: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env.
 * Also ensure process.env.BASE_URL is set (for links in email), e.g. https://your-domain.com
 */

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
    console.error("Email error:", err);
  }
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });
  } catch (e) { return String(d); }
}

function buildEmailHtml(summary, baseUrl) {
  // simple HTML summary
  return `
    <h2>Daily Task Summary</h2>
    <p>Hello ${summary.name || summary.email},</p>

    <ul>
      <li><strong>Overdue:</strong> ${summary.overdueCount}</li>
      <li><strong>Due today:</strong> ${summary.dueTodayCount}</li>
      <li><strong>Pending approval:</strong> ${summary.pendingCount}</li>
      <li><strong>Assigned to you:</strong> ${summary.assignedCount}</li>
    </ul>

    ${summary.sampleItems && summary.sampleItems.length ? `
      <h4>Top items</h4>
      <ul>
        ${summary.sampleItems.map(it => `<li>#${it.task_number || ""} ${it.title} — due ${formatDate(it.due_date) || "-"}</li>`).join("")}
      </ul>
    ` : ""}

    <p><a href="${baseUrl}/dashboard">Open Dashboard</a></p>
    <small>Generated at ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}</small>
  `;
}

export async function POST(req) {
  // allow manual trigger (auth could be added)
  try {
    // 1) load employees (everyone who should get notifications)
    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name, email, role");

    if (empErr) {
      console.error("employees fetch error", empErr);
      return NextResponse.json({ error: empErr.message }, { status: 500 });
    }

    // 2) fetch tasks once to filter locally (efficient enough for modest dataset).
    const { data: tasksData, error: tErr } = await supabase
      .from("tasks")
      .select("*");

    if (tErr) {
      console.error("tasks fetch error", tErr);
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    const now = new Date();
    // compute for each employee
    const baseUrl = process.env.BASE_URL || "";

    for (const emp of employees) {
      const email = emp.email;
      const name = emp.full_name || emp.email;

      // tasks relevant to this user:
      const assignedToMe = tasksData.filter(t => t.assigned_to_email === email || t.assigned_to_name === emp.full_name);
      const createdByMe = tasksData.filter(t => t.created_by_email === email);

      // Overdue: due_date < today && not completed (no completion_date)
      const overdue = (assignedToMe.concat(createdByMe)).filter(t => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        // compare by date (ignore time)
        return !t.completion_date && (due.setHours(0,0,0,0) < (new Date()).setHours(0,0,0,0));
      });

      // Due today:
      const dueToday = (assignedToMe.concat(createdByMe)).filter(t => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        return !t.completion_date && due.setHours(0,0,0,0) === (new Date()).setHours(0,0,0,0);
      });

      // Pending approval (only tasks where approval_status = 'pending' and manager should be notified OR creator)
      const pending = tasksData.filter(t => t.approval_status === "pending" && (
        // If user is manager they get pending items for the org
        emp.role === "Manager" ||
        // Or if they are the creator they get their own pending tasks
        t.created_by_email === email
      ));

      // assigned count
      const assignedCount = assignedToMe.length;

      const summary = {
        email,
        name,
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
        pendingCount: pending.length,
        assignedCount,
        sampleItems: [...overdue, ...dueToday, ...pending].slice(0, 5).map(t => ({
          id: t.id,
          task_number: t.task_number,
          title: t.title,
          due_date: t.due_date,
        })),
      };

      // 3) insert a notification row
      const title = `Daily summary — ${summary.overdueCount} overdue, ${summary.dueTodayCount} due today`;
      const { error: insErr } = await supabase
        .from("notifications")
        .insert([{
          recipient_email: email,
          title,
          body: JSON.stringify({
            overdue: summary.overdueCount,
            dueToday: summary.dueTodayCount,
            pending: summary.pendingCount,
            assigned: summary.assignedCount,
          }),
          level: summary.overdueCount > 0 ? "warn" : "info",
          link: `${baseUrl}/dashboard`,
          meta: { summary: summary.sampleItems },
        }]);

      if (insErr) {
        console.error("notifications insert error for", email, insErr);
      }

      // 4) send email if SMTP configured
      if (process.env.SMTP_HOST) {
        try {
          const html = buildEmailHtml(summary, baseUrl);
          await sendEmail(email, "Daily Task Summary", html);
        } catch (e) {
          console.error("failed sending email to", email, e);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Allow GET for quick manual run from browser if needed
export async function GET() {
  return POST();
}
