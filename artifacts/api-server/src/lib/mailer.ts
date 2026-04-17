import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email via SMTP. Returns true on success, false if SMTP not configured or send fails.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[MAIL] SMTP not configured — cannot send:", opts.subject);
    return false;
  }
  const from = `"Prakriti Herbs" <${process.env["SMTP_USER"]}>`;
  try {
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    console.log("[MAIL] Sent:", opts.subject, "→", opts.to);
    return true;
  } catch (err) {
    console.error("[MAIL] Failed to send:", err instanceof Error ? err.message : err);
    return false;
  }
}
