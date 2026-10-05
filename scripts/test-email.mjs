/**
 * Sends a test e-mail with the same code the app uses (lib/mail.ts).
 * Usage: node scripts/test-email.mjs destinatario@grupoqmax.com.br
 * Reads .env.development.local, then .env (the first file that sets a variable wins).
 */
import dotenv from "dotenv";

dotenv.config({ path: [".env.development.local", ".env"], quiet: true });

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-email.mjs <recipient>");
  process.exit(1);
}

const { sendMail } = await import("../lib/mail.ts");
try {
  await sendMail(to, "Teste de e-mail - Q-Max CRM", "<p>Se você recebeu este e-mail, o envio do CRM está funcionando.</p>");
  console.log(`OK: e-mail sent to ${to}`);
} catch (error) {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
}
