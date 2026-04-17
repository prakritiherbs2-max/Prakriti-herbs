import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "fallback_secret_change_me";

export type AdminRole = "super_admin" | "order_manager" | "view_only";

export interface AdminPayload {
  username: string;
  role: AdminRole;
  pwv: number;   // password version — used for session invalidation
  iat: number;
  exp: number;
}

/* ── Revocation time (module-level cache) ──────────────────────────────────── */
/* All tokens issued BEFORE this Unix-seconds timestamp are invalid.            */
/* Loaded from DB at startup and updated on every password change.              */
let _revocationTime = 0;

export function setRevocationTime(t: number): void { _revocationTime = t; }
export function getRevocationTime(): number { return _revocationTime; }

/* ── Token verification helper ─────────────────────────────────────────────── */
function verifyToken(authHeader: string | undefined): AdminPayload | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as AdminPayload;
    /* Reject tokens that pre-date the last password change */
    if ((payload.iat ?? 0) < _revocationTime) return null;
    return payload;
  } catch { return null; }
}

/* ── Middleware ────────────────────────────────────────────────────────────── */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(req.headers["authorization"]);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized — please log in again" });
    return;
  }
  (req as Request & { admin: AdminPayload }).admin = payload;
  next();
}

export function requireOrderManager(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(req.headers["authorization"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role === "view_only") { res.status(403).json({ error: "View-only accounts cannot perform this action" }); return; }
  (req as Request & { admin: AdminPayload }).admin = payload;
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(req.headers["authorization"]);
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (payload.role !== "super_admin") { res.status(403).json({ error: "Super admin access required" }); return; }
  (req as Request & { admin: AdminPayload }).admin = payload;
  next();
}

export function signAdminToken(username: string, role: AdminRole = "super_admin", pwv = 0): string {
  return jwt.sign({ username, role, pwv }, JWT_SECRET, { expiresIn: "24h" });
}
