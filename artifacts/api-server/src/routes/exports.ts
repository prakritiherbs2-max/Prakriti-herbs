/**
 * Data Export routes — download orders as CSV (Excel-compatible)
 *
 * GET /admin/export/orders            → All orders
 * GET /admin/export/orders?source=sartaj → Orders filtered by source
 * GET /admin/export/orders?source=sartaj&from=2024-01-01&to=2024-12-31 → Date range
 *
 * CSV uses UTF-8 BOM so Excel opens Hindi/regional text correctly.
 * Requires admin auth.
 */

import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

/** Escape a CSV cell — wrap in quotes if it contains comma/quote/newline */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Format a UTC timestamp to IST date+time string */
function toIST(ts: Date | string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return String(ts); }
}

const HEADERS = [
  "Order ID", "Date (IST)", "Customer Name", "Phone", "City", "State",
  "Pincode", "Address", "Product", "Qty", "Amount (₹)", "Status",
  "Payment Method", "Payment Status", "Source", "Visitor Source", "Landing Page URL",
];

router.get("/admin/export/orders", requireAdmin, async (req, res) => {
  try {
    const source  = typeof req.query.source === "string" ? req.query.source.trim() : null;
    const from    = typeof req.query.from   === "string" ? req.query.from.trim()   : null;
    const to      = typeof req.query.to     === "string" ? req.query.to.trim()     : null;
    const format  = typeof req.query.format === "string" ? req.query.format.trim() : "csv";

    const params: (string | Date)[] = [];
    const conditions: string[] = [];

    if (source) {
      params.push(source);
      conditions.push(`LOWER(source) = LOWER($${params.length})`);
    }
    if (from) {
      params.push(new Date(from));
      conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to + "T23:59:59"));
      conditions.push(`created_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT order_id, created_at, name, phone, city, state, pincode, address,
             product, quantity, status, payment_method, payment_status,
             source, visitor_source, landing_page_url
      FROM orders
      ${where}
      ORDER BY created_at DESC
    `;

    const { rows } = await pool.query(sql, params);

    // Build filename
    const tag = source ? `_${source}` : "_all";
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `prakriti_orders${tag}_${dateStr}.csv`;

    // CSV with UTF-8 BOM for Excel
    const csvLines: string[] = ["\uFEFF" + HEADERS.join(",")];
    for (const r of rows) {
      csvLines.push([
        cell(r.order_id),
        cell(toIST(r.created_at as Date)),
        cell(r.name as string),
        cell(r.phone as string),
        cell(r.city as string),
        cell(r.state as string),
        cell(r.pincode as string),
        cell(r.address as string),
        cell(r.product as string),
        cell(r.quantity as number),
        cell(999),  // fixed price ₹999
        cell(r.status as string),
        cell(r.payment_method as string),
        cell(r.payment_status as string),
        cell(r.source as string),
        cell(r.visitor_source as string),
        cell(r.landing_page_url as string),
      ].join(","));
    }

    // JSON format — for client-side xlsx generation
    if (format === "json") {
      res.setHeader("Cache-Control", "no-cache");
      res.json(rows.map((r) => ({
        "Order ID":       r.order_id,
        "Date (IST)":     toIST(r.created_at as Date),
        "Customer Name":  r.name,
        "Phone":          r.phone,
        "City":           r.city ?? "",
        "State":          r.state ?? "",
        "Pincode":        r.pincode ?? "",
        "Address":        r.address,
        "Product":        r.product,
        "Qty":            r.quantity,
        "Amount (₹)":     999,
        "Status":         r.status,
        "Payment Method": r.payment_method ?? "",
        "Payment Status": r.payment_status ?? "",
        "Source":            r.source ?? "",
        "Visitor Source":    r.visitor_source ?? "",
        "Landing Page URL":  r.landing_page_url ?? "",
      })));
      return;
    }

    const csv = csvLines.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    res.send(csv);
  } catch (err) {
    console.error("[EXPORT] Failed:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

const STATS_RESET_KEY = "stats_reset_date";

/** Summary stats for an agency — filtered by reset date if set */
router.get("/admin/export/agency-stats", requireAdmin, async (_req, res) => {
  try {
    // Check if a reset date is stored
    const { rows: cfgRows } = await pool.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, [STATS_RESET_KEY]
    );
    const resetDate: string | null = cfgRows[0]?.value ?? null;

    const dateFilter = resetDate
      ? `AND created_at >= $1`
      : "";
    const params = resetDate ? [resetDate] : [];

    const { rows } = await pool.query(`
      SELECT
        source,
        COUNT(*)::int                                               AS total_orders,
        COUNT(*) FILTER (WHERE status = 'Delivered')::int          AS delivered,
        COUNT(*) FILTER (WHERE status = 'Cancelled')::int          AS cancelled,
        COUNT(*) FILTER (WHERE status = 'New')::int                AS new_orders,
        MIN(created_at)                                            AS first_order,
        MAX(created_at)                                            AS last_order
      FROM orders
      WHERE source IS NOT NULL AND source != '' AND deleted_at IS NULL
      ${dateFilter}
      GROUP BY source
      ORDER BY total_orders DESC
    `, params);

    res.json({ rows, resetDate: resetDate ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch agency stats" });
  }
});

/** Get current stats reset date */
router.get("/admin/agency-stats/reset", requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = $1 LIMIT 1`, [STATS_RESET_KEY]
    );
    res.json({ resetDate: rows[0]?.value ?? null });
  } catch { res.status(500).json({ error: "Failed to get reset date" }); }
});

/** Set stats reset date to now (start fresh tracking) */
router.post("/admin/agency-stats/reset", requireAdmin, async (_req, res) => {
  try {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [STATS_RESET_KEY, now]
    );
    res.json({ ok: true, resetDate: now });
  } catch { res.status(500).json({ error: "Failed to set reset date" }); }
});

/** Clear stats reset date (show all-time stats again) */
router.delete("/admin/agency-stats/reset", requireAdmin, async (_req, res) => {
  try {
    await pool.query(`DELETE FROM app_settings WHERE key = $1`, [STATS_RESET_KEY]);
    res.json({ ok: true, resetDate: null });
  } catch { res.status(500).json({ error: "Failed to clear reset date" }); }
});

export default router;
