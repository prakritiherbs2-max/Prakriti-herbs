/**
 * Admin password reset & change routes.
 *
 * POST /api/admin/forgot-password   — generate & email a 6-digit OTP
 * POST /api/admin/verify-otp        — verify OTP + set new password
 * POST /api/admin/change-password   — change password from inside dashboard (requireSuperAdmin)
 */
import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin, setRevocationTime, signAdminToken } from "../middlewares/requireAdmin.js";
import { sendMail } from "../lib/mailer.js";
import { saveSettingsBatch, getSetting } from "./settings.js";

const router: IRouter = Router();

/* ── Constants ─────────────────────────────────────────────────────────────── */
const ADMIN_EMAIL = process.env["ADMIN_RECOVERY_EMAIL"] ?? "mkhirnval@gmail.com";
const ALERT_EMAIL = process.env["ADMIN_ALERT_EMAIL"] ?? "contact@prakritiherbs.in";
const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] ?? "admin";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const HASH_SALT = "prakriti_salt_2026";

/* ── Helpers ───────────────────────────────────────────────────────────────── */
export function hashPassword(pw: string): string {
  return crypto.createHash("sha256").update(pw + HASH_SALT).digest("hex");
}

/** Read current password version (0 = never changed) */
export async function getPasswordVersion(): Promise<number> {
  const v = await getSetting("admin_password_version");
  return v ? parseInt(v, 10) : 0;
}

/** Bump version + update revocation timestamp for session-kill */
async function bumpPasswordVersion(): Promise<number> {
  const current = await getPasswordVersion();
  const next = current + 1;
  const nowSec = Math.floor(Date.now() / 1000);
  await saveSettingsBatch({
    admin_password_version: String(next),
    admin_session_revoked_at: String(nowSec),
  });
  setRevocationTime(nowSec);   // update in-memory cache immediately
  return next;
}

/* ── In-memory OTP store  (email → { otp, expiresAt }) ─────────────────────── */
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ── Routes ────────────────────────────────────────────────────────────────── */

/** Step 1: request an OTP */
router.post("/admin/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };

  /* Validate the email against the known recovery address */
  if (!email || email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase()) {
    /* Always respond the same to avoid email enumeration */
    res.json({ ok: true, message: "If that email is registered, an OTP has been sent." });
    return;
  }

  const otp = generateOtp();
  otpStore.set(email.toLowerCase(), { otp, expiresAt: Date.now() + OTP_TTL_MS });

  await sendMail({
    to: email,
    subject: "🔐 Prakriti Herbs Admin — Password Reset OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
        <div style="background:#1B5E20;padding:24px;text-align:center">
          <h2 style="color:#C9A14A;margin:0;font-size:20px">Prakriti Herbs Admin</h2>
          <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">Password Reset Request</p>
        </div>
        <div style="padding:32px">
          <p style="color:#374151;font-size:15px;margin-top:0">Your one-time password (OTP) is:</p>
          <div style="background:#f3f4f6;border-radius:10px;padding:20px;text-align:center;letter-spacing:8px;font-size:36px;font-weight:bold;color:#1B5E20;margin:20px 0">
            ${otp}
          </div>
          <p style="color:#6b7280;font-size:13px">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <p style="color:#6b7280;font-size:13px">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
          Prakriti Herbs Admin Panel &mdash; Automated Security Email
        </div>
      </div>
    `,
  });

  res.json({ ok: true, message: "If that email is registered, an OTP has been sent." });
});

/** Step 2: verify OTP + set new password */
router.post("/admin/verify-otp", async (req, res) => {
  const { email, otp, newPassword } = req.body as { email?: string; otp?: string; newPassword?: string };

  if (!email || !otp || !newPassword) {
    res.status(400).json({ error: "email, otp and newPassword are required" });
    return;
  }

  const entry = otpStore.get(email.toLowerCase());
  if (!entry || entry.otp !== otp.trim() || Date.now() > entry.expiresAt) {
    res.status(400).json({ error: "Invalid or expired OTP. Please request a new one." });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  /* Store new password hash + bump version (invalidates all sessions) */
  otpStore.delete(email.toLowerCase());
  await saveSettingsBatch({ admin_password_hash: hashPassword(newPassword) });
  const version = await bumpPasswordVersion();

  /* Send security alert email */
  const alertTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  await sendMail({
    to: ALERT_EMAIL,
    subject: "🔐 Security Alert — Admin Password Was Reset",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #fca5a5;border-radius:12px;overflow:hidden">
        <div style="background:#dc2626;padding:20px;text-align:center">
          <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Admin Password Changed</h2>
        </div>
        <div style="padding:28px">
          <p style="color:#374151">The admin password for <strong>Prakriti Herbs Admin Panel</strong> was reset via OTP verification.</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse;color:#374151">
            <tr><td style="padding:6px 0;font-weight:bold;width:40%">Time</td><td>${alertTime} IST</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Method</td><td>Forgot Password (OTP)</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Username</td><td>${ADMIN_USERNAME}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">All sessions</td><td>Logged out</td></tr>
          </table>
          <p style="color:#dc2626;font-size:13px;margin-top:16px">⚠️ If this was not you, contact your system administrator immediately.</p>
        </div>
      </div>
    `,
  });

  /* Return a fresh token so the user can log in immediately */
  const token = signAdminToken(ADMIN_USERNAME, "super_admin", version);
  res.json({ ok: true, token, username: ADMIN_USERNAME, role: "super_admin" });
});

/** Change password from inside the dashboard (super_admin only) */
router.post("/admin/change-password", requireSuperAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  /* Verify current password (check overridden hash first, then env var) */
  const storedHash = await getSetting("admin_password_hash");
  const envPassword = process.env["ADMIN_PASSWORD"] ?? "Admin@2026";
  const currentHash = hashPassword(currentPassword);
  const envHash = hashPassword(envPassword);

  const valid = storedHash ? storedHash === currentHash : currentPassword === envPassword || currentHash === envHash;
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different from the current one" });
    return;
  }

  /* Save new hash + invalidate all sessions */
  await saveSettingsBatch({ admin_password_hash: hashPassword(newPassword) });
  const version = await bumpPasswordVersion();

  /* Security alert */
  const alertTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const adminUser = (req as typeof req & { admin: { username: string } }).admin.username;
  await sendMail({
    to: ALERT_EMAIL,
    subject: "🔐 Security Alert — Admin Password Changed",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #fca5a5;border-radius:12px;overflow:hidden">
        <div style="background:#dc2626;padding:20px;text-align:center">
          <h2 style="color:#fff;margin:0;font-size:18px">⚠️ Admin Password Changed</h2>
        </div>
        <div style="padding:28px">
          <p style="color:#374151">The admin password for <strong>Prakriti Herbs Admin Panel</strong> was changed from inside the dashboard.</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse;color:#374151">
            <tr><td style="padding:6px 0;font-weight:bold;width:40%">Time</td><td>${alertTime} IST</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Changed by</td><td>${adminUser}</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">Method</td><td>Change Password (Dashboard)</td></tr>
            <tr><td style="padding:6px 0;font-weight:bold">All sessions</td><td>Logged out</td></tr>
          </table>
          <p style="color:#dc2626;font-size:13px;margin-top:16px">⚠️ If this was not you, contact your system administrator immediately.</p>
        </div>
      </div>
    `,
  });

  /* Issue a new token for the current session so admin isn't locked out */
  const newToken = signAdminToken(adminUser, "super_admin", version);
  res.json({ ok: true, token: newToken, message: "Password changed. All other sessions have been logged out." });
});

/* ── Startup: load revocation time from DB ─────────────────────────────────── */
(async () => {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "admin_session_revoked_at"));
    if (row?.value) setRevocationTime(parseInt(row.value, 10));
  } catch { /* ignore startup errors */ }
})();

export default router;
