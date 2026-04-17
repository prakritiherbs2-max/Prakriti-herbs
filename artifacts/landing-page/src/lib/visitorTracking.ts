/* Visitor source detection + live ping beacon */

export type VisitorSource = "Facebook" | "Instagram" | "WhatsApp" | "Direct";

/* ─────────────────────────────────────────────────────────────────
 * Agency Source Tracking  (?source=taj → "taj")
 *
 * Priority:
 *  1. URL param ?source=  — ALWAYS wins; overwrites any stored value
 *  2. localStorage "_pk_asrc"  — survives page navigation / refreshes
 *  3. "" (empty)  — no agency attributed
 *
 * Call getAgencySource() anywhere on the frontend. It is safe to call
 * multiple times — it reads once and caches within the session.
 * ───────────────────────────────────────────────────────────────── */
const AGENCY_SRC_KEY = "_pk_asrc";

export function getAgencySource(): string {
  if (typeof window === "undefined") return "";

  // Priority 1: URL param is present → always overwrite stored value
  const urlParam = new URLSearchParams(window.location.search).get("source");
  if (urlParam && urlParam.trim()) {
    const src = urlParam.trim().toLowerCase();
    try { localStorage.setItem(AGENCY_SRC_KEY, src); } catch { /* private mode */ }
    return src;
  }

  // Priority 2: Persisted from a previous page load that had ?source=
  try {
    const stored = localStorage.getItem(AGENCY_SRC_KEY);
    if (stored) return stored;
  } catch { /* private mode */ }

  return "";
}

/** Call after a successful order submission to clear the agency attribution */
export function clearAgencySource(): void {
  try { localStorage.removeItem(AGENCY_SRC_KEY); } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────────────────────────
 * Landing Page URL Capture
 *
 * Captures the FIRST URL the visitor lands on (full href including
 * query string). If a ?source= param is present in the URL, the
 * landing URL is always overwritten so a new agency link always
 * records the correct attribution URL.
 *
 * Stored in localStorage "_pk_lpurl" — survives page navigation.
 * Cleared after order is placed.
 * ───────────────────────────────────────────────────────────────── */
const LANDING_URL_KEY = "_pk_lpurl";

export function captureLandingUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const currentUrl = window.location.href;
    const hasSource = new URLSearchParams(window.location.search).has("source");
    // Always overwrite when ?source= is present (new agency link clicked)
    // Otherwise only set if not already captured (preserve true landing page)
    if (hasSource || !localStorage.getItem(LANDING_URL_KEY)) {
      localStorage.setItem(LANDING_URL_KEY, currentUrl);
    }
  } catch { /* private mode */ }
}

export function getLandingPageUrl(): string {
  try { return localStorage.getItem(LANDING_URL_KEY) ?? ""; } catch { return ""; }
}

export function clearLandingPageUrl(): void {
  try { localStorage.removeItem(LANDING_URL_KEY); } catch { /* ignore */ }
}

function detectSource(): VisitorSource {
  if (typeof window === "undefined") return "Direct";
  const params = new URLSearchParams(window.location.search);
  const utm = params.get("utm_source")?.toLowerCase() ?? "";
  const ref = params.get("ref")?.toLowerCase() ?? "";
  const fbclid = params.get("fbclid");
  const igshid = params.get("igshid");
  const gclid = params.get("gclid");
  const referrer = document.referrer.toLowerCase();

  if (fbclid || utm.includes("facebook") || utm === "fb" || ref === "fb" || referrer.includes("facebook.com") || referrer.includes("fb.com")) return "Facebook";
  if (igshid || utm.includes("instagram") || utm === "ig" || ref === "ig" || referrer.includes("instagram.com")) return "Instagram";
  if (utm.includes("whatsapp") || utm === "wa" || ref === "wa" || referrer.includes("wa.me") || referrer.includes("whatsapp.com")) return "WhatsApp";
  if (gclid) return "Direct"; // Google Ads → Direct (not a social source)
  return "Direct";
}

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem("_pk_sid");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem("_pk_sid", id);
  }
  return id;
}

export function getVisitorSource(): VisitorSource {
  const stored = sessionStorage.getItem("_pk_src");
  if (stored) return stored as VisitorSource;
  const detected = detectSource();
  sessionStorage.setItem("_pk_src", detected);
  return detected;
}

let pingInterval: ReturnType<typeof setInterval> | null = null;

export function startVisitorPing(): void {
  if (pingInterval) return; // already running
  const source = getVisitorSource();
  const sessionId = getOrCreateSessionId();

  const ping = () => {
    fetch("/api/track/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, source }),
      keepalive: true,
    }).catch(() => {});
  };

  ping(); // immediate ping on load
  pingInterval = setInterval(ping, 30_000); // then every 30 s
}

export function stopVisitorPing(): void {
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
}
