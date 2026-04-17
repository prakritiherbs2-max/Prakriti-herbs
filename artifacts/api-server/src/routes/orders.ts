import { Router, type IRouter, type Request } from "express";
import { db, ordersTable } from "@workspace/db";
import { CreateOrderBody } from "@workspace/api-zod";
import { nanoid } from "nanoid";
import { sendCapiToAllAgencies } from "../lib/metaCapi.js";

/**
 * Resolve the real client IP from the request, preferring IPv6.
 *
 * Priority order:
 *  1. CF-Connecting-IP (Cloudflare)
 *  2. X-Real-IP (nginx / most proxies)
 *  3. First entry in X-Forwarded-For (leftmost = original client)
 *  4. req.ip (Express with trust proxy enabled)
 *  5. socket.remoteAddress fallback
 *
 * IPv4-mapped IPv6 addresses (::ffff:x.x.x.x) are preserved as-is —
 * Facebook CAPI accepts both formats; stripping the prefix loses info.
 */
function resolveClientIp(req: Request): string | undefined {
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

const router: IRouter = Router();

/* ── Simple in-memory IP rate limiter ─────────────────────────────
 * Allows at most MAX_ORDERS_PER_WINDOW per IP within WINDOW_MS.
 * Intentionally lenient (not a hard security boundary) — its primary
 * purpose is to stop naive bots that submit the form in a tight loop.
 * The Map is bounded: entries are pruned after each request.
 */
const WINDOW_MS           = 15 * 60 * 1000;   // 15 minutes
const MAX_ORDERS_PER_WINDOW = 5;
const ipOrderLog = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const rec  = ipOrderLog.get(ip);

  if (!rec || now - rec.windowStart > WINDOW_MS) {
    ipOrderLog.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (rec.count >= MAX_ORDERS_PER_WINDOW) return true;
  rec.count++;
  return false;
}

router.post("/orders", async (req, res) => {
  /* ── Honeypot: bots fill _wurl; real browsers leave it empty ── */
  const raw = req.body as Record<string, unknown>;
  if (raw._wurl && String(raw._wurl).trim().length > 0) {
    // Silently pretend success — don't reveal the trap
    res.status(201).json({ id: 0, orderId: "ORD-BOT", message: "Order placed." });
    return;
  }

  /* ── IP rate limiting ── */
  const clientIp = resolveClientIp(req) ?? "unknown";
  if (isRateLimited(clientIp)) {
    res.status(429).json({ error: "Too many requests. Please try again later." });
    return;
  }

  const parseResult = CreateOrderBody.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request data" });
    return;
  }

  const { name, phone, address, pincode, quantity, product } = parseResult.data;
  const body = req.body as {
    email?: string;
    source?: string;
    visitorSource?: string;
    landingPageUrl?: string;
    eventId?: string;
    fbp?: string;
    fbc?: string;
    userAgent?: string;
    city?: string;
    state?: string;
    amount?: number;
    website?: string;
    domain?: string;
    _wurl?: string;
  };
  const source = body.source?.trim().toLowerCase() || "direct";
  const visitorSource = body.visitorSource ?? "Direct";
  const landingPageUrl = typeof body.landingPageUrl === "string" && body.landingPageUrl.trim() ? body.landingPageUrl.trim() : null;
  const city = typeof body.city === "string" ? body.city.trim() || null : null;
  const state = typeof body.state === "string" ? body.state.trim() || null : null;
  /* Email is stored locally only — NEVER forwarded to CRM or Meta CAPI */
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase() : null;
  const orderId = `ORD-${nanoid(8).toUpperCase()}`;

  try {
    const [order] = await db
      .insert(ordersTable)
      .values({
        orderId,
        name,
        phone,
        email,
        address,
        pincode,
        city,
        state,
        quantity,
        product,
        source,
        visitorSource,
        landingPageUrl,
        eventId: body.eventId ?? null,
        website: body.website?.trim() || null,
        domain: body.domain?.trim() || null,
        status: "Pending COD Confirmation",
      })
      .returning();

    // Fire server-side CAPI Purchase event to ALL active agency pixels simultaneously
    // (fire-and-forget — never blocks response)
    sendCapiToAllAgencies({
      eventName:  "Purchase",
      eventId:    body.eventId,
      phone,
      name,
      city:       city ?? undefined,
      state:      state ?? undefined,
      pincode:    pincode ?? undefined,
      ipAddress:  resolveClientIp(req),
      userAgent:  body.userAgent ?? (req.headers["user-agent"] as string | undefined),
      fbp:        body.fbp,
      fbc:        body.fbc,
      customData: {
        order_id: orderId,
        num_items: quantity,
        ...(body.amount ? { value: body.amount } : {}),
      },
    }, source).catch((err) => {
      req.log.warn({ err }, "[CAPI] Purchase event failed (non-blocking)");
    });

    res.status(201).json({
      id: order.id,
      orderId: order.orderId,
      message: `Thank you ${name}! Your order has been placed successfully. Order ID: ${orderId}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to place order. Please try again." });
  }
});

export default router;
