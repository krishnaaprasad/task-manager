// /app/api/daily-summary/route.js
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import nodemailer from "nodemailer";

// ======================================================
// CRON SETUP (Runs 9:30 AM IST Daily)
// ======================================================
export const config = {
  schedule: "30 9 * * *",
  timezone: "Asia/Kolkata"
};

// ======================================================
// EMAIL SENDER
// ======================================================
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

// ======================================================
// MAIN CRON LOGIC
// ======================================================
export async function GET() {
  console.log("Daily Summary Cron Triggered @ 9:30 AM IST");

  // Fetch employees
  const { data: employees } = await supabase
    .from("employees")
    .select("*");

  // Fetch all tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*");

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);

  // ======================================================
  // For each employee generate summary
  // ======================================================
  for (const emp of employees) {
    const empName = emp.full_name;
    const empEmail = emp.email;

    // Filter tasks related to this employee
    const assignedTasks = tasks.filter(t => t.assigned_to_email === empEmail);
    const createdTasks = tasks.filter(t => t.created_by_email === empEmail);

    // Overdue: due date < today & not completed
    const overdue = assignedTasks.filter(t => 
      t.due_date && 
      t.due_date < todayDate &&
      !t.completion_date
    );

    // Due today
    const dueToday = assignedTasks.filter(t => 
      t.due_date === todayDate
    );

    // Completed yesterday
    const completedYesterday = assignedTasks.filter(t => 
      t.completion_date?.slice(0, 10) === yesterdayDate
    );

    // Pending approvals (creator receives this)
    const pendingApprovals = createdTasks.filter(t => 
      t.approval_status === "pending"
    );

    // =========================================
    // Build Email HTML
    // =========================================
    const emailHtml = `
      <h2>Daily Task Summary</h2>
      <p>Hello <b>${empName}</b>, here is your task summary:</p>

      <h3>📌 Overdue Tasks (${overdue.length})</h3>
      <ul>${overdue.map(t => `<li>${t.title} (Due: ${t.due_date})</li>`).join("")}</ul>

      <h3>📆 Due Today (${dueToday.length})</h3>
      <ul>${dueToday.map(t => `<li>${t.title}</li>`).join("")}</ul>

      <h3>✅ Completed Yesterday (${completedYesterday.length})</h3>
      <ul>${completedYesterday.map(t => `<li>${t.title}</li>`).join("")}</ul>

      <h3>📝 Pending Approvals (${pendingApprovals.length})</h3>
      <ul>${pendingApprovals.map(t => `<li>${t.title}</li>`).join("")}</ul>
    `;

    // =========================================
    // Send Email
    // =========================================
    await sendEmail(empEmail, "Daily Task Summary", emailHtml);

    // =========================================
    // Insert Notification Row
    // =========================================
    await supabase.from("notifications").insert([
      {
        user_email: empEmail,
        title: "Daily Summary",
        message: `Overdue: ${overdue.length}, Due Today: ${dueToday.length}, Completed Yesterday: ${completedYesterday.length}`
      }
    ]);
  }

  return NextResponse.json({ message: "Daily summary sent to all users" });
}
