import { generateEventId } from "./pixel";
import { getAgencySource, getVisitorSource, getLandingPageUrl } from "./visitorTracking";

const API_BASE = "/api";

function detectDevice(ua: string): string {
  if (/iPad|tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua: string): string {
  if (/SamsungBrowser/i.test(ua)) return "Samsung";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Edg/i.test(ua)) return "Edge";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Other";
}

/**
 * Track a Call Now button click — internal CRM only.
 * NO Facebook pixel event is fired. Facebook should only see
 * real Purchase events from confirmed COD/payment orders.
 */
export function trackCall(): void {
  try {
    const eventId = generateEventId();
    const source = getAgencySource() || getVisitorSource() || "direct";
    const ua = navigator.userAgent;

    void fetch(`${API_BASE}/lead-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        type: "call",
        source,
        callStatus: "clicked",
        pageUrl: window.location.href,
        landingPage: getLandingPageUrl() ?? window.location.href,
        referrer: document.referrer || undefined,
        deviceType: detectDevice(ua),
        browser: detectBrowser(ua),
        userAgent: ua,
      }),
    });
  } catch {
    // tracking must never break UX
  }
}

/**
 * Track a WhatsApp button click — internal CRM only.
 * NO Facebook pixel event is fired. Facebook should only see
 * real Purchase events from confirmed COD/payment orders.
 */
export function trackWhatsApp(): void {
  try {
    const eventId = generateEventId();
    const source = getAgencySource() || getVisitorSource() || "direct";
    const ua = navigator.userAgent;

    void fetch(`${API_BASE}/lead-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        type: "whatsapp",
        source,
        callStatus: "clicked",
        pageUrl: window.location.href,
        landingPage: getLandingPageUrl() ?? window.location.href,
        referrer: document.referrer || undefined,
        deviceType: detectDevice(ua),
        browser: detectBrowser(ua),
        userAgent: ua,
      }),
    });
  } catch {
    // tracking must never break UX
  }
}
