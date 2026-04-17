/**
 * Dynamic Agency Pixel Initialization
 *
 * When a visitor arrives via ?source=taj (or any agency source), we fetch the
 * agency's Facebook Pixel ID and initialise it browser-side via fbq('init').
 *
 * How Meta Multiple Pixels work:
 *   fbq('init', 'PIXEL_A');   ← main pixel (already done in index.html)
 *   fbq('init', 'PIXEL_B');   ← agency pixel (done here, dynamically)
 *   fbq('track', 'PageView'); ← fires to BOTH PIXEL_A and PIXEL_B simultaneously
 *
 * This gives us true "Double Pixel Tagging":
 *   - Every PageView + Purchase event goes to Mandeep's main pixel AND Sartaj's pixel.
 *   - Server-side CAPI also fires to both (see metaCapi.ts sendCapiToAllAgencies).
 *   - Result: full funnel data in both ad accounts, deduped via event_id.
 */

const INIT_FLAG_PREFIX = "_pk_apx_";

/** Returns fbq function or null if Meta Pixel is not loaded */
function getFbq(): ((...args: unknown[]) => void) | null {
  const fn = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  return typeof fn === "function" ? fn : null;
}

/**
 * Fetch the pixel ID for the given agency source from the public API,
 * then initialise it browser-side. Fires an additional PageView to
 * the agency pixel so their ad account sees the visit.
 *
 * - Safe to call multiple times — idempotent via sessionStorage flag.
 * - Never throws — pixel errors must never break the order flow.
 */
export async function initAgencyPixelIfNeeded(source: string): Promise<void> {
  if (!source) return;

  const flagKey = `${INIT_FLAG_PREFIX}${source}`;
  try {
    if (sessionStorage.getItem(flagKey)) return;
  } catch { /* private mode — proceed */ }

  try {
    const res = await fetch(
      `/api/public/agency-pixel?source=${encodeURIComponent(source)}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return;

    const data = (await res.json()) as { pixelId: string | null };
    if (!data.pixelId) return;

    const fbq = getFbq();
    if (!fbq) return;

    fbq("init", data.pixelId);
    fbq("track", "PageView");

    try { sessionStorage.setItem(flagKey, "1"); } catch { /* ignore */ }

    console.log(`[Pixel] Agency pixel ${data.pixelId} initialised for source: ${source}`);
  } catch {
    /* Never block order flow on pixel failure */
  }
}

/**
 * Re-initialise the agency pixel for a Cashfree-return Purchase event.
 *
 * Problem: When a user returns from Cashfree (full page reload), the
 * sessionStorage flag from the first visit causes initAgencyPixelIfNeeded
 * to skip re-init.  That means checkAndFirePurchase() fires to the main
 * pixel only — the agency pixel misses the Purchase conversion.
 *
 * This function bypasses the flag and re-calls fbq('init') WITHOUT firing
 * an extra PageView, ensuring the agency pixel is registered before
 * checkAndFirePurchase() runs.
 *
 * - Only called from PurchaseReturnDetector in App.tsx.
 * - Awaited before checkAndFirePurchase so the pixel is ready.
 * - Never throws.
 */
export async function reinitAgencyPixelForPurchase(source: string): Promise<void> {
  if (!source) return;
  try {
    const res = await fetch(
      `/api/public/agency-pixel?source=${encodeURIComponent(source)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return;

    const data = (await res.json()) as { pixelId: string | null };
    if (!data.pixelId) return;

    const fbq = getFbq();
    if (!fbq) return;

    fbq("init", data.pixelId); // re-init only — no PageView
    console.log(`[Pixel] Agency pixel ${data.pixelId} re-initialised for Cashfree Purchase (source: ${source})`);
  } catch {
    /* ignore — never block purchase tracking */
  }
}
