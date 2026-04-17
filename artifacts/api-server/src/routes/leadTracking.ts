import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router: IRouter = Router();

function resolveIp(req: Request): string | undefined {
  const candidates = [
    req.headers["cf-connecting-ip"],
    req.headers["x-real-ip"],
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim(),
    req.ip,
    req.socket?.remoteAddress,
  ];
  for (const c of candidates) {
    const ip = (Array.isArray(c) ? c[0] : c)?.trim();
    if (ip && ip !== "::1" && ip !== "127.0.0.1") return ip;
  }
  return undefined;
}

// ── Public: receive lead click ───────────────────────────────────────────────
router.post("/lead-click", async (req, res) => {
  try {
    const body = req.body as {
      eventId?: string;
      type?: string;
      source?: string;
      customerPhone?: string;
      callStatus?: string;
      pageUrl?: string;
      landingPage?: string;
      campaignName?: string;
      adsetName?: string;
      adName?: string;
      deviceType?: string;
      browser?: string;
      userAgent?: string;
      referrer?: string;
      website?: string;
      domain?: string;
    };

    const type = (body.type ?? "call").toLowerCase();
    const source = (body.source ?? "direct").toLowerCase();
    const callStatus = body.callStatus ?? "clicked";
    const ipAddress = resolveIp(req);
    const userAgent = body.userAgent ?? (req.headers["user-agent"] as string | undefined);

    await pool.query(
      `INSERT INTO lead_tracking
        (event_id, type, source, customer_phone, call_status,
         page_url, landing_page, campaign_name, adset_name, ad_name,
         device_type, browser, ip_address, user_agent, referrer, country,
         website, domain)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'India',$16,$17)`,
      [
        body.eventId ?? null,
        type,
        source,
        body.customerPhone ?? null,
        callStatus,
        body.pageUrl ?? null,
        body.landingPage ?? null,
        body.campaignName ?? null,
        body.adsetName ?? null,
        body.adName ?? null,
        body.deviceType ?? null,
        body.browser ?? null,
        ipAddress ?? null,
        userAgent ?? null,
        body.referrer ?? null,
        body.website?.trim() || null,
        body.domain?.trim() || null,
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "[LeadTrack] Insert failed");
    return res.status(500).json({ ok: false });
  }
});

// ── Admin: list leads ─────────────────────────────────────────────────────────
router.get("/admin/lead-tracking", requireAdmin, async (req, res) => {
  try {
    const { type, status, source, phone, dateFrom, dateTo, page, limit, website } =
      req.query as Record<string, string | undefined>;

    const pg = Math.max(1, parseInt(page ?? "1", 10));
    const lim = Math.min(100, Math.max(1, parseInt(limit ?? "50", 10)));
    const offset = (pg - 1) * lim;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (type && type !== "all") {
      params.push(type.toLowerCase());
      conditions.push(`type = $${params.length}`);
    }
    if (status && status !== "all") {
      params.push(status.toLowerCase());
      conditions.push(`call_status = $${params.length}`);
    }
    if (source && source !== "all") {
      params.push(source.toLowerCase());
      conditions.push(`LOWER(source) = $${params.length}`);
    }
    if (phone) {
      const cleaned = phone.replace(/\D/g, "").slice(-10);
      params.push(`%${cleaned}%`);
      conditions.push(`customer_phone LIKE $${params.length}`);
    }
    if (website && website !== "all") {
      params.push(website.toUpperCase());
      conditions.push(`UPPER(website) = $${params.length}`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      conditions.push(`created_at >= $${params.length}::date`);
    }
    if (dateTo) {
      params.push(dateTo);
      conditions.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM lead_tracking ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    params.push(lim, offset);
    const { rows } = await pool.query<{
      id: number; event_id: string | null; type: string; source: string;
      customer_phone: string | null; call_status: string; call_duration: number | null;
      page_url: string | null; landing_page: string | null;
      campaign_name: string | null; adset_name: string | null; ad_name: string | null;
      device_type: string | null; browser: string | null; ip_address: string | null;
      user_agent: string | null; referrer: string | null;
      city: string | null; state: string | null; country: string | null;
      created_at: string;
    }>(
      `SELECT * FROM lead_tracking ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ data: rows, total, page: pg, limit: lim });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] List failed");
    return res.status(500).json({ error: "Failed to fetch lead tracking data" });
  }
});

// ── Admin: export all (for Excel) ────────────────────────────────────────────
router.get("/admin/lead-tracking/export", requireAdmin, async (req, res) => {
  try {
    const { type, status, source, phone, dateFrom, dateTo, website } =
      req.query as Record<string, string | undefined>;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (type && type !== "all") { params.push(type.toLowerCase()); conditions.push(`type = $${params.length}`); }
    if (status && status !== "all") { params.push(status.toLowerCase()); conditions.push(`call_status = $${params.length}`); }
    if (source && source !== "all") { params.push(source.toLowerCase()); conditions.push(`LOWER(source) = $${params.length}`); }
    if (phone) { const c = phone.replace(/\D/g, "").slice(-10); params.push(`%${c}%`); conditions.push(`customer_phone LIKE $${params.length}`); }
    if (website && website !== "all") { params.push(website.toUpperCase()); conditions.push(`UPPER(website) = $${params.length}`); }
    if (dateFrom) { params.push(dateFrom); conditions.push(`created_at >= $${params.length}::date`); }
    if (dateTo) { params.push(dateTo); conditions.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT * FROM lead_tracking ${where} ORDER BY created_at DESC LIMIT 5000`,
      params
    );

    return res.json({ data: rows });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Export failed");
    return res.status(500).json({ error: "Export failed" });
  }
});

// ── Admin: update call status (for call-back tracking) ───────────────────────
router.patch("/admin/lead-tracking/:id/status", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { callStatus } = req.body as { callStatus?: string };
    if (!callStatus) return res.status(400).json({ error: "callStatus required" });
    await pool.query(
      `UPDATE lead_tracking SET call_status = $1 WHERE id = $2`,
      [callStatus, id]
    );
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Status update failed");
    return res.status(500).json({ error: "Update failed" });
  }
});

// ── Admin: full edit lead ─────────────────────────────────────────────────────
router.patch("/admin/lead-tracking/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { customerPhone, callStatus, notes } = req.body as {
      customerPhone?: string; callStatus?: string; notes?: string;
    };
    const validStatuses = ["clicked", "missed", "answered", "called_back"];
    if (callStatus && !validStatuses.includes(callStatus))
      return res.status(400).json({ error: "Invalid status" });

    const sets: string[] = [];
    const params: unknown[] = [];
    if (customerPhone !== undefined) { params.push(customerPhone.replace(/\D/g, "").slice(-10) || null); sets.push(`customer_phone = $${params.length}`); }
    if (callStatus !== undefined) { params.push(callStatus); sets.push(`call_status = $${params.length}`); }
    if (notes !== undefined) { params.push(notes.trim() || null); sets.push(`notes = $${params.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE lead_tracking SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "Lead not found" });
    return res.json({ ok: true, lead: rows[0] });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Edit failed");
    return res.status(500).json({ error: "Edit failed" });
  }
});

// ── Admin: delete single lead ─────────────────────────────────────────────────
router.delete("/admin/lead-tracking/cleanup", requireAdmin, async (req, res) => {
  try {
    const { days, missedOnly, confirm: confirmFlag } =
      req.query as Record<string, string | undefined>;
    if (confirmFlag !== "true") return res.status(400).json({ error: "confirm=true required" });
    const daysNum = Math.max(1, parseInt(days ?? "30", 10));
    let query = `DELETE FROM lead_tracking WHERE created_at < NOW() - INTERVAL '${daysNum} days'`;
    if (missedOnly === "true") query += ` AND call_status = 'missed'`;
    query += ` RETURNING id`;
    const { rows } = await pool.query(query);
    return res.json({ ok: true, deleted: rows.length });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Cleanup failed");
    return res.status(500).json({ error: "Cleanup failed" });
  }
});

router.delete("/admin/lead-tracking/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { confirm: confirmFlag } = req.query as Record<string, string | undefined>;
    if (confirmFlag !== "true") return res.status(400).json({ error: "confirm=true required" });
    const { rows } = await pool.query(
      `DELETE FROM lead_tracking WHERE id = $1 RETURNING id`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Lead not found" });
    return res.json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Delete failed");
    return res.status(500).json({ error: "Delete failed" });
  }
});

// ── Admin: bulk delete leads ──────────────────────────────────────────────────
router.post("/admin/lead-tracking/delete-bulk", requireAdmin, async (req, res) => {
  try {
    const { ids, confirm: confirmFlag } = req.body as { ids?: number[]; confirm?: boolean };
    if (!confirmFlag) return res.status(400).json({ error: "confirm: true required" });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids[] required" });
    const { rows } = await pool.query(
      `DELETE FROM lead_tracking WHERE id = ANY($1) RETURNING id`, [ids]
    );
    return res.json({ ok: true, deleted: rows.length });
  } catch (err) {
    req.log.error({ err }, "[LeadTrack] Bulk delete failed");
    return res.status(500).json({ error: "Bulk delete failed" });
  }
});

export default router;
