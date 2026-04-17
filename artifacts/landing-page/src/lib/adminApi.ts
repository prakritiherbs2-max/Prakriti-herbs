import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = "/api";
const TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setAdminToken(token: string): void { localStorage.setItem(TOKEN_KEY, token); }
export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("admin_user");
  localStorage.removeItem("admin_role");
  localStorage.removeItem("admin_page");
}
export function isAdminLoggedIn(): boolean {
  const token = getAdminToken();
  if (!token) return false;
  try { const p = JSON.parse(atob(token.split(".")[1])); return p.exp * 1000 > Date.now(); } catch { return false; }
}
export function getAdminRole(): string {
  try {
    const token = getAdminToken();
    if (!token) return "view_only";
    const p = JSON.parse(atob(token.split(".")[1]));
    return (p.role as string) ?? "view_only";
  } catch { return "view_only"; }
}
export function isSuperAdmin(): boolean { return getAdminRole() === "super_admin"; }

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) { clearAdminToken(); window.location.href = "/admin/login"; }
  return res;
}

export async function adminLogin(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await fetch(`${API_BASE}/admin/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/forgot-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
}

export async function verifyOtp(email: string, otp: string, newPassword: string): Promise<{ token: string; username: string; role: string }> {
  const res = await fetch(`${API_BASE}/admin/verify-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ token: string; message: string }> {
  const res = await authFetch(`/admin/change-password`, {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export interface Order {
  id: number; orderId: string; name: string; phone: string; email: string | null; address: string;
  pincode: string; city: string | null; state: string | null; quantity: number; product: string; source: string; status: string;
  paymentMethod: string | null; paymentId: string | null; paymentStatus: string | null;
  trackingId: string | null; courier: string | null; visitorSource: string | null;
  website: string | null; domain: string | null; eventId: string | null;
  createdAt: string; isRepeat?: boolean;
}

export interface OrderStats {
  total: number; today: number; new: number; confirmed: number;
  shipped: number; cancelled: number; delivered: number;
}

export interface ReportFilters {
  dateFrom?: string; dateTo?: string; source?: string;
  orderType: "orders" | "abandoned"; repeatOnly?: boolean; format: "xlsx" | "csv";
}

export interface AdminDownload {
  id: number; downloadedBy: string; filename: string;
  recordCount: number; filters: string | null; downloadedAt: string;
  parsedFilters?: ReportFilters;
}

export interface AnalyticsData {
  ordersByDay: { date: string; count: number }[];
  ordersByHour: { hour: number; count: number }[];
  ordersBySource: { source: string; count: number }[];
  topCities: { city: string; count: number; revenue: number }[];
  topStates: { state: string; count: number; revenue: number; topSource: string }[];
  stateBySource: { state: string; source: string; count: number }[];
  visitors: { today: number; yesterday: number; last7: number; last30: number; total: number };
  conversion: {
    last30: { visitors: number; orders: number; rate: number };
    last7: { visitors: number; orders: number; rate: number };
    today: { visitors: number; orders: number; rate: number };
  };
  abandonedStats: { total: number; new: number; called: number; recovered: number };
  repeatCustomers: number;
  paymentStats: { cod: number; razorpay: number; cashfree: number; paid: number };
  periodOrderCount: number;
  periodRevenue: number;
}

export interface AbandonedCart {
  id: number; name: string; phone: string; email: string | null; address: string | null; pincode: string | null;
  source: string | null; recoveryStatus: string; eventId: string | null; createdAt: string; updatedAt: string;
}

export interface Review {
  id: number; product: string; reviewerName: string; phone: string | null; rating: number;
  reviewText: string; status: string; source: string; verified: boolean | null; city: string | null; createdAt: string;
}

export interface AppSettings { settings: Record<string, string>; exists: Record<string, boolean> }

export async function fetchOrders(params: { search?: string; status?: string; source?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}): Promise<{ orders: Order[]; total: number; page: number; limit: number; stats: OrderStats }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.source) qs.set("source", params.source);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await authFetch(`/admin/orders?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function fetchDistinctSources(): Promise<string[]> {
  const res = await authFetch("/admin/orders/distinct-sources");
  if (!res.ok) return [];
  const data = await res.json() as { sources: string[] };
  return data.sources;
}

export async function cleanupOldOrders(days: number): Promise<{ deleted: number; cutoffDate: string }> {
  const res = await authFetch(`/admin/orders/cleanup?days=${days}&confirm=true`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function updateOrderStatus(id: number, status: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error("Failed to update status");
}

export async function bulkUpdateOrderStatus(ids: number[], status: string): Promise<{ updated: number }> {
  const res = await authFetch("/admin/orders/bulk-status", { method: "POST", body: JSON.stringify({ ids, status }) });
  if (!res.ok) throw new Error("Bulk update failed");
  return res.json();
}

export async function shipViaShinprocket(id: number): Promise<{ awb: string; courier: string; trackingUrl: string }> {
  const res = await authFetch(`/admin/orders/${id}/ship-shiprocket`, { method: "POST" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function shipViaShadowfax(id: number): Promise<{ awb: string; courier: string; trackingUrl: string; labelUrl: string; zone?: string }> {
  const res = await authFetch(`/admin/orders/${id}/ship-shadowfax`, { method: "POST" });
  const data = await res.json() as { awb?: string; courier?: string; trackingUrl?: string; labelUrl?: string; zone?: string; error?: string; serviceable?: boolean; pincode?: string };
  if (!res.ok) {
    const err = new Error(data.error ?? "Shadowfax shipping failed") as Error & { serviceable?: boolean; pincode?: string };
    err.serviceable = data.serviceable;
    err.pincode = data.pincode;
    throw err;
  }
  return data as { awb: string; courier: string; trackingUrl: string; labelUrl: string; zone?: string };
}

export async function getShadowfaxLabel(id: number): Promise<{ labelUrl: string; awb: string }> {
  const res = await authFetch(`/admin/orders/${id}/shadowfax-label`);
  if (!res.ok) throw new Error("Could not fetch label");
  return res.json();
}

export async function checkShadowfaxServiceability(pincode: string): Promise<{ serviceable: boolean; zone?: string }> {
  const res = await authFetch(`/admin/shadowfax/serviceability/${pincode}`);
  if (!res.ok) return { serviceable: false };
  return res.json();
}

export async function updateIndiaPostTracking(id: number, trackingId: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/ship-indiapost`, { method: "POST", body: JSON.stringify({ trackingId }) });
  if (!res.ok) throw new Error("Failed to update tracking");
}

export async function sendWhatsAppToOrder(id: number, message?: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}/whatsapp`, { method: "POST", body: JSON.stringify({ message }) });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "WhatsApp failed");
}

export async function sendWhatsAppToCart(id: number): Promise<void> {
  const res = await authFetch(`/admin/abandoned-carts/${id}/whatsapp`, { method: "POST" });
  const data = await res.json() as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "WhatsApp failed");
}

export async function fetchAbandonedCarts(params: { search?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}): Promise<{ carts: AbandonedCart[]; total: number; page: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.dateFrom) qs.set("dateFrom", params.dateFrom);
  if (params.dateTo) qs.set("dateTo", params.dateTo);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await authFetch(`/admin/abandoned-carts?${qs}`);
  if (!res.ok) return { carts: [], total: 0, page: 1 };
  return res.json();
}

export async function updateAbandonedCartStatus(id: number, status: string): Promise<void> {
  await authFetch(`/admin/abandoned-carts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function fetchAnalytics(params: { from?: string; to?: string } = {}): Promise<AnalyticsData> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const res = await authFetch(`/admin/analytics?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function recoverAbandonedCart(id: number): Promise<{ ok: boolean; order: Order }> {
  const res = await authFetch(`/admin/abandoned-carts/${id}/recover`, { method: "POST" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export function exportAbandonedCartsToXLSX(carts: AbandonedCart[], filename: string): void {
  const rows = carts.map((c) => ({
    "Date (IST)": fmtISTForExport(c.createdAt),
    "Name": c.name, "Mobile": c.phone, "Email": c.email ?? "",
    "City": extractCity(c.address ?? ""),
    "Address": c.address ?? "", "Pincode": c.pincode ?? "",
    "State": pincodeToState(c.pincode ?? ""),
    "Source": c.source ?? "COD",
    "Recovery Status": c.recoveryStatus,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Abandoned Carts");
  XLSX.writeFile(wb, filename);
}

export function exportAbandonedCartsToCSV(carts: AbandonedCart[], filename: string): void {
  const headers = ["Date (IST)", "Name", "Mobile", "Email", "City", "Address", "Pincode", "State", "Source", "Recovery Status"];
  const rows = carts.map((c) => [
    fmtISTForExport(c.createdAt),
    `"${c.name}"`, c.phone, c.email ?? "",
    `"${extractCity(c.address ?? "")}"`, `"${c.address ?? ""}"`,
    c.pincode ?? "", pincodeToState(c.pincode ?? ""), c.source ?? "COD", c.recoveryStatus,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

export async function fetchReviews(params: { status?: string; page?: number } = {}): Promise<{ reviews: Review[]; total: number; stats: { total: number; pending: number; approved: number; avgRating: number } }> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  const res = await authFetch(`/admin/reviews?${qs}`);
  if (!res.ok) return { reviews: [], total: 0, stats: { total: 0, pending: 0, approved: 0, avgRating: 0 } };
  return res.json();
}

export async function addReview(data: { reviewerName: string; rating: number; reviewText: string; phone?: string; city?: string; status?: string; verified?: boolean }): Promise<Review> {
  const res = await authFetch("/admin/reviews", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to add review");
  const d = await res.json() as { review: Review };
  return d.review;
}

export async function updateReview(id: number, data: Partial<{ status: string; reviewerName: string; reviewText: string; rating: number; verified: boolean; city: string }>): Promise<Review> {
  const res = await authFetch(`/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to update review");
  const d = await res.json() as { review: Review };
  return d.review;
}

export async function deleteReview(id: number): Promise<void> {
  await authFetch(`/admin/reviews/${id}`, { method: "DELETE" });
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await authFetch("/admin/settings");
  if (!res.ok) return { settings: {}, exists: {} };
  return res.json();
}

export async function saveSettings(data: Record<string, string>): Promise<void> {
  const res = await authFetch("/admin/settings", { method: "POST", body: JSON.stringify(data) });
  if (!res.ok) throw new Error("Failed to save settings");
}

export async function fetchDownloads(): Promise<AdminDownload[]> {
  const res = await authFetch("/admin/downloads");
  if (!res.ok) return [];
  const data = await res.json() as { downloads: AdminDownload[] };
  return data.downloads;
}

export async function logDownload(filename: string, recordCount: number, filters: string | ReportFilters): Promise<void> {
  const filtersStr = typeof filters === "string" ? filters : JSON.stringify(filters);
  await authFetch("/admin/downloads", { method: "POST", body: JSON.stringify({ filename, recordCount, filters: filtersStr }) });
}

export async function deleteDownload(id: number): Promise<void> {
  const res = await authFetch(`/admin/downloads/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

/** Move a single order to trash (soft delete) */
export async function deleteOrder(id: number): Promise<void> {
  const res = await authFetch(`/admin/orders/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
}

/** Move multiple orders to trash (soft delete) */
export async function bulkDeleteOrders(ids: number[]): Promise<{ deleted: number }> {
  const res = await authFetch("/admin/orders/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export interface TrashOrder {
  id: number; order_id: string; name: string; phone: string;
  address: string; pincode: string; city: string | null; state: string | null;
  quantity: number; product: string; source: string; status: string;
  payment_method: string | null; payment_status: string | null;
  visitor_source: string | null; created_at: string; deleted_at: string;
}

export async function fetchTrashOrders(): Promise<{ orders: TrashOrder[]; total: number }> {
  const res = await authFetch("/admin/orders/trash");
  if (!res.ok) throw new Error("Failed to fetch trash");
  return res.json();
}

export async function restoreOrdersFromTrash(ids: number[]): Promise<{ restored: number }> {
  const res = await authFetch("/admin/orders/trash/restore", { method: "POST", body: JSON.stringify({ ids }) });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function emptyTrash(): Promise<{ deleted: number }> {
  const res = await authFetch("/admin/orders/trash/empty", { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function permanentDeleteOrder(id: number): Promise<void> {
  const res = await authFetch(`/admin/orders/trash/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
}

export async function deleteAbandonedCartAdmin(id: number): Promise<void> {
  const res = await authFetch(`/admin/abandoned-carts/${id}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
}

export async function bulkDeleteAbandonedCarts(ids: number[]): Promise<{ deleted: number }> {
  const res = await authFetch("/admin/abandoned-carts/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export interface DeleteAuditEntry {
  id: string; entityType: "order" | "abandoned_cart";
  entityId: number; entityRef: string; deletedBy: string; deletedAt: string;
}

export async function fetchDeleteAuditLog(): Promise<DeleteAuditEntry[]> {
  const res = await authFetch("/admin/delete-audit-log");
  if (!res.ok) return [];
  const data = await res.json() as { entries: DeleteAuditEntry[] };
  return data.entries;
}

export function parseDownloadFilters(dl: AdminDownload): ReportFilters | null {
  if (!dl.filters) return null;
  try {
    const parsed = JSON.parse(dl.filters) as ReportFilters;
    if (parsed.orderType) return parsed;
    return null;
  } catch { return null; }
}

function extractCity(address: string): string {
  /* Try to extract city from Indian address.
     Common format: "House/Flat, Street, Area, City, State"
     We take the second-to-last comma-delimited segment after stripping any trailing 6-digit pincode. */
  const clean = address.replace(/\b\d{6}\b/g, "").replace(/\s+/g, " ").trim().replace(/,\s*$/, "");
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 2] ?? parts[parts.length - 1];
}

function fmtISTForExport(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s/, "$3-$2-$1 ");
}

export async function fetchLiveVisitors(): Promise<{ total: number; breakdown: Record<string, number> }> {
  try {
    const res = await authFetch("/admin/live-visitors");
    if (!res.ok) return { total: 0, breakdown: {} };
    return res.json() as Promise<{ total: number; breakdown: Record<string, number> }>;
  } catch { return { total: 0, breakdown: {} }; }
}

const PINCODE_STATE: Record<string, string> = {
  "11":"Delhi","12":"Haryana","13":"Haryana","14":"Punjab","15":"Punjab","16":"Punjab",
  "17":"Himachal Pradesh","18":"J & K","19":"J & K",
  "20":"Uttar Pradesh","21":"Uttar Pradesh","22":"Uttar Pradesh","23":"Uttar Pradesh",
  "24":"Uttar Pradesh","25":"Uttar Pradesh","26":"Uttar Pradesh","27":"Uttar Pradesh","28":"Uttar Pradesh",
  "29":"Karnataka","30":"Rajasthan","31":"Rajasthan","32":"Rajasthan","33":"Rajasthan","34":"Rajasthan",
  "35":"Andaman & Nicobar",
  "36":"Gujarat","37":"Gujarat","38":"Gujarat","39":"Gujarat",
  "40":"Maharashtra","41":"Maharashtra","42":"Maharashtra","43":"Maharashtra","44":"Maharashtra",
  "45":"Madhya Pradesh","46":"Madhya Pradesh","47":"Madhya Pradesh","48":"Madhya Pradesh",
  "49":"Chhattisgarh","50":"Telangana","51":"Telangana",
  "52":"Andhra Pradesh","53":"Andhra Pradesh","54":"Andhra Pradesh","55":"Andhra Pradesh",
  "56":"Karnataka","57":"Karnataka","58":"Karnataka","59":"Karnataka",
  "60":"Tamil Nadu","61":"Tamil Nadu","62":"Tamil Nadu","63":"Tamil Nadu","64":"Tamil Nadu","65":"Tamil Nadu",
  "66":"Kerala","67":"Kerala","68":"Kerala","69":"Kerala",
  "70":"West Bengal","71":"West Bengal","72":"West Bengal","73":"West Bengal","74":"West Bengal",
  "75":"Odisha","76":"Odisha","77":"Odisha","78":"Assam","79":"Northeast",
  "80":"Bihar","81":"Bihar","82":"Bihar","83":"Jharkhand","84":"Bihar","85":"Bihar",
};
export function pincodeToState(pincode: string | null | undefined): string {
  if (!pincode || pincode.length < 2 || pincode === "000000") return "—";
  return PINCODE_STATE[pincode.slice(0, 2)] ?? "Other";
}

export function exportOrdersToXLSX(orders: Order[], filename = "orders.xlsx"): void {
  const rows = orders.map((o) => ({
    "Order ID": o.orderId, "Date (IST)": fmtISTForExport(o.createdAt),
    "Name": o.name, "Mobile": o.phone, "Email": o.email ?? "",
    "City": o.city ?? extractCity(o.address), "State": o.state ?? pincodeToState(o.pincode),
    "Address": o.address, "Pincode": o.pincode,
    "Qty": o.quantity, "Amount (₹)": 999 * o.quantity,
    "Channel": o.visitorSource ?? "Direct", "Source": o.source,
    "Payment": o.paymentMethod ?? "COD", "Pay Status": o.paymentStatus ?? "pending",
    "Status": o.status, "Tracking": o.trackingId ?? "", "Courier": o.courier ?? "",
    "Repeat": o.isRepeat ? "Yes" : "No",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename);
}

export function exportSingleOrderToXLSX(order: Order): void {
  exportOrdersToXLSX([order], `order_${order.orderId}.xlsx`);
}

export function exportOrdersToPDF(orders: Order[], filename = "orders.pdf"): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(27, 94, 32); doc.rect(0, 0, 297, 18, "F");
  doc.setTextColor(201, 161, 74); doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("Prakriti Herbs — Orders Export", 148, 11, { align: "center" });
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`, 148, 16, { align: "center" });
  autoTable(doc, {
    startY: 22,
    head: [["Date (IST)", "Order ID", "Name", "Mobile", "Address", "Pincode", "Qty", "Amount", "Channel", "Source", "Payment", "Status", "Tracking"]],
    body: orders.map((o) => [
      fmtISTForExport(o.createdAt), o.orderId, o.name, o.phone,
      o.address.substring(0, 30), o.pincode, o.quantity,
      `₹${(999 * o.quantity).toLocaleString()}`, o.visitorSource ?? "Direct", o.source, o.paymentMethod ?? "COD", o.status, o.trackingId ?? "",
    ]),
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: [248, 250, 248] },
  });
  doc.save(filename);
}

export function exportSingleOrderToPDF(order: Order): void {
  exportOrdersToPDF([order], `order_${order.orderId}.pdf`);
}

export function exportOrdersToCSV(orders: Order[], filename = "orders.csv"): void {
  const headers = ["Order ID", "Date (IST)", "Name", "Mobile", "Email", "City", "Address", "Pincode", "State", "Qty", "Amount (₹)", "Source", "Channel", "Payment", "Pay Status", "Status", "Tracking", "Courier", "Repeat"];
  const rows = orders.map((o) => [
    o.orderId, fmtISTForExport(o.createdAt), `"${o.name}"`, o.phone, o.email ?? "",
    `"${o.city ?? extractCity(o.address)}"`, `"${o.address}"`,
    o.pincode, o.state ?? pincodeToState(o.pincode), o.quantity, 999 * o.quantity,
    o.visitorSource ?? "Direct", o.source, o.paymentMethod ?? "COD",
    o.paymentStatus ?? "pending", o.status, o.trackingId ?? "", o.courier ?? "", o.isRepeat ? "Yes" : "No",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Agency Profiles ─── */
export interface AgencyProfile {
  id: string;
  name: string;
  sourceName: string;
  pixelId: string;
  businessManagerId: string;
  capiToken: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  ga4MeasurementId: string;
  googleSheetWebhookUrl: string;
  active: boolean;
  createdAt: string;
}

export async function fetchAgencies(): Promise<AgencyProfile[]> {
  const res = await authFetch("/admin/agencies");
  if (!res.ok) return [];
  return res.json() as Promise<AgencyProfile[]>;
}

export async function saveAgency(data: Partial<AgencyProfile>): Promise<AgencyProfile> {
  const res = await authFetch("/admin/agencies", { method: "POST", body: JSON.stringify(data) });
  const d = await res.json() as AgencyProfile & { error?: string };
  if (!res.ok) throw new Error(d.error ?? "Failed to save agency");
  return d;
}

export async function toggleAgency(id: string): Promise<{ id: string; active: boolean }> {
  const res = await authFetch(`/admin/agencies/${id}/toggle`, { method: "PATCH" });
  const d = await res.json() as { id: string; active: boolean; error?: string };
  if (!res.ok) throw new Error(d.error ?? "Failed to toggle agency");
  return d;
}

export async function deleteAgency(id: string): Promise<void> {
  const res = await authFetch(`/admin/agencies/${id}`, { method: "DELETE" });
  if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? "Delete failed"); }
}

export async function testAgencyConnection(id: string): Promise<{ ok: boolean; message: string }> {
  const res = await authFetch(`/admin/agencies/${id}/test`, { method: "POST" });
  return res.json() as Promise<{ ok: boolean; message: string }>;
}

export async function pauseAllAgencies(): Promise<{ ok: boolean; paused: number }> {
  const res = await authFetch("/admin/agencies/pause-all", { method: "POST" });
  return res.json() as Promise<{ ok: boolean; paused: number }>;
}

export interface CapiLogEntry { id: string; timestamp: string; agencyName: string; pixelId: string; event: string; status: "success" | "failed"; message: string; }
export async function fetchCapiLog(): Promise<CapiLogEntry[]> {
  const res = await authFetch("/admin/capi-log");
  if (!res.ok) return [];
  return res.json() as Promise<CapiLogEntry[]>;
}
export async function clearCapiLog(): Promise<void> {
  await authFetch("/admin/capi-log", { method: "DELETE" });
}

export interface PendingCapiEvent { id: string; timestamp: string; agencyName: string; pixelId: string; event: string; }
export async function fetchPendingCapi(): Promise<PendingCapiEvent[]> {
  const res = await authFetch("/admin/capi-pending");
  if (!res.ok) return [];
  return res.json() as Promise<PendingCapiEvent[]>;
}
export async function retryCapi(id: string): Promise<{ ok: boolean; message?: string }> {
  const res = await authFetch(`/admin/capi-pending/${id}/retry`, { method: "POST" });
  return res.json() as Promise<{ ok: boolean; message?: string }>;
}
export async function dismissPendingCapi(id: string): Promise<void> {
  await authFetch(`/admin/capi-pending/${id}`, { method: "DELETE" });
}

/* ─── Data Export ─── */
export async function downloadAgencyCSV(source?: string, label?: string): Promise<void> {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  const res = await authFetch(`/admin/export/orders?${params.toString()}`);
  if (!res.ok) { alert("Export failed. Please try again."); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = source ? `prakriti_${source}_orders_${date}.csv` : `prakriti_all_orders_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadAgencyExcel(source?: string, label?: string): Promise<void> {
  const params = new URLSearchParams({ format: "json" });
  if (source) params.set("source", source);
  const res = await authFetch(`/admin/export/orders?${params.toString()}`);
  if (!res.ok) { alert("Export failed. Please try again."); return; }
  const rows = await res.json() as Record<string, unknown>[];
  if (!rows.length) { alert("No orders found for this source."); return; }

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0]).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  const sheetName = source ? source.toUpperCase().slice(0, 31) : "All Orders";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const date = new Date().toISOString().slice(0, 10);
  const filename = source ? `prakriti_${source}_orders_${date}.xlsx` : `prakriti_all_orders_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export interface AgencyOrderStat {
  source: string;
  total_orders: number;
  delivered: number;
  cancelled: number;
  new_orders: number;
  first_order: string | null;
  last_order: string | null;
}
export interface AgencyStatsResponse {
  rows: AgencyOrderStat[];
  resetDate: string | null;
}
export async function fetchAgencyStats(): Promise<AgencyStatsResponse> {
  const res = await authFetch("/admin/export/agency-stats");
  if (!res.ok) return { rows: [], resetDate: null };
  return res.json() as Promise<AgencyStatsResponse>;
}

export async function resetStatsDate(): Promise<{ resetDate: string }> {
  const res = await authFetch("/admin/agency-stats/reset", { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset stats");
  return res.json() as Promise<{ resetDate: string }>;
}

export async function clearStatsResetDate(): Promise<void> {
  await authFetch("/admin/agency-stats/reset", { method: "DELETE" });
}

/* ─── Staff Management ─── */
export interface StaffUser { id: string; username: string; role: "order_manager" | "view_only"; createdAt: string; }

export async function fetchStaff(): Promise<StaffUser[]> {
  const res = await authFetch("/admin/staff");
  if (!res.ok) return [];
  const data = await res.json() as { staff: StaffUser[] };
  return data.staff;
}

export async function createStaff(username: string, password: string, role: "order_manager" | "view_only"): Promise<StaffUser> {
  const res = await authFetch("/admin/staff", { method: "POST", body: JSON.stringify({ username, password, role }) });
  const data = await res.json() as { staff?: StaffUser; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to create staff user");
  return data.staff!;
}

export async function deleteStaff(id: string): Promise<void> {
  const res = await authFetch(`/admin/staff/${id}`, { method: "DELETE" });
  if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? "Delete failed"); }
}

export async function testEmailReport(to: string): Promise<{ ok: boolean; message: string }> {
  const res = await authFetch("/admin/email/test", { method: "POST", body: JSON.stringify({ to }) });
  const data = await res.json() as { ok?: boolean; message?: string };
  return { ok: !!data.ok, message: data.message ?? (res.ok ? "Sent" : "Failed") };
}

export type EventTrackingStatus = "Matched" | "Missing" | "Duplicate";
export interface EventTrackingEntry {
  orderId: string;
  phone: string;
  eventId: string | null;
  source: string;
  createdAt: string;
  status: EventTrackingStatus;
}
export interface EventTrackingSummary {
  total: number;
  matched: number;
  missing: number;
  duplicate: number;
}

export interface LeadEntry {
  id: number;
  event_id: string | null;
  type: string;
  source: string;
  customer_phone: string | null;
  call_status: string;
  call_duration: number | null;
  page_url: string | null;
  landing_page: string | null;
  campaign_name: string | null;
  adset_name: string | null;
  ad_name: string | null;
  device_type: string | null;
  browser: string | null;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  website: string | null;
  domain: string | null;
  notes: string | null;
  created_at: string;
}
export interface LeadFilters {
  type?: string;
  status?: string;
  source?: string;
  phone?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function fetchLeadTracking(
  filters?: LeadFilters
): Promise<{ data: LeadEntry[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.phone) params.set("phone", filters.phone);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  const res = await authFetch(`/admin/lead-tracking${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch lead tracking");
  return res.json() as Promise<{ data: LeadEntry[]; total: number; page: number; limit: number }>;
}

export async function exportLeadTracking(
  filters?: LeadFilters
): Promise<{ data: LeadEntry[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.phone) params.set("phone", filters.phone);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  const res = await authFetch(`/admin/lead-tracking/export${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Export failed");
  return res.json() as Promise<{ data: LeadEntry[] }>;
}

export async function fetchEventTracking(filters?: {
  source?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ data: EventTrackingEntry[]; summary: EventTrackingSummary }> {
  const params = new URLSearchParams();
  if (filters?.source) params.set("source", filters.source);
  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  const qs = params.toString();
  const res = await authFetch(`/admin/event-tracking${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch event tracking");
  return res.json() as Promise<{ data: EventTrackingEntry[]; summary: EventTrackingSummary }>;
}

// ── Lead Tracking — Edit / Delete / Cleanup ──────────────────────────────────
export async function updateLead(
  id: number, data: { customerPhone?: string; callStatus?: string; notes?: string }
): Promise<{ ok: boolean; lead: LeadEntry }> {
  const res = await authFetch(`/admin/lead-tracking/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function deleteLead(id: number): Promise<void> {
  const res = await authFetch(`/admin/lead-tracking/${id}?confirm=true`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
}

export async function bulkDeleteLeads(ids: number[]): Promise<{ deleted: number }> {
  const res = await authFetch("/admin/lead-tracking/delete-bulk", {
    method: "POST",
    body: JSON.stringify({ ids, confirm: true }),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

export async function cleanupLeads(days: number, missedOnly: boolean): Promise<{ deleted: number }> {
  const qs = new URLSearchParams({ days: String(days), missedOnly: String(missedOnly), confirm: "true" });
  const res = await authFetch(`/admin/lead-tracking/cleanup?${qs}`, { method: "DELETE" });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}

// ── Orders — Full Edit ────────────────────────────────────────────────────────
export async function updateOrderFull(
  id: number,
  data: {
    name?: string; phone?: string; email?: string;
    address?: string; city?: string; state?: string; pincode?: string;
    status?: string; trackingId?: string; courier?: string;
  }
): Promise<{ ok: boolean; order: Order }> {
  const res = await authFetch(`/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error); }
  return res.json();
}
