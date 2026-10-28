import nodemailer from "nodemailer";

// Real email when SMTP_* is set in backend/.env, otherwise the invite link is printed in the server console.
let transport = null;
if (process.env.SMTP_HOST) {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

export async function sendInviteMail({ to, link, role, inviter }) {
  if (!transport) {
    console.log(`\n[invite] SMTP not configured - invite link for ${to} (${role}):\n${link}\n`);
    return false;
  }
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${inviter} invited you to Taskoraq`,
    html: `<p><b>${inviter}</b> invited you to join Taskoraq as <b>${role}</b>.</p><p><a href="${link}">Accept the invite</a> (valid for 7 days)</p>`,
  });
  return true;
}
