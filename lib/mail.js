import nodemailer from "nodemailer";

export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, // port 465 requires secure true
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send email
 */
export async function sendMail({ to, subject, html }) {
  try {
    const info = await mailer.sendMail({
      from: `"Task Manager" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true, info };
  } catch (err) {
    console.error("MAIL ERROR:", err);
    return { success: false, error: err };
  }
}
