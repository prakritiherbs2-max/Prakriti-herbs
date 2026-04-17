import { Router, type IRouter } from "express";
import { db, pool, ordersTable, adminDownloadsTable, abandonedCartsTable, appSettingsTable } from "@workspace/db";
import { eq, desc, like, and, gte, lte, sql, or, inArray, isNull, isNotNull } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin, signAdminToken, type AdminRole } from "../middlewares/requireAdmin";
import { getSettings, saveSettingsBatch, getSetting } from "./settings";
import crypto from "crypto";
import { sendDailySummary } from "../lib/emailCron";

const router: IRouter = Router();

const ADMIN_USERNAME = process.env["ADMIN_USERNAME"] ?? "admin";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "Admin@2026";

interface StaffUser { id: string; username: string; passwordHash: string; role: AdminRole; createdAt: string; }

function hashPassword(pw: string): string {
  return crypto.createHash("sha256").update(pw + "prakriti_salt_2026").digest("hex");
}

async function getStaffUsers(): Promise<StaffUser[]> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "staff_users"));
    if (!row) return [];
    return JSON.parse(row.value) as StaffUser[];
  } catch { return []; }
}

async function saveStaffUsers(users: StaffUser[]): Promise<void> {
  await saveSettingsBatch({ staff_users: JSON.stringify(users) });
}

/* ─── Auth ─── */
router.post("/admin/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  /* Current password version (for session-kill support) */
  let pwv = 0;
  try {
    const v = await getSetting("admin_password_version");
    pwv = v ? parseInt(v, 10) : 0;
  } catch { /* ignore */ }

  /* Super admin check: prefer DB-stored hash, fall back to env var */
  if (username === ADMIN_USERNAME) {
    const storedHash = await getSetting("admin_password_hash").catch(() => null);
    const inputHash = hashPassword(password ?? "");
    const validByHash = storedHash ? storedHash === inputHash : false;
    const validByEnv = !storedHash && password === ADMIN_PASSWORD;
    if (validByHash || validByEnv) {
      res.json({ token: signAdminToken(username, "super_admin", pwv), username, role: "super_admin" });
      return;
    }
  }

  /* Staff user check (stored in app_settings) */
  try {
    const staffUsers = await getStaffUsers();
    const hash = hashPassword(password ?? "");
    const found = staffUsers.find((u) => u.username === username && u.passwordHash === hash);
    if (found) {
      res.json({ token: signAdminToken(found.username, found.role, pwv), username: found.username, role: found.role });
      return;
    }
  } catch { /* ignore lookup errors */ }

  res.status(401).json({ error: "Invalid credentials" });
});

/* ─── Staff Management ─── */
router.get("/admin/staff", requireSuperAdmin, async (_req, res) => {
  try {
    const users = await getStaffUsers();
    res.json({ staff: users.map(({ id, username, role, createdAt }) => ({ id, username, role, createdAt })) });
  } catch { res.status(500).json({ error: "Failed to load staff" }); }
});

router.post("/admin/staff", requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };
    if (!username || !password || !role) { res.status(400).json({ error: "username, password and role are required" }); return; }
    if (!["order_manager", "view_only"].includes(role)) { res.status(400).json({ error: "role must be order_manager or view_only" }); return; }
    if (username === ADMIN_USERNAME) { res.status(400).json({ error: "Username already taken" }); return; }

    const users = await getStaffUsers();
    if (users.find((u) => u.username === username)) { res.status(400).json({ error: "Username already taken" }); return; }

    const newUser: StaffUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
      role: role as AdminRole,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await saveStaffUsers(users);
    res.status(201).json({ staff: { id: newUser.id, username: newUser.username, role: newUser.role, createdAt: newUser.createdAt } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to create staff user" }); }
});

router.delete("/admin/staff/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const users = await getStaffUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) { res.status(404).json({ error: "Staff user not found" }); return; }
    await saveStaffUsers(filtered);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Failed to delete staff user" }); }
});

/* ─── Orders: distinct sources list ─── */
router.get("/admin/orders/distinct-sources", requireAdmin, async (req, res) => {
  try {
    const rows = await pool.query<{ source: string }>(
      `SELECT DISTINCT source FROM orders WHERE deleted_at IS NULL AND source IS NOT NULL ORDER BY source`,
    );
    res.json({ sources: rows.rows.map((r) => r.source) });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sources");
    res.status(500).json({ error: "Failed" });
  }
});

/* ─── Orders: bulk cleanup (soft-delete orders older than N days) ─── */
router.delete("/admin/orders/cleanup", requireAdmin, async (req, res) => {
  const { days = "90", confirm } = req.query as Record<string, string>;
  if (confirm !== "true") { res.status(400).json({ error: "Pass confirm=true to proceed" }); return; }
  const daysNum = Math.max(1, parseInt(days, 10) || 90);
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);
    const result = await pool.query<{ id: number }>(
      `UPDATE orders SET deleted_at = NOW() WHERE deleted_at IS NULL AND created_at < $1 RETURNING id`,
      [cutoff],
    );
    res.json({ deleted: result.rowCount ?? 0, cutoffDate: cutoff.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Orders cleanup failed");
    res.status(500).json({ error: "Cleanup failed" });
  }
});

/* ─── Orders ─── */
router.get("/admin/orders", requireAdmin, async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, website, source, page = "1", limit = "50" } = req.query as Record<string, string>;
    // Always exclude soft-deleted (trashed) orders
    const conditions = [isNull(ordersTable.deletedAt)];
    if (search) conditions.push(or(like(ordersTable.name, `%${search}%`), like(ordersTable.phone, `%${search}%`), like(ordersTable.address, `%${search}%`)));
    if (status && status !== "all") conditions.push(eq(ordersTable.status, status));
    if (website && website !== "all") conditions.push(eq(ordersTable.website, website.toUpperCase()));
    if (source && source !== "all") conditions.push(eq(ordersTable.source, source.toLowerCase()));
    if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); conditions.push(lte(ordersTable.createdAt, end)); }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const where = and(...conditions);

    const [orders, countResult] = await Promise.all([
      db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset((pageNum - 1) * limitNum),
      db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable).where(where),
    ]);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [statsResult] = await db.select({
      total: sql<number>`COUNT(*)`,
      todayCount: sql<number>`COUNT(*) FILTER (WHERE created_at >= ${todayStart})`,
      newCount: sql<number>`COUNT(*) FILTER (WHERE status = 'New')`,
      confirmedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Confirmed')`,
      shippedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Shipped')`,
      cancelledCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Cancelled')`,
      deliveredCount: sql<number>`COUNT(*) FILTER (WHERE status = 'Delivered')`,
    }).from(ordersTable).where(isNull(ordersTable.deletedAt));

    const phoneList = [...new Set(orders.map((o) => o.phone))];
    let repeatPhones = new Set<string>();
    if (phoneList.length > 0) {
      /* Use pool.query with IN ($1,$2,...) to avoid Drizzle inArray ANY() bug */
      const placeholders = phoneList.map((_, i) => `$${i + 1}`).join(", ");
      const rep = await pool.query<{ phone: string }>(
        `SELECT phone FROM orders WHERE phone IN (${placeholders}) GROUP BY phone HAVING COUNT(*) > 1`,
        phoneList
      );
      rep.rows.forEach((r) => repeatPhones.add(r.phone));
    }

    const enrichedOrders = orders.map((o) => ({ ...o, isRepeat: repeatPhones.has(o.phone) }));

    res.json({
      orders: enrichedOrders,
      total: Number(countResult[0]?.count ?? 0), page: pageNum, limit: limitNum,
      stats: {
        total: Number(statsResult?.total ?? 0), today: Number(statsResult?.todayCount ?? 0),
        new: Number(statsResult?.newCount ?? 0), confirmed: Number(statsResult?.confirmedCount ?? 0),
        shipped: Number(statsResult?.shippedCount ?? 0), cancelled: Number(statsResult?.cancelledCount ?? 0),
        delivered: Number(statsResult?.deliveredCount ?? 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin orders");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// ── Full order edit ────────────────────────────────────────────────────────────
router.patch("/admin/orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = req.body as {
      name?: string; phone?: string; email?: string;
      address?: string; city?: string; state?: string; pincode?: string;
      status?: string; trackingId?: string; courier?: string;
    };
    const validStatuses = ["New", "Confirmed", "Shipped", "Cancelled", "Delivered"];
    if (body.status && !validStatuses.includes(body.status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    const updates: Record<string, unknown> = {};
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.phone?.trim()) updates.phone = body.phone.replace(/\D/g, "").slice(-10);
    if (body.email !== undefined) updates.email = body.email.trim() || null;
    if (body.address?.trim()) updates.address = body.address.trim();
    if (body.city !== undefined) updates.city = body.city.trim() || null;
    if (body.state !== undefined) updates.state = body.state.trim() || null;
    if (body.pincode?.trim()) updates.pincode = body.pincode.trim();
    if (body.status) updates.status = body.status;
    if (body.trackingId !== undefined) updates.trackingId = body.trackingId.trim() || null;
    if (body.courier !== undefined) updates.courier = body.courier.trim() || null;
    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Order not found" }); return; }
    res.json({ ok: true, order: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to edit order");
    res.status(500).json({ error: "Edit failed" });
  }
});

router.patch("/admin/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const validStatuses = ["New", "Confirmed", "Shipped", "Cancelled", "Delivered"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [updated] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Order not found" }); return; }

    if (status === "Confirmed") void sendWhatsAppOrderConfirmed(updated);
    res.json({ order: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.post("/admin/orders/bulk-status", requireAdmin, async (req, res) => {
  try {
    const { ids, status } = req.body as { ids?: number[]; status?: string };
    const validStatuses = ["New", "Confirmed", "Shipped", "Cancelled", "Delivered"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    if (!ids || !Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "ids required" }); return; }
    const updated = await db.update(ordersTable).set({ status }).where(inArray(ordersTable.id, ids)).returning({ id: ordersTable.id });
    res.json({ updated: updated.length, status });
  } catch (err) {
    req.log.error({ err }, "Bulk status failed");
    res.status(500).json({ error: "Bulk update failed" });
  }
});

/* ─── Delete Audit Log ─── */
interface DeleteAuditEntry {
  id: string; entityType: "order" | "abandoned_cart";
  entityId: number; entityRef: string; deletedBy: string; deletedAt: string;
}

async function appendDeleteAudit(entries: Omit<DeleteAuditEntry, "id">[]): Promise<void> {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "delete_audit_log"));
    const existing: DeleteAuditEntry[] = row ? JSON.parse(row.value) as DeleteAuditEntry[] : [];
    const merged = [...entries.map((e) => ({ ...e, id: crypto.randomUUID() })), ...existing].slice(0, 500);
    await saveSettingsBatch({ delete_audit_log: JSON.stringify(merged) });
  } catch (err) { console.error("[AUDIT] Failed to save audit log:", err); }
}

router.get("/admin/delete-audit-log", requireSuperAdmin, async (_req, res) => {
  try {
    const [row] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "delete_audit_log"));
    const entries: DeleteAuditEntry[] = row ? JSON.parse(row.value) as DeleteAuditEntry[] : [];
    return res.json({ entries });
  } catch { return res.status(500).json({ error: "Failed to fetch audit log" }); }
});

/* ─── Order Delete = Soft Delete → Move to Trash (Super Admin only) ─── */
router.delete("/admin/orders/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), isNull(ordersTable.deletedAt)));
    if (!order) return res.status(404).json({ error: "Order not found" });
    await pool.query(`UPDATE orders SET deleted_at = NOW() WHERE id = $1`, [id]);
    return res.json({ ok: true, trashed: true });
  } catch { return res.status(500).json({ error: "Move to trash failed" }); }
});

router.post("/admin/orders/bulk-delete", requireSuperAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
    const { rows } = await pool.query<{ id: number }>(
      `UPDATE orders SET deleted_at = NOW() WHERE id = ANY($1) AND deleted_at IS NULL RETURNING id`, [ids]
    );
    return res.json({ deleted: rows.length });
  } catch { return res.status(500).json({ error: "Bulk move to trash failed" }); }
});

/* ─── Trash Management (Super Admin only) ─── */

/** GET /admin/orders/trash — list all soft-deleted orders */
router.get("/admin/orders/trash", requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query<{
      id: number; order_id: string; name: string; phone: string; address: string;
      pincode: string; city: string | null; state: string | null;
      quantity: number; product: string; source: string; status: string;
      payment_method: string | null; payment_status: string | null;
      visitor_source: string | null; created_at: Date; deleted_at: Date;
    }>(
      `SELECT id, order_id, name, phone, address, pincode, city, state,
              quantity, product, source, status, payment_method, payment_status,
              visitor_source, created_at, deleted_at
       FROM orders
       WHERE deleted_at IS NOT NULL
       ORDER BY deleted_at DESC`
    );
    res.json({ orders: rows, total: rows.length });
  } catch { res.status(500).json({ error: "Failed to fetch trash" }); }
});

/** POST /admin/orders/trash/restore — restore selected orders from trash */
router.post("/admin/orders/trash/restore", requireSuperAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
    const { rows } = await pool.query<{ id: number }>(
      `UPDATE orders SET deleted_at = NULL WHERE id = ANY($1) AND deleted_at IS NOT NULL RETURNING id`, [ids]
    );
    return res.json({ restored: rows.length });
  } catch { return res.status(500).json({ error: "Restore failed" }); }
});

/** DELETE /admin/orders/trash/empty — permanently delete all trashed orders */
router.delete("/admin/orders/trash/empty", requireSuperAdmin, async (req, res) => {
  try {
    const actor = ((req as unknown) as { admin: { username: string } }).admin.username;
    const { rows } = await pool.query<{ id: number; order_id: string; name: string; phone: string }>(
      `DELETE FROM orders WHERE deleted_at IS NOT NULL RETURNING id, order_id, name, phone`
    );
    if (rows.length > 0) {
      const now = new Date().toISOString();
      await appendDeleteAudit(rows.map((o) => ({
        entityType: "order" as const, entityId: o.id,
        entityRef: `${o.order_id} — ${o.name} (${o.phone}) [TRASH_EMPTY]`,
        deletedBy: actor, deletedAt: now,
      })));
    }
    return res.json({ deleted: rows.length });
  } catch { return res.status(500).json({ error: "Empty trash failed" }); }
});

/** DELETE /admin/orders/trash/:id — permanently delete a single trashed order */
router.delete("/admin/orders/trash/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const actor = ((req as unknown) as { admin: { username: string } }).admin.username;
    const { rows } = await pool.query<{ id: number; order_id: string; name: string; phone: string }>(
      `DELETE FROM orders WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, order_id, name, phone`, [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Trashed order not found" });
    await appendDeleteAudit([{
      entityType: "order", entityId: id,
      entityRef: `${rows[0]!.order_id} — ${rows[0]!.name} (${rows[0]!.phone}) [PERM_DELETE]`,
      deletedBy: actor, deletedAt: new Date().toISOString(),
    }]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Permanent delete failed" }); }
});

/* ─── Shiprocket ─── */
async function getShiprocketToken(): Promise<string> {
  const settings = await getSettings(["shiprocket_email", "shiprocket_password"]);
  const email = process.env["SHIPROCKET_EMAIL"] ?? settings["shiprocket_email"];
  const password = process.env["SHIPROCKET_PASSWORD"] ?? settings["shiprocket_password"];
  if (!email || !password) throw new Error("Shiprocket credentials not configured");

  const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Shiprocket login failed");
  const data = await res.json() as { token?: string; message?: string };
  if (!data.token) throw new Error(data.message ?? "Shiprocket login failed");
  return data.token;
}

router.post("/admin/orders/:id/ship-shiprocket", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const token = await getShiprocketToken();

    const istDate = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const dateObj = new Date(istDate);
    const orderDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

    const createRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        order_id: order.orderId,
        order_date: orderDate,
        pickup_location: "Primary",
        billing_customer_name: order.name,
        billing_last_name: "",
        billing_address: order.address,
        billing_city: "India",
        billing_pincode: order.pincode,
        billing_state: "India",
        billing_country: "India",
        billing_email: "customer@prakritiherbs.in",
        billing_phone: order.phone,
        shipping_is_billing: true,
        order_items: [{
          name: "KamaSutra Gold+ (Ayurvedic Supplement)",
          sku: "KSGOLD001",
          units: order.quantity,
          selling_price: 999,
          hsn: 3004,
        }],
        payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
        sub_total: 999 * order.quantity,
        length: 15, breadth: 12, height: 5, weight: 0.3,
      }),
    });

    const createData = await createRes.json() as { order_id?: number; shipment_id?: number; message?: string };
    if (!createRes.ok) throw new Error(createData.message ?? "Shiprocket order creation failed");

    const awbRes = await fetch("https://apiv2.shiprocket.in/v1/external/courier/generate/awb", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ shipment_id: createData.shipment_id }),
    });

    const awbData = await awbRes.json() as { response?: { data?: { awb_code?: string; courier_name?: string } } };
    const awb = awbData.response?.data?.awb_code ?? `SR-${order.orderId}`;
    const courierName = awbData.response?.data?.courier_name ?? "Shiprocket";

    await db.update(ordersTable).set({
      trackingId: awb,
      courier: courierName,
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ awb, courier: courierName, trackingUrl: `https://shiprocket.co/tracking/${awb}`, shiprocketOrderId: createData.order_id });
  } catch (err) {
    req.log.error({ err }, "Shiprocket error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Shiprocket failed" });
  }
});

router.post("/admin/orders/:id/ship-indiapost", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { trackingId } = req.body as { trackingId?: string };
    if (!trackingId) { res.status(400).json({ error: "trackingId required" }); return; }

    await db.update(ordersTable).set({
      trackingId,
      courier: "India Post",
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ trackingUrl: `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`, trackingId });
  } catch (err) {
    req.log.error({ err }, "India Post tracking failed");
    res.status(500).json({ error: "Failed to update tracking" });
  }
});

/* ─── Shadowfax ─── */
async function checkShadowfaxServiceability(clientId: string, token: string, pincode: string): Promise<{ serviceable: boolean; zone?: string }> {
  const url = `https://api.shadowfax.in/api/serviceability/?client_id=${encodeURIComponent(clientId)}&pincode=${encodeURIComponent(pincode)}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { "Authorization": `Token ${token}` } });
  if (!res.ok) return { serviceable: false };
  const data = await res.json() as { status?: boolean; results?: { serviceable?: boolean; zone?: string }[] };
  const first = data.results?.[0];
  return { serviceable: first?.serviceable ?? data.status ?? false, zone: first?.zone };
}

router.post("/admin/orders/:id/ship-shadowfax", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const settings = await getSettings([
      "shadowfax_client_id", "shadowfax_api_token", "shadowfax_store_id",
      "shadowfax_pickup_pincode", "shadowfax_pickup_address", "shadowfax_pickup_contact",
    ]);

    const clientId = process.env["SHADOWFAX_CLIENT_ID"] ?? settings["shadowfax_client_id"];
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    const storeId = process.env["SHADOWFAX_STORE_ID"] ?? settings["shadowfax_store_id"];

    if (!clientId || !apiToken) {
      res.status(503).json({ error: "Shadowfax credentials not configured. Add them in Settings → Shadowfax Integration." });
      return;
    }

    const serviceability = await checkShadowfaxServiceability(clientId, apiToken, order.pincode);
    if (!serviceability.serviceable) {
      res.status(422).json({
        error: `Pincode ${order.pincode} is NOT serviceable by Shadowfax.`,
        pincode: order.pincode,
        serviceable: false,
      });
      return;
    }

    const cleanPhone = order.phone.replace(/\D/g, "").slice(-10);
    const pickupContact = settings["shadowfax_pickup_contact"] ?? "8968122246";
    const pickupPincode = settings["shadowfax_pickup_pincode"] ?? "302001";
    const pickupAddress = settings["shadowfax_pickup_address"] ?? "Prakriti Herbs, Jaipur, Rajasthan";

    const createRes = await fetch("https://api.shadowfax.in/api/order/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${apiToken}`,
      },
      body: JSON.stringify({
        order_meta: {
          client_order_id: order.orderId,
          products: [{
            name: "KamaSutra Gold+ (Ayurvedic Supplement)",
            quantity: order.quantity,
            price: 999 * order.quantity,
          }],
        },
        deliver_details: {
          name: order.name,
          contact: cleanPhone,
          address: order.address,
          pincode: order.pincode,
          city: "",
        },
        pickup_details: {
          name: "Prakriti Herbs Pvt Ltd",
          contact: pickupContact,
          address: pickupAddress,
          pincode: pickupPincode,
        },
        payment_mode: order.paymentStatus === "success" ? "PREPAID" : "COD",
        cod_amount: order.paymentStatus === "success" ? 0 : 999 * order.quantity,
        weight: 300 * order.quantity,
        client_id: clientId,
        ...(storeId ? { store_id: storeId } : {}),
      }),
    });

    const createData = await createRes.json() as {
      tracking_id?: string; awb?: string; sfx_order_id?: string;
      message?: string; errors?: unknown; status?: string;
    };

    if (!createRes.ok || (!createData.tracking_id && !createData.awb)) {
      const errMsg = createData.message ?? JSON.stringify(createData.errors ?? createData);
      res.status(createRes.status).json({ error: `Shadowfax error: ${errMsg}` });
      return;
    }

    const awb = createData.tracking_id ?? createData.awb ?? `SFX-${order.orderId}`;
    const labelUrl = `https://api.shadowfax.in/api/order/label/?awb=${awb}&token=${apiToken}`;
    const trackingUrl = `https://shadowfax.in/track-your-order/?awb=${awb}`;

    await db.update(ordersTable).set({
      trackingId: awb,
      courier: "Shadowfax",
      status: "Shipped",
    }).where(eq(ordersTable.id, id));

    res.json({ awb, courier: "Shadowfax", trackingUrl, labelUrl, zone: serviceability.zone });
  } catch (err) {
    req.log.error({ err }, "Shadowfax error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Shadowfax shipping failed" });
  }
});

router.get("/admin/orders/:id/shadowfax-label", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [order] = await db.select({ trackingId: ordersTable.trackingId, courier: ordersTable.courier }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order?.trackingId || order.courier !== "Shadowfax") {
      res.status(404).json({ error: "No Shadowfax shipment found for this order" });
      return;
    }
    const settings = await getSettings(["shadowfax_api_token"]);
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    if (!apiToken) { res.status(503).json({ error: "Shadowfax token not configured" }); return; }
    const labelUrl = `https://api.shadowfax.in/api/order/label/?awb=${order.trackingId}&token=${apiToken}`;
    res.json({ labelUrl, awb: order.trackingId });
  } catch (err) {
    res.status(500).json({ error: "Failed to get label URL" });
  }
});

router.get("/admin/shadowfax/serviceability/:pincode", requireAdmin, async (req, res) => {
  try {
    const { pincode } = req.params;
    const settings = await getSettings(["shadowfax_client_id", "shadowfax_api_token"]);
    const clientId = process.env["SHADOWFAX_CLIENT_ID"] ?? settings["shadowfax_client_id"];
    const apiToken = process.env["SHADOWFAX_API_TOKEN"] ?? settings["shadowfax_api_token"];
    if (!clientId || !apiToken) { res.status(503).json({ error: "Shadowfax not configured" }); return; }
    const result = await checkShadowfaxServiceability(clientId, apiToken, pincode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Serviceability check failed" });
  }
});

/* ─── WhatsApp ─── */
async function sendWhatsAppMsg(phone: string, message: string): Promise<void> {
  const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key", "whatsapp_provider"]);
  const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
  const apiKey = process.env["WHATSAPP_API_KEY"] ?? settings["whatsapp_api_key"];
  if (!apiUrl || !apiKey) return;

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  const fullPhone = `91${cleanPhone}`;

  await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ phone: fullPhone, message, to: fullPhone }),
  });
}

async function sendWhatsAppOrderConfirmed(order: { name: string; phone: string; orderId: string; quantity: number }) {
  const settings = await getSettings(["whatsapp_template_order_confirmed"]);
  const template = settings["whatsapp_template_order_confirmed"]
    ?? `नमस्ते {{name}} जी! आपका KamaSutra Gold+ ऑर्डर Confirm हो गया है। Order ID: {{orderId}}। हम जल्द ही आपके पते पर भेज देंगे। - Prakriti Herbs`;

  const msg = template
    .replace(/\{\{name\}\}/g, order.name)
    .replace(/\{\{orderId\}\}/g, order.orderId)
    .replace(/\{\{quantity\}\}/g, String(order.quantity))
    .replace(/\{\{amount\}\}/g, String(999 * order.quantity));

  await sendWhatsAppMsg(order.phone, msg).catch(() => {});
}

router.post("/admin/orders/:id/whatsapp", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { message } = req.body as { message?: string };
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key"]);
    const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
    if (!apiUrl) {
      res.status(503).json({ error: "WhatsApp not configured. Add credentials in Settings." });
      return;
    }

    const msg = message ?? `नमस्ते ${order.name} जी! आपका ऑर्डर (#${order.orderId}) ${order.status} है। - Prakriti Herbs`;
    await sendWhatsAppMsg(order.phone, msg);
    res.json({ ok: true, phone: order.phone });
  } catch (err) {
    req.log.error({ err }, "WhatsApp failed");
    res.status(500).json({ error: "WhatsApp send failed" });
  }
});

router.post("/admin/abandoned-carts/:id/whatsapp", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [cart] = await db.select().from(abandonedCartsTable).where(eq(abandonedCartsTable.id, id)).limit(1);
    if (!cart) { res.status(404).json({ error: "Cart not found" }); return; }

    const settings = await getSettings(["whatsapp_api_url", "whatsapp_api_key", "whatsapp_template_abandoned_cart"]);
    const apiUrl = process.env["WHATSAPP_API_URL"] ?? settings["whatsapp_api_url"];
    if (!apiUrl) {
      res.status(503).json({ error: "WhatsApp not configured" });
      return;
    }

    const template = settings["whatsapp_template_abandoned_cart"]
      ?? `नमस्ते {{name}} जी! आपने KamaSutra Gold+ का ऑर्डर पूरा नहीं किया। अभी ₹999 में ऑर्डर करें और FREE डिलीवरी पाएं! prakritiherbs.in`;

    const msg = template.replace(/\{\{name\}\}/g, cart.name);
    await sendWhatsAppMsg(cart.phone, msg);
    await db.update(abandonedCartsTable).set({ recoveryStatus: "Called", updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Cart WhatsApp failed");
    res.status(500).json({ error: "WhatsApp send failed" });
  }
});

/* ─── Downloads ─── */
router.post("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const { filename, recordCount, filters } = req.body as { filename?: string; recordCount?: number; filters?: string };
    const [record] = await db.insert(adminDownloadsTable).values({
      downloadedBy: "admin",
      filename: filename ?? "orders_export.csv",
      recordCount: recordCount ?? 0,
      filters: filters ?? null,
    }).returning();
    res.status(201).json({ download: record });
  } catch { res.status(500).json({ error: "Failed to log download" }); }
});

router.get("/admin/downloads", requireAdmin, async (req, res) => {
  try {
    const downloads = await db.select().from(adminDownloadsTable).orderBy(desc(adminDownloadsTable.downloadedAt)).limit(200);
    res.json({ downloads });
  } catch { res.status(500).json({ error: "Failed to fetch downloads" }); }
});

router.delete("/admin/downloads/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    await db.delete(adminDownloadsTable).where(eq(adminDownloadsTable.id, id));
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Delete failed" }); }
});

/* ─── Abandoned Carts ─── */
async function sendAbandonedCartRecoveryEmail(name: string, email: string): Promise<void> {
  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  const smtpPort = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
  if (!smtpHost || !smtpUser || !smtpPass) return;

  const { default: nodemailer } = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtpHost, port: smtpPort, secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Prakriti Herbs" <contact@prakritiherbs.in>`,
    to: email,
    subject: "आपका ऑर्डर अधूरा रह गया — KamaSutra Gold+",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden">
        <div style="background:#1B5E20;padding:24px 32px;text-align:center">
          <h1 style="color:#C9A14A;margin:0;font-size:22px">Prakriti Herbs</h1>
          <p style="color:#fff;margin:4px 0 0;font-size:13px">prakritiherbs.in</p>
        </div>
        <div style="padding:28px 32px">
          <h2 style="color:#1B5E20;margin-top:0">नमस्ते ${name} जी! 🌿</h2>
          <p style="color:#333;line-height:1.7">आपने <strong>KamaSutra Gold+</strong> का ऑर्डर शुरू किया था, लेकिन पूरा नहीं हुआ।</p>
          <p style="color:#333;line-height:1.7">यह एक सीमित समय का ऑफर है — <strong style="color:#1B5E20">₹999</strong> में पाएं 100% Ayurvedic formula जो आपके वैवाहिक जीवन को बेहतर बनाए।</p>
          <div style="text-align:center;margin:28px 0">
            <a href="https://prakritiherbs.in/#order-form" style="background:linear-gradient(135deg,#C9A14A,#e8c96a);color:#1B5E20;text-decoration:none;font-weight:bold;padding:14px 36px;border-radius:10px;font-size:16px;display:inline-block">
              👉 अभी ऑर्डर पूरा करें
            </a>
          </div>
          <p style="color:#555;font-size:13px">✅ Cash on Delivery &nbsp;|&nbsp; 🚚 Free Delivery &nbsp;|&nbsp; 📦 Discreet Packaging</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="color:#888;font-size:12px">किसी भी सहायता के लिए: <a href="tel:+918968122246" style="color:#1B5E20">+91 89681 22246</a></p>
        </div>
      </div>`,
    text: `नमस्ते ${name} जी! आपने KamaSutra Gold+ का ऑर्डर अधूरा छोड़ा। अभी ₹999 में ऑर्डर करें: https://prakritiherbs.in/#order-form — Prakriti Herbs`,
  });
}

router.post("/abandoned-cart", async (req, res) => {
  try {
    const { name, phone, email, address, pincode, source, eventId } = req.body as { name?: string; phone?: string; email?: string; address?: string; pincode?: string; source?: string; eventId?: string };
    if (!name || !phone) { res.status(400).json({ error: "name and phone required" }); return; }
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const cleanEmail = typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
    const existing = await db.select({ id: abandonedCartsTable.id }).from(abandonedCartsTable).where(eq(abandonedCartsTable.phone, cleanPhone)).limit(1);
    if (existing.length > 0) {
      /* Update email if provided and not stored yet */
      if (cleanEmail) {
        await db.update(abandonedCartsTable).set({ email: cleanEmail, updatedAt: new Date() }).where(eq(abandonedCartsTable.phone, cleanPhone));
      }
      res.status(200).json({ ok: true, exists: true }); return;
    }
    await db.insert(abandonedCartsTable).values({ name: name.trim(), phone: cleanPhone, email: cleanEmail, address: address?.trim() ?? null, pincode: pincode?.trim() ?? null, source: source ?? "COD", eventId: eventId ?? null, recoveryStatus: "New" });

    /* Auto-send recovery email in background if email provided */
    if (cleanEmail) {
      sendAbandonedCartRecoveryEmail(name.trim(), cleanEmail).catch((err) => {
        console.warn("[AbandonedCart] Recovery email failed:", err?.message ?? err);
      });
    }

    res.status(201).json({ ok: true });
  } catch { res.status(200).json({ ok: false }); }
});

router.get("/admin/abandoned-carts", requireAdmin, async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, page = "1", limit = "50" } = req.query as Record<string, string>;
    const conditions = [];
    if (search) conditions.push(or(like(abandonedCartsTable.name, `%${search}%`), like(abandonedCartsTable.phone, `%${search}%`)));
    if (status && status !== "all") conditions.push(eq(abandonedCartsTable.recoveryStatus, status));
    if (dateFrom) conditions.push(gte(abandonedCartsTable.createdAt, new Date(dateFrom)));
    if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); conditions.push(lte(abandonedCartsTable.createdAt, end)); }
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(5000, parseInt(limit, 10));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [carts, countResult] = await Promise.all([
      db.select().from(abandonedCartsTable).where(where).orderBy(desc(abandonedCartsTable.createdAt)).limit(limitNum).offset((pageNum - 1) * limitNum),
      db.select({ count: sql<number>`COUNT(*)` }).from(abandonedCartsTable).where(where),
    ]);
    res.json({ carts, total: Number(countResult[0]?.count ?? 0), page: pageNum });
  } catch { res.status(500).json({ error: "Failed to fetch abandoned carts" }); }
});

router.patch("/admin/abandoned-carts/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const validStatuses = ["New", "Called", "Follow-up", "Recovered", "Not Interested"];
    if (!status || !validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [updated] = await db.update(abandonedCartsTable).set({ recoveryStatus: status, updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ cart: updated });
  } catch { res.status(500).json({ error: "Failed to update" }); }
});

/* ── Convert abandoned cart → order ─────────────────────────────────────── */
router.post("/admin/abandoned-carts/:id/recover", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [cart] = await db.select().from(abandonedCartsTable).where(eq(abandonedCartsTable.id, id)).limit(1);
    if (!cart) { res.status(404).json({ error: "Abandoned cart not found" }); return; }

    const orderId = `REC-${Date.now()}`;
    const [order] = await db.insert(ordersTable).values({
      orderId,
      name: cart.name,
      phone: cart.phone,
      address: cart.address ?? "To be confirmed",
      pincode: cart.pincode ?? "000000",
      quantity: 1,
      product: "KamaSutra Gold+ (1 Bottle)",
      source: "COD",
      status: "New",
      paymentMethod: "COD",
      visitorSource: "Recovered",
    }).returning();

    await db.update(abandonedCartsTable).set({ recoveryStatus: "Recovered", updatedAt: new Date() }).where(eq(abandonedCartsTable.id, id));
    res.json({ ok: true, order });
  } catch (err) {
    req.log.error({ err }, "Failed to recover abandoned cart");
    res.status(500).json({ error: "Failed to recover cart" });
  }
});

/* ─── Abandoned Cart Delete (Super Admin only) ─── */
router.delete("/admin/abandoned-carts/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0", 10);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const actor = ((req as unknown) as { admin: { username: string } }).admin.username;
    const [cart] = await db.select().from(abandonedCartsTable).where(eq(abandonedCartsTable.id, id));
    if (!cart) return res.status(404).json({ error: "Cart not found" });
    await db.delete(abandonedCartsTable).where(eq(abandonedCartsTable.id, id));
    await appendDeleteAudit([{ entityType: "abandoned_cart", entityId: id, entityRef: `${cart.name} (${cart.phone})`, deletedBy: actor, deletedAt: new Date().toISOString() }]);
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Delete failed" }); }
});

router.post("/admin/abandoned-carts/bulk-delete", requireSuperAdmin, async (req, res) => {
  try {
    const { ids } = req.body as { ids?: number[] };
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
    const actor = ((req as unknown) as { admin: { username: string } }).admin.username;
    const { rows } = await pool.query<{ id: number; name: string; phone: string }>(
      `SELECT id, name, phone FROM abandoned_carts WHERE id = ANY($1)`, [ids]
    );
    await pool.query(`DELETE FROM abandoned_carts WHERE id = ANY($1)`, [ids]);
    const now = new Date().toISOString();
    await appendDeleteAudit(rows.map((c) => ({ entityType: "abandoned_cart" as const, entityId: c.id, entityRef: `${c.name} (${c.phone})`, deletedBy: actor, deletedAt: now })));
    return res.json({ deleted: rows.length });
  } catch { return res.status(500).json({ error: "Bulk delete failed" }); }
});

// ── Test / Manual Email Trigger ──────────────────────────────────────────────
router.post("/admin/email/test", requireAdmin, async (req, res) => {
  const { to } = req.body as { to?: string };
  const recipient = (to ?? "").trim() || "mkhirnval@gmail.com";
  const result = await sendDailySummary(recipient);
  if (result.success) return res.json({ ok: true, message: result.message });
  return res.status(500).json({ ok: false, message: result.message });
});

// ── Event Match Tracking ─────────────────────────────────────────────────────
router.get("/admin/event-tracking", requireAdmin, async (req, res) => {
  try {
    const { source, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    let whereClause = `WHERE deleted_at IS NULL`;
    const params: unknown[] = [];

    if (source && source.trim()) {
      params.push(source.trim().toLowerCase());
      whereClause += ` AND LOWER(source) = $${params.length}`;
    }
    if (dateFrom && dateFrom.trim()) {
      params.push(dateFrom.trim());
      whereClause += ` AND created_at >= $${params.length}::date`;
    }
    if (dateTo && dateTo.trim()) {
      params.push(dateTo.trim());
      whereClause += ` AND created_at < ($${params.length}::date + INTERVAL '1 day')`;
    }

    const { rows } = await pool.query<{
      order_id: string; phone: string; event_id: string | null;
      source: string; created_at: string;
    }>(
      `SELECT order_id, phone, event_id, source, created_at
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 500`,
      params
    );

    // Find duplicate event_ids (non-null)
    const eventIdCounts: Record<string, number> = {};
    for (const row of rows) {
      if (row.event_id) eventIdCounts[row.event_id] = (eventIdCounts[row.event_id] ?? 0) + 1;
    }

    const data = rows.map((row) => {
      let status: "Matched" | "Missing" | "Duplicate";
      if (!row.event_id) {
        status = "Missing";
      } else if (eventIdCounts[row.event_id]! > 1) {
        status = "Duplicate";
      } else {
        status = "Matched";
      }
      return {
        orderId: row.order_id,
        phone: row.phone,
        eventId: row.event_id ?? null,
        source: row.source,
        createdAt: row.created_at,
        status,
      };
    });

    const summary = {
      total: data.length,
      matched: data.filter((d) => d.status === "Matched").length,
      missing: data.filter((d) => d.status === "Missing").length,
      duplicate: data.filter((d) => d.status === "Duplicate").length,
    };

    return res.json({ data, summary });
  } catch (err) {
    req.log.error({ err }, "Event tracking fetch failed");
    return res.status(500).json({ error: "Failed to fetch event tracking data" });
  }
});

export default router;
