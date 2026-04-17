/**
 * Meta Conversions API (CAPI) — server-side / CRM event delivery
 *
 * Sends events directly from the server to Meta's Graph API using
 * action_source: "system_generated" (CRM-mode), which is the correct
 * action_source when the event originates from a CRM or backend system
 * rather than a browser page-view.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 *
 * Requires the META_ACCESS_TOKEN environment variable — a System User token
 * with "ads_management" permission, created in:
 *   Meta Business Manager → Business Settings → System Users → Generate Token
 */

import { createHash } from "crypto";
import { readAgencies, appendCapiLog, appendPendingEvent } from "../routes/agencies.js";

const DEFAULT_PIXEL_ID = "922105827363336";

/** SHA-256 hash a string (lowercase-trimmed) as required by Meta CAPI */
function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Normalize an Indian mobile number to E.164 digits for hashing.
 * Strips spaces/dashes, removes leading 0, prepends country code 91.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export interface CAPIEventParams {
  /** Standard Meta event name */
  eventName: "Lead" | "Purchase" | "InitiateCheckout" | "PageView";

  /**
   * Deduplication ID — MUST match the eventID passed to the browser-side
   * fbq("track", "Lead", { eventID: "..." }) call so Meta counts them as
   * one event, not two.
   */
  eventId?: string;

  /** Customer identifiers — all hashed with SHA-256 before sending */
  phone?: string;
  email?: string;
  name?: string;

  /**
   * Location fields — significantly improve Match Quality score.
   * Already collected at order time; passed directly from orders.ts.
   * city and state are hashed; pincode is hashed as zip code (zp).
   */
  city?: string | null;
  state?: string | null;
  pincode?: string | null;

  /** Browser signals forwarded from the client request */
  ipAddress?: string;
  userAgent?: string;
  fbp?: string;   // _fbp cookie (Meta's first-party browser ID)
  fbc?: string;   // _fbc cookie (click ID from Meta ads)

  /** CRM-specific identifier for the lead */
  leadId?: string;

  /**
   * Additional custom_data fields merged on top of the CRM defaults.
   * Do NOT pass event_source or lead_event_source here — they are set
   * automatically as required CRM fields.
   */
  customData?: Record<string, unknown>;
}

/** Build a CAPI event payload ready to POST */
function buildPayload(params: CAPIEventParams, pixelId: string, token: string): { url: string; body: Record<string, unknown> } {
  const eventTime = Math.floor(Date.now() / 1000);

  const userData: Record<string, unknown> = {
    country: [sha256("in")],
  };

  if (params.phone) {
    userData["ph"] = [sha256(normalizePhone(params.phone))];
  }

  if (params.email) {
    userData["em"] = [sha256(params.email)];
  }

  if (params.name) {
    const parts = params.name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (firstName) userData["fn"] = [sha256(firstName)];
    if (lastName)  userData["ln"] = [sha256(lastName)];
  }

  // Location signals — each adds +1–3 points to Meta Match Quality score
  if (params.city)    userData["ct"] = [sha256(params.city)];
  if (params.state)   userData["st"] = [sha256(params.state)];
  if (params.pincode) userData["zp"] = [sha256(params.pincode)];

  if (params.ipAddress) userData["client_ip_address"] = params.ipAddress;
  if (params.userAgent) userData["client_user_agent"] = params.userAgent;
  if (params.fbp)       userData["fbp"] = params.fbp;
  if (params.fbc)       userData["fbc"] = params.fbc;

  const customData: Record<string, unknown> = {
    event_source:      "crm",
    lead_event_source: "Prakriti CRM",
    currency:          "INR",
    value:             999,
    content_name:      "KamaSutra Gold+",
    ...(params.customData ?? {}),
  };

  const eventPayload: Record<string, unknown> = {
    event_name:    params.eventName,
    event_time:    eventTime,
    action_source: "system_generated",
    user_data:     userData,
    custom_data:   customData,
  };

  if (params.eventId) eventPayload["event_id"] = params.eventId;
  if (params.leadId)  eventPayload["lead_id"]  = params.leadId;

  return {
    url:  `https://graph.facebook.com/v25.0/${pixelId}/events`,
    body: { data: [eventPayload], access_token: token },
  };
}

/**
 * Send a single event to ONE pixel/token pair.
 * Returns false and logs nothing if token is empty.
 */
async function fireToPixel(
  params: CAPIEventParams,
  pixelId: string,
  token: string,
  label = "default",
): Promise<boolean> {
  if (!token || !pixelId) return false;
  const { url, body } = buildPayload(params, pixelId, token);
  try {
    const response = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = (await response.json()) as { error?: { message?: string } };
        errMsg = errJson?.error?.message ?? errMsg;
      } catch { /* ignore parse error */ }
      console.error(`[CAPI][${label}] ${params.eventName} — ${errMsg}`);

      // Write failure to activity log + pending retry queue
      void appendCapiLog({ agencyName: label, pixelId, event: params.eventName, status: "failed", message: errMsg });
      void appendPendingEvent({ agencyName: label, pixelId, capiToken: token, event: params.eventName, payload: body as Record<string, unknown> });
      return false;
    }

    const json = (await response.json()) as { events_received?: number };
    const msg = `events_received=${json.events_received ?? 1}`;
    console.log(`[CAPI][${label}] ${params.eventName} sent. ${msg}`, params.eventId ? `event_id=${params.eventId}` : "");

    // Write success to activity log
    void appendCapiLog({ agencyName: label, pixelId, event: params.eventName, status: "success", message: msg });
    return true;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Network error";
    console.error(`[CAPI][${label}] Network error:`, errMsg);

    // Write failure to activity log + pending retry queue
    void appendCapiLog({ agencyName: label, pixelId, event: params.eventName, status: "failed", message: errMsg });
    void appendPendingEvent({ agencyName: label, pixelId, capiToken: token, event: params.eventName, payload: body as Record<string, unknown> });
    return false;
  }
}

/**
 * Send a single event to Meta Conversions API in CRM/system mode.
 * Uses the default pixel (env META_ACCESS_TOKEN + hardcoded pixel ID).
 *
 * Behaviour:
 *  - Returns false and logs nothing if META_ACCESS_TOKEN is not set.
 *  - Never throws — errors are caught and logged; order flow is never blocked.
 */
export async function sendCapiEvent(params: CAPIEventParams): Promise<boolean> {
  const token = process.env["META_ACCESS_TOKEN"];
  if (!token) return false;
  return fireToPixel(params, DEFAULT_PIXEL_ID, token, "default");
}

/**
 * Fire CAPI event to the default pixel + any active agency whose sourceName
 * matches the incoming order's source tag (case-insensitive).
 *
 * Logic:
 *  - Main pixel (META_ACCESS_TOKEN): ALWAYS fires — it is the primary pixel.
 *  - Agency pixels: fire ONLY when orderSource matches the agency's sourceName.
 *    e.g. orderSource="sartaj" → Sartaj agency pixel fires alongside main pixel.
 *    e.g. orderSource="organic" or undefined → only main pixel fires.
 *
 * Uses Promise.allSettled so one failure never blocks the others.
 */
export async function sendCapiToAllAgencies(
  params: CAPIEventParams,
  orderSource?: string,
): Promise<void> {
  const fires: Promise<boolean>[] = [];

  // 1. Default pixel (env token) — always fires
  const envToken = process.env["META_ACCESS_TOKEN"];
  if (envToken) {
    fires.push(fireToPixel(params, DEFAULT_PIXEL_ID, envToken, "default"));
  }

  // 2. Agency pixels — fire only when source matches
  if (orderSource) {
    try {
      const agencies = await readAgencies();
      for (const agency of agencies) {
        if (!agency.active || !agency.capiToken || !agency.pixelId) continue;
        if (!agency.sourceName) continue;
        const matches = orderSource.trim().toLowerCase() === agency.sourceName.trim().toLowerCase();
        if (matches) {
          console.log(`[CAPI] Source "${orderSource}" matched agency "${agency.name}" — firing agency pixel`);
          fires.push(fireToPixel(params, agency.pixelId, agency.capiToken, agency.name));
        }
      }
    } catch (err) {
      console.warn("[CAPI] Could not read agency profiles:", err);
    }
  }

  if (fires.length === 0) return;
  await Promise.allSettled(fires);
}
