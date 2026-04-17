import cron from "node-cron";
import nodemailer from "nodemailer";
import { pool } from "@workspace/db";

const SMTP_HOST = process.env["SMTP_HOST"];
const SMTP_PORT = parseInt(process.env["SMTP_PORT"] ?? "465", 10);
const SMTP_USER = process.env["SMTP_USER"];
const SMTP_PASS = process.env["SMTP_PASS"];
const REPORT_EMAIL =
  process.env["REPORT_RECEIVER"] ??
  process.env["REPORT_EMAIL"] ??
  "contact@prakritiherbs.in";

function createTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildReportHtml(
  dateStr: string,
  summary: Record<string, unknown>,
  sourceRows: Array<{ source: string; count: number }>,
  orderRows: Array<Record<string, unknown>>,
): string {
  const total    = Number(summary["total"]      ?? 0);
  const confirmed= Number(summary["confirmed"]  ?? 0);
  const shipped  = Number(summary["shipped"]    ?? 0);
  const delivered= Number(summary["delivered"]  ?? 0);
  const cancelled= Number(summary["cancelled"]  ?? 0);
  const revenue  = Number(summary["revenue"]    ?? 0);

  const statCards = [
    { label: "Total Orders",  value: String(total),                color: "#2E7D32" },
    { label: "Confirmed",     value: String(confirmed),            color: "#F57C00" },
    { label: "Shipped",       value: String(shipped),              color: "#7B1FA2" },
    { label: "Delivered",     value: String(delivered),            color: "#388E3C" },
    { label: "Cancelled",     value: String(cancelled),            color: "#D32F2F" },
    { label: "Revenue (est)", value: `₹${revenue.toLocaleString("en-IN")}`, color: "#B8860B" },
  ].map(({ label, value, color }) => `
    <td style="padding:0 8px 0 0;vertical-align:top;width:16%">
      <div style="background:#f8f9fa;border-radius:8px;padding:12px 8px;text-align:center;border-top:3px solid ${color}">
        <p style="margin:0;font-size:10px;color:#666;text-transform:uppercase;font-weight:bold;letter-spacing:.5px">${label}</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${color}">${value}</p>
      </div>
    </td>`).join("");

  const sourceTable = sourceRows.length > 0 ? `
    <h3 style="color:#2E7D32;margin:24px 0 10px;font-size:14px;border-bottom:2px solid #e8f5e9;padding-bottom:6px">
      Source-wise Breakdown
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px">
      <thead>
        <tr style="background:#2E7D32;color:#fff">
          <th style="padding:8px 12px;text-align:left;border-radius:4px 0 0 0">Source Name</th>
          <th style="padding:8px 12px;text-align:center">Total Orders</th>
          <th style="padding:8px 12px;text-align:center;border-radius:0 4px 0 0">Status</th>
        </tr>
      </thead>
      <tbody>
        ${sourceRows.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fbe7"};border-bottom:1px solid #e8f5e9">
          <td style="padding:8px 12px;font-weight:600;color:#1a1a1a;text-transform:capitalize">${s.source || "Direct / Organic"}</td>
          <td style="padding:8px 12px;text-align:center;font-size:16px;font-weight:700;color:#2E7D32">${s.count}</td>
          <td style="padding:8px 12px;text-align:center">
            <span style="background:#e8f5e9;color:#2E7D32;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600">Active</span>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>` : "";

  const ordersSection = orderRows.length > 0 ? `
    <h3 style="color:#2E7D32;margin:0 0 10px;font-size:14px;border-bottom:2px solid #e8f5e9;padding-bottom:6px">
      All Orders Today
    </h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:#2E7D32;color:#fff">
          <th style="padding:7px 8px;text-align:left">Time</th>
          <th style="padding:7px 8px;text-align:left">Name</th>
          <th style="padding:7px 8px;text-align:left">Mobile</th>
          <th style="padding:7px 8px;text-align:left">Address</th>
          <th style="padding:7px 8px;text-align:left">Pincode</th>
          <th style="padding:7px 8px;text-align:left">Source</th>
          <th style="padding:7px 8px;text-align:left">Qty</th>
          <th style="padding:7px 8px;text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>
        ${orderRows.map((o, i) => {
          const dt = new Date(String(o["created_at"] ?? "")).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
          const statusColor = String(o["status"]) === "Delivered" ? "#2E7D32" : String(o["status"]) === "Cancelled" ? "#D32F2F" : "#F57C00";
          return `<tr style="background:${i % 2 === 0 ? "#fff" : "#fafafa"};border-bottom:1px solid #f0f0f0">
            <td style="padding:6px 8px;white-space:nowrap">${dt}</td>
            <td style="padding:6px 8px;font-weight:600">${String(o["name"] ?? "")}</td>
            <td style="padding:6px 8px">${String(o["phone"] ?? "")}</td>
            <td style="padding:6px 8px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${String(o["address"] ?? "").substring(0, 28)}</td>
            <td style="padding:6px 8px">${String(o["pincode"] ?? "")}</td>
            <td style="padding:6px 8px;text-transform:capitalize;color:#555">${String(o["source"] ?? "—")}</td>
            <td style="padding:6px 8px;text-align:center">${String(o["quantity"] ?? 1)}</td>
            <td style="padding:6px 8px;font-weight:700;color:${statusColor}">${String(o["status"] ?? "")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>` : `<p style="text-align:center;color:#aaa;padding:28px;font-size:13px">No orders placed today.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:820px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1B5E20 0%,#2E7D32 100%);padding:28px 32px;text-align:center">
      <p style="margin:0 0 4px;color:#e6cf73;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600">DAILY SALES REPORT</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.5px">PRAKRITI HERBS PRIVATE LIMITED</h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.75);font-size:13px">${dateStr}</p>
    </div>

    <!-- Stats -->
    <div style="padding:24px 28px 0">
      <table style="width:100%;border-collapse:separate;border-spacing:0">
        <tr>${statCards}</tr>
      </table>
    </div>

    <!-- Source Breakdown + Orders -->
    <div style="padding:20px 28px 28px">
      ${sourceTable}
      ${ordersSection}
    </div>

    <!-- Footer -->
    <div style="background:#f8f9fa;border-top:1px solid #e8f5e9;padding:16px 28px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;color:#555;font-weight:600">Automated system-generated report for Director Mandeep Kumar</p>
      <p style="margin:0;font-size:11px;color:#aaa">Prakriti Herbs CRM • Do not reply to this email • CIN: U46497RJ2025PTC109202</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendDailySummary(testTo?: string): Promise<{ success: boolean; message: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    const msg = "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS";
    console.log("[EMAIL]", msg);
    return { success: false, message: msg };
  }

  try {
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    todayIST.setHours(0, 0, 0, 0);

    const [summaryRes, sourceRes, orderRes] = await Promise.all([
      pool.query<Record<string, unknown>>(`
        SELECT
          COUNT(*)                                          AS total,
          COUNT(*) FILTER (WHERE status='Confirmed')       AS confirmed,
          COUNT(*) FILTER (WHERE status='Shipped')         AS shipped,
          COUNT(*) FILTER (WHERE status='Delivered')       AS delivered,
          COUNT(*) FILTER (WHERE status='Cancelled')       AS cancelled,
          COALESCE(SUM(
            CASE quantity
              WHEN 2 THEN 1499
              WHEN 3 THEN 1999
              ELSE 999
            END
          ), 0) AS revenue
        FROM orders WHERE created_at >= $1
      `, [todayIST]),

      pool.query<{ source: string; count: string }>(`
        SELECT
          COALESCE(NULLIF(TRIM(source),''), 'direct') AS source,
          COUNT(*) AS count
        FROM orders
        WHERE created_at >= $1
        GROUP BY 1
        ORDER BY count DESC
      `, [todayIST]),

      pool.query<Record<string, unknown>>(`
        SELECT name, phone, address, pincode, quantity, source, status, created_at
        FROM orders
        WHERE created_at >= $1
        ORDER BY created_at DESC
        LIMIT 100
      `, [todayIST]),
    ]);

    const summary = (summaryRes.rows[0] ?? {}) as Record<string, unknown>;
    const sources = sourceRes.rows.map(r => ({ source: r.source, count: Number(r.count) }));
    const orders  = orderRes.rows as Array<Record<string, unknown>>;
    const total   = Number(summary["total"] ?? 0);

    const dateStr = new Date().toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "long", year: "numeric",
    });

    const html = buildReportHtml(dateStr, summary, sources, orders);
    const to   = testTo ?? REPORT_EMAIL;

    await transporter.sendMail({
      from:    `"Prakriti CRM" <${SMTP_USER}>`,
      to,
      subject: `📦 Daily Sales Report — ${dateStr} | ${total} Orders | Prakriti Herbs`,
      html,
    });

    const msg = `Daily report sent to ${to} — ${total} orders, ${sources.length} sources`;
    console.log("[EMAIL]", msg);
    return { success: true, message: msg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EMAIL] Failed:", msg);
    return { success: false, message: msg };
  }
}

async function autoCleanTrash() {
  try {
    const { rows } = await pool.query<{ id: number }>(
      `DELETE FROM orders WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days' RETURNING id`
    );
    if (rows.length > 0) console.log(`[TRASH] Auto-cleaned ${rows.length} orders older than 30 days`);
  } catch (err) { console.error("[TRASH] Auto-clean failed:", err); }
}

export function startEmailCron() {
  cron.schedule("59 23 * * *", () => {
    void sendDailySummary();
  }, { timezone: "Asia/Kolkata" });
  console.log("[EMAIL] Daily report cron scheduled at 23:59 IST");

  cron.schedule("0 2 * * *", () => {
    void autoCleanTrash();
  }, { timezone: "Asia/Kolkata" });
  console.log("[TRASH] 30-day auto-clean cron scheduled at 02:00 IST");
}
