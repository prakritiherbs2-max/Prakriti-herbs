/**
 * WhatsApp URL utility
 *
 * Problem: On Android, if WhatsApp Business is installed, it intercepts
 * wa.me links AND api.whatsapp.com links, showing "Can't open link with
 * WhatsApp Business" because the destination number may not be a WA Business number.
 *
 * Solution:
 * - Android → Android Intent URL targeting package=com.whatsapp (Messenger)
 *   This bypasses WhatsApp Business (com.whatsapp.w4b) entirely.
 * - iOS / Desktop → Standard wa.me deep link (works reliably on Apple devices)
 */

const WA_NUMBER = "918968122246";

function isAndroid(): boolean {
  return /android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
}

/**
 * Build a WhatsApp URL that opens directly in WhatsApp Messenger.
 * Pass `text` as a plain (not encoded) string — encoding is handled here.
 */
export function buildWhatsAppUrl(text: string): string {
  const encoded = encodeURIComponent(text);
  if (isAndroid()) {
    // Android Intent URI — targets com.whatsapp (Messenger) not com.whatsapp.w4b (Business)
    return `intent://send?phone=${WA_NUMBER}&text=${encoded}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
  }
  // iOS, desktop, etc.
  return `https://wa.me/${WA_NUMBER}?text=${encoded}`;
}

/** The default greeting URL (no order text) */
export function buildWhatsAppGreeting(): string {
  return buildWhatsAppUrl("Namaste, I want more information about Kamasutra Gold +");
}

/** Open WhatsApp in a new tab / app window */
export function openWhatsApp(text: string): void {
  const url = buildWhatsAppUrl(text);
  if (isAndroid()) {
    // Intent URLs must use location.href on Android — window.open won't work
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Plain link for <a href> — greeting only (no order details) */
export const WA_HREF_GREETING = (() => {
  const encoded = encodeURIComponent("Namaste, I want more information about Kamasutra Gold +");
  // We can't detect Android at module load on SSR, so use api.whatsapp.com as <a href> fallback
  // The dynamic openWhatsApp() function handles Android intent routing at click-time
  return `https://api.whatsapp.com/send/?phone=${WA_NUMBER}&text=${encoded}&type=phone_number&app_absent=0`;
})();
