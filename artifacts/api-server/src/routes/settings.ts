import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const ALLOWED_KEYS = [
  "shiprocket_email",
  "shiprocket_password",
  "shadowfax_client_id",
  "shadowfax_api_token",
  "shadowfax_store_id",
  "shadowfax_pickup_pincode",
  "shadowfax_pickup_address",
  "shadowfax_pickup_contact",
  "whatsapp_api_url",
  "whatsapp_api_key",
  "whatsapp_provider",
  "whatsapp_template_order_confirmed",
  "whatsapp_template_abandoned_cart",
  "razorpay_key_id",
  "razorpay_key_secret",
  "cashfree_app_id",
  "cashfree_secret_key",
  "gst_number",
  "company_pan",
  "director_name",
  "director_signature_url",
  "report_email",
  "popup_banner_url",
  "footer_phone",
  "footer_email",
];

const PUBLIC_KEYS = ["popup_banner_url", "footer_phone", "footer_email"];

/** Public — no auth — returns only popup_banner_url, footer_phone, footer_email */
router.get("/public/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const result: Record<string, string> = {};
    for (const key of PUBLIC_KEYS) {
      const row = rows.find((r) => r.key === key);
      if (row?.value) result[key] = row.value;
    }
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
    res.json(result);
  } catch (err) {
    console.error("Public settings error:", err); // ADDED THIS
    res.status(500).json({ error: "Failed to fetch public settings" });
  }
});

router.get("/admin/settings", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      const val = row.key.toLowerCase().includes("secret") || row.key.toLowerCase().includes("password")
        ? row.value.replace(/./g, "•")
        : row.value;
      settings[row.key] = val;
    }
    const exists: Record<string, boolean> = {};
    for (const key of ALLOWED_KEYS) {
      exists[key] = !!rows.find((r) => r.key === key && r.value);
    }
    res.json({ settings, exists });
  } catch(err) {
    console.error("Public settings error:", err); // ADDED THIS
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.post("/admin/settings", requireAdmin, async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;

    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (!value || value.includes("•")) continue;

      await db.insert(appSettingsTable).values({ key, value: value.trim() })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: value.trim(), updatedAt: new Date() } });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

export async function getSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(appSettingsTable).where(inArray(appSettingsTable.key, keys));
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  } catch {
    return {};
  }
}

/** Save an arbitrary key/value pair to app_settings (no ALLOWED_KEYS check) */
export async function saveSettingsBatch(updates: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    await db.insert(appSettingsTable).values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
}

export default router;
