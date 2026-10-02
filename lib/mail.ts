import nodemailer from "nodemailer";

const transport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

/** Sends an e-mail through SMTP_*. Without SMTP_HOST outside production it only logs it (local dev). */
export async function sendMail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_HOST && process.env.NODE_ENV !== "production") {
    console.log(`[mail] SMTP_HOST not set, not sending to ${to}: ${subject}\n${html}`);
    return;
  }
  await transport().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
}
