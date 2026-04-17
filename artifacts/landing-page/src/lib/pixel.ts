/**
 * Meta Pixel — centralized event helpers
 * Pixel ID: 1188710012812588
 *
 * Guards:
 * - sessionStorage flags prevent double-firing per action
 * - All calls are wrapped in try/catch so pixel errors never break order flow
 */

const PIXEL_ID = "922105827363336";
const SS_PURCHASE_KEY    = "pixel_payment_initiated";
const SS_PURCHASE_FIRED  = "pixel_purchase_fired";
const SS_PURCHASE_EVT_ID = "pixel_purchase_event_id";

/**
 * Generate a unique event ID for client–server deduplication.
 * The same ID must be passed to both the browser fbq() call and the
 * server-side CAPI call so Meta counts them as one event, not two.
 */
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Read a cookie value by name from document.cookie.
 * Returns undefined if not found or if cookies aren't accessible.
 */
export function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Internal wrapper around window.fbq.
 *
 * Meta's deduplication spec requires eventID in the *4th* argument (options
 * object), NOT inside the custom-data (3rd argument).
 *
 *   CORRECT: fbq('track', 'Purchase', customData, { eventID: 'abc' })
 *   WRONG:   fbq('track', 'Purchase', { ...customData, eventID: 'abc' })
 *
 * Pass `eventID` here and this wrapper places it correctly.
 */
function fbq(
  _action: string,
  name: string,
  params?: Record<string, unknown>,
  eventID?: string,
): void {
  try {
    const fn = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fn === "function") {
      if (eventID) {
        fn("track", name, params ?? {}, { eventID });
      } else {
        fn("track", name, params ?? {});
      }
    }
  } catch {
    // Pixel errors must never affect the order flow
  }
}

/** SHA-256 hash a string — Meta requires lowercase hex for Advanced Matching */
async function sha256(str: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str.trim().toLowerCase()));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

/**
 * Call fbq('init') again with hashed user data so Meta can match events
 * to real Facebook profiles. Improves Event Match Quality (EMQ) score.
 *
 * Fields sent (all SHA-256 hashed as required by Meta Advanced Matching):
 *  ph — phone   fn — first name   ct — city   st — state   zp — zip
 *
 * Safe to call after the initial pixel init in index.html.
 */
export async function setAdvancedMatching(params: {
  phone?: string;
  firstName?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<void> {
  try {
    const fn = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fn !== "function") return;

    const matchParams: Record<string, string> = {};

    if (params.phone) {
      const digits = params.phone.replace(/\D/g, "");
      const normalized = digits.length === 10 ? `91${digits}` : digits;
      const hashed = await sha256(normalized);
      if (hashed) matchParams["ph"] = hashed;
    }
    if (params.firstName) {
      const nameParts = params.firstName.trim().split(/\s+/);
      const first = nameParts[0] ?? params.firstName;
      const last  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const hashedFn = await sha256(first);
      if (hashedFn) matchParams["fn"] = hashedFn;
      if (last) {
        const hashedLn = await sha256(last);
        if (hashedLn) matchParams["ln"] = hashedLn;
      }
    }
    if (params.city) {
      const hashed = await sha256(params.city.trim().toLowerCase());
      if (hashed) matchParams["ct"] = hashed;
    }
    if (params.state) {
      const hashed = await sha256(params.state.trim().toLowerCase());
      if (hashed) matchParams["st"] = hashed;
    }
    if (params.zip) {
      const hashed = await sha256(params.zip.trim().replace(/\D/g, ""));
      if (hashed) matchParams["zp"] = hashed;
    }

    if (Object.keys(matchParams).length > 0) {
      fn("init", PIXEL_ID, matchParams);
    }
  } catch { /* never break order flow */ }
}

/** Fire on every route change inside the SPA */
export function firePageView(): void {
  fbq("track", "PageView");
}

/**
 * Fire when COD order is successfully submitted — Purchase event for ROAS tracking.
 *
 * Deduplication (order-based, persists across all edge cases):
 *  - Primary key:  "px_purch_order_<orderId>"  (when orderId is available)
 *  - Fallback key: "px_purch_<eventId>"         (if orderId not yet known)
 *  - Stored in localStorage → survives refresh, back-button, WhatsApp return, tab close.
 *  - Stored value includes eventId so CAPI can retrieve it later for matching.
 *  - eventID is passed in the 4th fbq() arg (NOT in custom data) for server CAPI dedup.
 */
export function fireLead(params?: {
  name?: string;
  phone?: string;
  eventId?: string;
  value?: number;
  orderId?: string;    // ← server-returned ORD-XXXXXXXX — preferred dedup key
}): void {
  // ── localStorage dedup guard (order-based) ────────────────────────────────
  const dedupKey = params?.orderId
    ? `px_purch_order_${params.orderId}`    // primary — stable per-order key
    : params?.eventId
      ? `px_purch_${params.eventId}`        // fallback — per-event key
      : null;

  if (dedupKey) {
    try {
      if (localStorage.getItem(dedupKey)) return; // already fired for this order
      // Store eventId alongside so server CAPI can later retrieve & match it
      localStorage.setItem(dedupKey, JSON.stringify({ eventId: params?.eventId ?? null, fired: Date.now() }));
    } catch {
      // localStorage unavailable (private/incognito strict mode) — proceed anyway
    }
  }

  fbq(
    "track",
    "Purchase",
    {
      content_name:  "KamaSutra Gold+",
      content_ids:   ["kamasutra-gold-plus"],
      content_type:  "product",
      currency:      "INR",
      value:         params?.value ?? 999,
    },
    params?.eventId, // ← 4th arg: Meta deduplication key (must NOT be in custom data)
  );
}

/** Fire when user clicks Pay Now (before Cashfree redirect) */
export function fireInitiateCheckout(params?: { quantity?: number }): void {
  fbq("track", "InitiateCheckout", {
    content_name: "KamaSutra Gold+",
    currency: "INR",
    value: 999,
    num_items: params?.quantity ?? 1,
  });
}

/**
 * Mark that a payment was initiated so Purchase can fire on return.
 * Also generates and persists a unique eventId so the browser Purchase
 * call includes eventID for proper Meta deduplication (even though CAPI
 * does not currently fire for Cashfree, this is future-proof).
 * Call this right before redirecting to Cashfree.
 */
export function markPaymentInitiated(): void {
  try {
    const eventId = generateEventId();
    sessionStorage.setItem(SS_PURCHASE_KEY, "1");
    sessionStorage.setItem(SS_PURCHASE_EVT_ID, eventId);
    sessionStorage.removeItem(SS_PURCHASE_FIRED);
  } catch {
    // ignore
  }
}

/**
 * Parse the current URL search params and determine if this looks like a
 * successful Cashfree payment return.
 *
 * Detection uses a three-tier approach so it works across all browsers:
 *
 *  Tier 1 — Explicit status params (most reliable):
 *    Cashfree appends `payment_status` or `txStatus` to the return URL.
 *    We only fire Purchase when the value is a known-success string.
 *    We actively suppress on known-failure values to avoid false Purchase events.
 *
 *  Tier 2 — Order-reference params (no status param present):
 *    If Cashfree appended `order_id`, `cf_order_id`, or `referenceId` without
 *    a status param, we treat it as a successful return (failed payments
 *    typically redirect to an error page, not back to the merchant site).
 *
 *  Tier 3 — Referrer fallback (Safari / Firefox private mode, etc.):
 *    `document.referrer` is checked as a last resort when URL params are absent.
 *    Browsers that strip referrers will miss this tier — which is why Tiers 1/2
 *    are the primary path.
 *
 * The sessionStorage flag (SS_PURCHASE_KEY) must already be set (via
 * markPaymentInitiated) for any tier to trigger. This ensures we never fire
 * Purchase for visitors who land on the page without having clicked Pay Now.
 */
function detectCashfreeReturn(): { detected: boolean; orderId?: string } {
  const params = new URLSearchParams(window.location.search);

  const orderId =
    params.get("order_id") ??
    params.get("cf_order_id") ??
    params.get("referenceId") ??
    undefined;

  // --- Tier 1: Explicit status param ---
  const paymentStatus = (
    params.get("payment_status") ??
    params.get("txStatus") ??
    params.get("status") ??
    ""
  ).toUpperCase();

  const SUCCESS_VALUES = new Set(["SUCCESS", "PAID", "COMPLETED", "OK"]);
  const FAILURE_VALUES = new Set(["FAILED", "FAILURE", "CANCELLED", "CANCELED", "ERROR", "PENDING"]);

  if (paymentStatus) {
    if (SUCCESS_VALUES.has(paymentStatus)) {
      return { detected: true, orderId };
    }
    if (FAILURE_VALUES.has(paymentStatus)) {
      // Explicit failure — do not fire Purchase
      return { detected: false };
    }
  }

  // --- Tier 2: Order-reference params (status absent) ---
  if (orderId) {
    return { detected: true, orderId };
  }

  // --- Tier 3: Referrer fallback ---
  const ref = (document.referrer ?? "").toLowerCase();
  if (
    ref.includes("cashfree") ||
    ref.includes("payments.cashfree.com") ||
    ref.includes("forms/kama")
  ) {
    return { detected: true };
  }

  return { detected: false };
}

/**
 * Call once on app load (App.tsx useEffect).
 * Fires the Purchase pixel event exactly once if the user just returned from
 * a successful Cashfree payment.
 *
 * Guards:
 *  - SS_PURCHASE_FIRED in sessionStorage prevents any duplicate within the session.
 *  - SS_PURCHASE_KEY must be present (set by markPaymentInitiated on Pay Now click).
 *  - detectCashfreeReturn() must confirm a successful return.
 */
export function checkAndFirePurchase(): void {
  try {
    // Guard 1: already fired this session
    if (sessionStorage.getItem(SS_PURCHASE_FIRED)) return;

    // Guard 2: user must have clicked Pay Now first
    if (!sessionStorage.getItem(SS_PURCHASE_KEY)) return;

    const { detected, orderId } = detectCashfreeReturn();
    if (!detected) return;

    // Retrieve the eventId stored when markPaymentInitiated() was called
    const eventId = sessionStorage.getItem(SS_PURCHASE_EVT_ID) ?? undefined;

    // Mark as fired before the fbq call so a re-render can never double-fire
    sessionStorage.setItem(SS_PURCHASE_FIRED, "1");
    sessionStorage.removeItem(SS_PURCHASE_KEY);
    sessionStorage.removeItem(SS_PURCHASE_EVT_ID);

    // ── localStorage dedup guard (order-based, cross-session) ───────────────
    // Primary key uses orderId from Cashfree return URL (ORD-XXXXXXXX format).
    // Falls back to eventId key if no orderId in URL.
    // Stored value includes eventId for future CAPI matching.
    const dedupKey = orderId
      ? `px_purch_order_${orderId}`   // primary — matches server orderId
      : eventId
        ? `px_purch_${eventId}`       // fallback — per-session event key
        : null;

    if (dedupKey) {
      try {
        if (localStorage.getItem(dedupKey)) {
          // Already tracked in a previous session — clean up sessionStorage flags
          sessionStorage.removeItem(SS_PURCHASE_KEY);
          sessionStorage.removeItem(SS_PURCHASE_EVT_ID);
          return;
        }
        // Store eventId alongside so CAPI can retrieve & match it later
        localStorage.setItem(dedupKey, JSON.stringify({ eventId: eventId ?? null, fired: Date.now() }));
      } catch { /* proceed if localStorage blocked */ }
    }

    fbq(
      "track",
      "Purchase",
      {
        content_name:  "KamaSutra Gold+",
        content_ids:   ["kamasutra-gold-plus"],
        content_type:  "product",
        currency:      "INR",
        value:         999,
        ...(orderId ? { order_id: orderId } : {}),
        // ↑ custom data only — eventID must NOT be here (Meta ignores it for dedup)
      },
      eventId, // ← 4th arg: deduplication key — Meta matches this with CAPI event_id
    );

    console.log("[Pixel] Purchase event fired",
      orderId  ? `order_id=${orderId}` : "(no order_id in URL)",
      eventId  ? `eventID=${eventId}`  : "(no eventID)",
    );
  } catch {
    // Pixel errors must never affect the page
  }
}

export { PIXEL_ID };
