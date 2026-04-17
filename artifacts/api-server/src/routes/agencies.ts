import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { randomUUID, createHash } from "crypto";

const router: IRouter = Router();

const KEY = "agency_profiles";
const LOG_KEY = "capi_activity_log";
const PENDING_KEY = "capi_pending_events";

export interface AgencyProfile {
  id: string;
  name: string;
  sourceName: string;
  pixelId: string;
  businessManagerId: string;
  capiToken: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  ga4MeasurementId: string;
  googleSheetWebhookUrl: string;
  active: boolean;
  createdAt: string;
}

export interface CapiLogEntry {
  id: string;
  timestamp: string;
  agencyName: string;
  pixelId: string;
  event: string;
  status: "success" | "failed";
  message: string;
}

export interface PendingCapiEvent {
  id: string;
  timestamp: string;
  agencyName: string;
  pixelId: string;
  event: string;
  capiToken: string;
  payload: Record<string, unknown>;
}

/* ── DB helpers ─────────────────────────────────────────────────── */
async function readAgencies(): Promise<AgencyProfile[]> {
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1", [KEY],
  );
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].value) as AgencyProfile[]; }
  catch { return []; }
}

async function writeAgencies(profiles: AgencyProfile[]): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify(profiles)],
  );
}

async function readLog(): Promise<CapiLogEntry[]> {
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1", [LOG_KEY],
  );
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].value) as CapiLogEntry[]; }
  catch { return []; }
}

async function readPending(): Promise<PendingCapiEvent[]> {
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1", [PENDING_KEY],
  );
  if (!rows[0]) return [];
  try { return JSON.parse(rows[0].value) as PendingCapiEvent[]; }
  catch { return []; }
}

async function writePending(events: PendingCapiEvent[]): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [PENDING_KEY, JSON.stringify(events)],
  );
}

/** Add an entry to the CAPI activity log (max 20) — atomic, no race condition */
export async function appendCapiLog(entry: Omit<CapiLogEntry, "id" | "timestamp">): Promise<void> {
  try {
    const newEntry = JSON.stringify({ id: randomUUID(), timestamp: new Date().toISOString(), ...entry });
    /*
     * Atomically prepend the new entry and keep at most 19 existing entries (20 total).
     * Single SQL statement — avoids the read-modify-write race condition that previously
     * caused simultaneous Default + Agency writes to overwrite each other.
     *
     * jsonb_path_query_array(arr, '$[0 to 18]') returns the first 19 elements of the
     * existing array, so combined with the new entry we never exceed 20.
     */
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, jsonb_build_array($2::jsonb)::text, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = (
         jsonb_build_array($2::jsonb) ||
         jsonb_path_query_array(
           COALESCE(app_settings.value::jsonb, '[]'::jsonb),
           '$[0 to 18]'
         )
       )::text,
       updated_at = NOW()`,
      [LOG_KEY, newEntry],
    );
  } catch { /* non-blocking */ }
}

/** Add a failed event to the pending retry queue (max 50) */
export async function appendPendingEvent(event: Omit<PendingCapiEvent, "id" | "timestamp">): Promise<void> {
  try {
    const pending = await readPending();
    pending.unshift({ id: randomUUID(), timestamp: new Date().toISOString(), ...event });
    await writePending(pending.slice(0, 50));
  } catch { /* non-blocking */ }
}

/* ── CAPI test helper ───────────────────────────────────────────── */
function sha256(s: string) { return createHash("sha256").update(s.trim().toLowerCase()).digest("hex"); }

/**
 * PUBLIC — no auth required.
 * GET /api/public/agency-pixel?source=taj
 * Returns the browser pixel ID for the matching active agency (if any).
 * Frontend uses this to dynamically initialise the agency pixel via fbq('init').
 */
router.get("/public/agency-pixel", async (req, res) => {
  const source = typeof req.query["source"] === "string" ? req.query["source"].trim().toLowerCase() : "";
  if (!source) { res.json({ pixelId: null }); return; }
  try {
    const agencies = await readAgencies();
    const match = agencies.find(
      (a) => a.active && a.pixelId && a.sourceName?.trim().toLowerCase() === source,
    );
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    res.json({ pixelId: match?.pixelId ?? null });
  } catch {
    res.json({ pixelId: null });
  }
});

export { readAgencies };

async function testCapiConnection(pixelId: string, token: string): Promise<{ ok: boolean; message: string }> {
  const url = `https://graph.facebook.com/v25.0/${pixelId}/events`;
  const payload = {
    data: [{
      event_name: "PageView",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      user_data: { country: [sha256("in")], ph: [sha256("9999999999")] },
      custom_data: { event_source: "crm", lead_event_source: "Prakriti CRM - Connection Test" },
    }],
    access_token: token,
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json() as { events_received?: number; error?: { message?: string; code?: number } };
    if (!res.ok || json.error) {
      return { ok: false, message: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, message: `✅ Connected — events_received: ${json.events_received ?? 1}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Network error" };
  }
}

/* ── Routes ─────────────────────────────────────────────────────── */

router.get("/admin/agencies", requireAdmin, async (_req, res) => {
  try {
    const profiles = await readAgencies();
    const masked = profiles.map((p) => ({
      ...p,
      capiToken: p.capiToken ? "••••••••" + p.capiToken.slice(-4) : "",
    }));
    res.json(masked);
  } catch {
    res.status(500).json({ error: "Failed to fetch agencies" });
  }
});

router.post("/admin/agencies", requireAdmin, async (req, res) => {
  try {
    const body = req.body as Partial<AgencyProfile> & { id?: string };

    // Auto-clean token: strip spaces and invisible characters
    const cleanToken = (t?: string) => t ? t.replace(/[\s\u200B-\u200D\uFEFF]/g, "").trim() : undefined;

    const profiles = await readAgencies();

    if (body.id) {
      const idx = profiles.findIndex((p) => p.id === body.id);
      if (idx === -1) return res.status(404).json({ error: "Agency not found" });
      const existing = profiles[idx];
      const rawToken = cleanToken(body.capiToken);
      const updated: AgencyProfile = {
        ...existing,
        name: body.name?.trim() ?? existing.name,
        sourceName: body.sourceName?.trim().toLowerCase() ?? existing.sourceName,
        pixelId: body.pixelId?.trim() ?? existing.pixelId,
        businessManagerId: body.businessManagerId?.trim() ?? existing.businessManagerId,
        googleAdsConversionId: body.googleAdsConversionId?.trim() ?? existing.googleAdsConversionId,
        googleAdsConversionLabel: body.googleAdsConversionLabel?.trim() ?? existing.googleAdsConversionLabel,
        ga4MeasurementId: body.ga4MeasurementId?.trim() ?? existing.ga4MeasurementId,
        googleSheetWebhookUrl: body.googleSheetWebhookUrl?.trim() ?? existing.googleSheetWebhookUrl,
        active: body.active !== undefined ? body.active : existing.active,
        capiToken: (rawToken && !rawToken.startsWith("••")) ? rawToken : existing.capiToken,
      };
      profiles[idx] = updated;
      await writeAgencies(profiles);
      return res.json({ ...updated, capiToken: updated.capiToken ? "••••••••" + updated.capiToken.slice(-4) : "" });
    }

    const newProfile: AgencyProfile = {
      id: randomUUID(),
      name: body.name?.trim() ?? "New Agency",
      sourceName: body.sourceName?.trim().toLowerCase() ?? "",
      pixelId: body.pixelId?.trim() ?? "",
      businessManagerId: body.businessManagerId?.trim() ?? "",
      capiToken: cleanToken(body.capiToken) ?? "",
      googleAdsConversionId: body.googleAdsConversionId?.trim() ?? "",
      googleAdsConversionLabel: body.googleAdsConversionLabel?.trim() ?? "",
      ga4MeasurementId: body.ga4MeasurementId?.trim() ?? "",
      googleSheetWebhookUrl: body.googleSheetWebhookUrl?.trim() ?? "",
      active: body.active !== undefined ? body.active : true,
      createdAt: new Date().toISOString(),
    };
    profiles.push(newProfile);
    await writeAgencies(profiles);
    return res.status(201).json({ ...newProfile, capiToken: newProfile.capiToken ? "••••••••" + newProfile.capiToken.slice(-4) : "" });
  } catch {
    res.status(500).json({ error: "Failed to save agency" });
  }
});

router.patch("/admin/agencies/:id/toggle", requireAdmin, async (req, res) => {
  try {
    const profiles = await readAgencies();
    const idx = profiles.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Agency not found" });
    profiles[idx].active = !profiles[idx].active;
    await writeAgencies(profiles);
    res.json({ id: profiles[idx].id, active: profiles[idx].active });
  } catch {
    res.status(500).json({ error: "Failed to toggle agency" });
  }
});

router.delete("/admin/agencies/:id", requireAdmin, async (req, res) => {
  try {
    const profiles = await readAgencies();
    const filtered = profiles.filter((p) => p.id !== req.params.id);
    await writeAgencies(filtered);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete agency" });
  }
});

/** Test CAPI connection for a specific agency */
router.post("/admin/agencies/:id/test", requireAdmin, async (req, res) => {
  try {
    const profiles = await readAgencies();
    const agency = profiles.find((p) => p.id === req.params.id);
    if (!agency) return res.status(404).json({ ok: false, message: "Agency not found" });
    if (!agency.pixelId || !agency.capiToken) return res.json({ ok: false, message: "Pixel ID or CAPI Token not configured" });

    const result = await testCapiConnection(agency.pixelId, agency.capiToken);
    await appendCapiLog({
      agencyName: agency.name, pixelId: agency.pixelId,
      event: "Test", status: result.ok ? "success" : "failed", message: result.message,
    });
    res.json(result);
  } catch {
    res.status(500).json({ ok: false, message: "Internal error running test" });
  }
});

/** Pause all agencies at once (Emergency Reset) */
router.post("/admin/agencies/pause-all", requireAdmin, async (_req, res) => {
  try {
    const profiles = await readAgencies();
    const paused = profiles.map((p) => ({ ...p, active: false }));
    await writeAgencies(paused);
    res.json({ ok: true, paused: paused.length });
  } catch {
    res.status(500).json({ error: "Failed to pause all agencies" });
  }
});

/** CAPI Activity Log */
router.get("/admin/capi-log", requireAdmin, async (_req, res) => {
  try { res.json(await readLog()); }
  catch { res.status(500).json({ error: "Failed to fetch log" }); }
});

router.delete("/admin/capi-log", requireAdmin, async (_req, res) => {
  try {
    await pool.query("DELETE FROM app_settings WHERE key = $1", [LOG_KEY]);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to clear log" }); }
});

/** Pending CAPI events (failed, awaiting retry) */
router.get("/admin/capi-pending", requireAdmin, async (_req, res) => {
  try { res.json(await readPending()); }
  catch { res.status(500).json({ error: "Failed to fetch pending events" }); }
});

router.post("/admin/capi-pending/:id/retry", requireAdmin, async (req, res) => {
  try {
    const pending = await readPending();
    const event = pending.find((e) => e.id === req.params.id);
    if (!event) return res.status(404).json({ ok: false, message: "Event not found" });

    const url = `https://graph.facebook.com/v25.0/${event.pixelId}/events`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...event.payload, access_token: event.capiToken }),
    });
    const json = await response.json() as { events_received?: number; error?: { message?: string } };

    if (!response.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${response.status}`;
      await appendCapiLog({ agencyName: event.agencyName, pixelId: event.pixelId, event: "Retry", status: "failed", message: msg });
      return res.json({ ok: false, message: msg });
    }

    // Remove from pending on success
    const remaining = pending.filter((e) => e.id !== req.params.id);
    await writePending(remaining);
    await appendCapiLog({ agencyName: event.agencyName, pixelId: event.pixelId, event: "Retry", status: "success", message: `Retry succeeded — events_received: ${json.events_received ?? 1}` });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Retry failed" });
  }
});

router.delete("/admin/capi-pending/:id", requireAdmin, async (req, res) => {
  try {
    const pending = await readPending();
    await writePending(pending.filter((e) => e.id !== req.params.id));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete pending event" }); }
});

export default router;
