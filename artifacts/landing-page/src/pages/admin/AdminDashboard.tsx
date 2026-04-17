import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  fetchOrders, fetchAnalytics, fetchDownloads, fetchAbandonedCarts, fetchSettings,
  updateAbandonedCartStatus, sendWhatsAppToCart, fetchLiveVisitors,
  recoverAbandonedCart, exportAbandonedCartsToXLSX, exportAbandonedCartsToCSV,
  deleteDownload, logDownload, parseDownloadFilters,
  exportOrdersToXLSX, exportOrdersToCSV,
  deleteAbandonedCartAdmin, bulkDeleteAbandonedCarts, isSuperAdmin,
  fetchDeleteAuditLog,
  type OrderStats, type AnalyticsData, type AdminDownload, type AbandonedCart,
  type ReportFilters, type DeleteAuditEntry,
  clearAdminToken, isAdminLoggedIn,
} from "@/lib/adminApi";
import { AdminOrders } from "./AdminOrders";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminMarketing } from "./AdminMarketing";
import { AdminSettings } from "./AdminSettings";
import { AdminEventTracking } from "./AdminEventTracking";
import { AdminLeadTracking } from "./AdminLeadTracking";
import {
  Home, Package, AlertTriangle, BarChart3, Star, Settings, History,
  Search, LogOut, Menu, X, RefreshCw, Phone, MapPin, MessageSquare,
  TrendingUp, ShoppingCart, Eye, ArrowUpRight, Globe, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Filter, CheckCircle, Radio, Download, CheckCheck,
  Trash2, PlusCircle, Users, CalendarRange, CheckSquare, Square, Fingerprint,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const PIE_COLORS = [G, GOLD, "#2196F3", "#FF5722", "#9C27B0", "#00BCD4"];

type Page = "home" | "orders" | "abandoned" | "analytics" | "marketing" | "lead-tracking" | "event-tracking" | "settings" | "downloads";

const RECOVERY_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700", Called: "bg-yellow-100 text-yellow-700",
  "Follow-up": "bg-orange-100 text-orange-700", Recovered: "bg-green-100 text-green-700",
  "Not Interested": "bg-red-100 text-red-700",
};
const RECOVERY_STATUSES = ["New", "Called", "Follow-up", "Recovered", "Not Interested"];

function fmtShort(d: string) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value, color, icon, sub }: { label: string; value: string | number; color: string; icon?: React.ReactNode; sub?: string }) {
  return (
    <div className={`rounded-xl p-4 border ${color} flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        {icon && <div className="opacity-40">{icon}</div>}
      </div>
      <p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function RecoverySelect({ cartId, current, onUpdate }: { cartId: number; current: string; onUpdate: (id: number, s: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value; if (s === current) return;
    setLoading(true);
    try { await updateAbandonedCartStatus(cartId, s); onUpdate(cartId, s); }
    catch { alert("Update failed"); }
    finally { setLoading(false); }
  }
  const cls = RECOVERY_COLORS[current] ?? "bg-gray-100 text-gray-600";
  return (
    <select value={current} onChange={handleChange} disabled={loading}
      className={`text-xs font-semibold border-0 rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${cls}`}>
      {RECOVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function Sidebar({ page, setPage, sidebarOpen, setSidebarOpen, adminUser, onLogout, badgeCounts }: {
  page: Page; setPage: (p: Page) => void; sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
  adminUser: string; onLogout: () => void; badgeCounts: { abandoned: number };
}) {
  const navItems: { id: Page; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "home", icon: <Home className="w-4 h-4" />, label: "Home" },
    { id: "orders", icon: <Package className="w-4 h-4" />, label: "Orders" },
    { id: "abandoned", icon: <AlertTriangle className="w-4 h-4" />, label: "Abandoned Carts", badge: badgeCounts.abandoned > 0 ? badgeCounts.abandoned : undefined },
    { id: "analytics", icon: <BarChart3 className="w-4 h-4" />, label: "Analytics" },
    { id: "marketing", icon: <Star className="w-4 h-4" />, label: "Marketing" },
    { id: "lead-tracking", icon: <Phone className="w-4 h-4" />, label: "Lead Tracking" },
    { id: "event-tracking", icon: <Fingerprint className="w-4 h-4" />, label: "Event Tracking" },
    { id: "settings", icon: <Settings className="w-4 h-4" />, label: "Settings" },
    { id: "downloads", icon: <History className="w-4 h-4" />, label: "Downloads" },
  ];

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 w-56 bg-white border-r border-gray-200 shadow-lg`}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}>
          <div className="w-8 h-8 rounded-full border-2 overflow-hidden flex-shrink-0 bg-white flex items-center justify-center" style={{ borderColor: GOLD }}>
            <img src="/images/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-xs leading-tight">Prakriti Herbs</p>
            <p className="text-xs" style={{ color: GOLD }}>Admin Panel</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors relative ${page === item.id ? "text-white" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
              style={page === item.id ? { background: `linear-gradient(135deg, ${G}, #2E7D32)` } : {}}>
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">
              {adminUser[0]?.toUpperCase() ?? "A"}
            </div>
            <span className="text-xs font-medium text-gray-700 truncate">{adminUser}</span>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

const SOURCE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  Facebook:  { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500" },
  Instagram: { bg: "bg-pink-50",   text: "text-pink-700",   dot: "bg-pink-500" },
  WhatsApp:  { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  Direct:    { bg: "bg-gray-50",   text: "text-gray-600",   dot: "bg-gray-400" },
};

function LiveVisitorsWidget() {
  const [data, setData] = useState<{ total: number; breakdown: Record<string, number> }>({ total: 0, breakdown: {} });
  const [updated, setUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const result = await fetchLiveVisitors();
    setData(result);
    setUpdated(new Date());
  }, []);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(iv);
  }, [refresh]);

  const sources = Object.entries(data.breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="w-4 h-4 text-green-600" />
            {data.total > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            )}
          </div>
          <h3 className="text-sm font-bold text-gray-700">Live on Website</h3>
        </div>
        <button onClick={() => void refresh()} title="Refresh"
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-5xl font-black" style={{ color: data.total > 0 ? G : "#9CA3AF" }}>
          {data.total}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-500">visitor{data.total !== 1 ? "s" : ""}</p>
          <p className="text-xs text-gray-400">right now</p>
        </div>
        {data.total > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-600">LIVE</span>
          </div>
        )}
      </div>

      {sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map(([src, count]) => {
            const colors = SOURCE_COLORS[src] ?? SOURCE_COLORS["Direct"]!;
            const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
            return (
              <div key={src} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 flex-1 min-w-0 px-2.5 py-1.5 rounded-lg ${colors.bg}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                  <span className={`text-xs font-semibold ${colors.text} flex-1`}>{src}</span>
                  <span className={`text-xs font-bold ${colors.text}`}>{count}</span>
                  <span className={`text-xs ${colors.text} opacity-60`}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-3">
          <Globe className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">No active visitors right now</p>
          <p className="text-xs text-gray-300 mt-0.5">Updates every 15 seconds</p>
        </div>
      )}

      {updated && (
        <p className="text-xs text-gray-300 mt-3 text-right">
          Updated {updated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      )}
    </div>
  );
}

/* ─── Home Page ─── */
function HomePage({ stats, analytics, loading }: { stats: OrderStats | null; analytics: AnalyticsData | null; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <StatCard label="Total" value={stats.total} color="bg-white border-gray-200 text-gray-800" icon={<Package className="w-4 h-4" />} />
          <StatCard label="Today" value={stats.today} color="bg-blue-50 border-blue-200 text-blue-800" icon={<ShoppingCart className="w-4 h-4" />} />
          <StatCard label="New" value={stats.new} color="bg-blue-50 border-blue-200 text-blue-800" />
          <StatCard label="Confirmed" value={stats.confirmed} color="bg-yellow-50 border-yellow-200 text-yellow-800" />
          <StatCard label="Shipped" value={stats.shipped} color="bg-purple-50 border-purple-200 text-purple-800" />
          <StatCard label="Delivered" value={stats.delivered} color="bg-green-50 border-green-200 text-green-800" />
          <StatCard label="Cancelled" value={stats.cancelled} color="bg-red-50 border-red-200 text-red-800" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <LiveVisitorsWidget />
        </div>
        <div className="lg:col-span-2 grid grid-cols-3 gap-3">
          {stats && <>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-4 flex flex-col gap-1">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Revenue Today</p>
              <p className="text-2xl font-black text-blue-800">₹{((stats.today ?? 0) * 999).toLocaleString()}</p>
              <p className="text-xs text-blue-500">{stats.today} orders</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 p-4 flex flex-col gap-1">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-black text-green-800">₹{((stats.total ?? 0) * 999).toLocaleString()}</p>
              <p className="text-xs text-green-500">{stats.total} orders</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-4 flex flex-col gap-1">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Delivered</p>
              <p className="text-2xl font-black text-purple-800">₹{((stats.delivered ?? 0) * 999).toLocaleString()}</p>
              <p className="text-xs text-purple-500">{stats.delivered} orders</p>
            </div>
          </>}
        </div>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Orders — Last 30 Days</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={analytics.ordersByDay} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G} stopOpacity={0.2} /><stop offset="95%" stopColor={G} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => (v as string).slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${String(v)} orders`]} />
                <Area type="monotone" dataKey="count" stroke={G} strokeWidth={2} fill="url(#g1)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-red-500" /> Top Cities</h3>
            {analytics.topCities.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">Not enough data yet</p> : (
              <div className="space-y-2">
                {analytics.topCities.slice(0, 7).map((c, i) => {
                  const max = analytics.topCities[0]?.count ?? 1;
                  return (
                    <div key={c.city} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-700 truncate">{c.city}</span>
                          <div className="text-right ml-2">
                            <span className="text-xs font-bold text-gray-900">{c.count}</span>
                            <span className="text-xs text-green-700 ml-1">₹{c.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-green-600" /> Conversion Today</h3>
            <div className="text-center py-2">
              <p className="text-4xl font-black" style={{ color: G }}>{analytics.conversion.today.rate}%</p>
              <p className="text-xs text-gray-500 mt-1">conversion rate</p>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, analytics.conversion.today.rate * 5)}%`, background: `linear-gradient(to right, ${G}, ${GOLD})` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>{analytics.conversion.today.visitors} visitors</span>
              <span>{analytics.conversion.today.orders} orders</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Order Sources</h3>
            {analytics.ordersBySource.length === 0 ? <p className="text-xs text-gray-400 text-center py-8">No data yet</p> : (
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={analytics.ordersBySource} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                    {analytics.ordersBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Abandoned Carts</h3>
            <div className="space-y-2">
              {[["Total", analytics.abandonedStats.total, "text-gray-900"], ["New", analytics.abandonedStats.new, "text-blue-700"], ["Called", analytics.abandonedStats.called, "text-yellow-700"], ["Recovered", analytics.abandonedStats.recovered, "text-green-700"]].map(([label, value, cls]) => (
                <div key={label as string} className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{label as string}</span>
                  <span className={`text-sm font-bold ${cls as string}`}>{(value as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-purple-500" /> Visitors</h3>
            <div className="space-y-2">
              {[["Today", analytics.visitors.today], ["Yesterday", analytics.visitors.yesterday], ["7 Days", analytics.visitors.last7], ["30 Days", analytics.visitors.last30]].map(([label, value]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-xs text-gray-500">{label as string}</span>
                  <span className="text-sm font-bold text-gray-900">{(value as number).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && !stats && <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>}
    </div>
  );
}

/* ─── Abandoned Carts ─── */
type CartDatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all";

function toCartISTDateStr(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getCartPresetDates(preset: CartDatePreset): { from: string; to: string } {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = istNow.getFullYear(), m = istNow.getMonth(), day = istNow.getDate();
  switch (preset) {
    case "today": return { from: toCartISTDateStr(istNow), to: toCartISTDateStr(istNow) };
    case "yesterday": { const yd = new Date(y, m, day - 1); return { from: toCartISTDateStr(yd), to: toCartISTDateStr(yd) }; }
    case "this_week": { const dow = istNow.getDay(); const mon = new Date(y, m, day - (dow === 0 ? 6 : dow - 1)); return { from: toCartISTDateStr(mon), to: toCartISTDateStr(istNow) }; }
    case "this_month": return { from: toCartISTDateStr(new Date(y, m, 1)), to: toCartISTDateStr(istNow) };
    case "last_month": { const lm1 = new Date(y, m - 1, 1); const lm2 = new Date(y, m, 0); return { from: toCartISTDateStr(lm1), to: toCartISTDateStr(lm2) }; }
    default: return { from: "", to: "" };
  }
}

function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<CartDatePreset>("all");
  const [waLoading, setWaLoading] = useState<number | null>(null);
  const [recoverLoading, setRecoverLoading] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const isSA = isSuperAdmin();
  const LIMIT = 25;

  function handlePresetChange(preset: CartDatePreset) {
    setDatePreset(preset);
    const { from, to } = getCartPresetDates(preset);
    setDateFrom(from);
    setDateTo(to);
  }

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try { const r = await fetchAbandonedCarts({ search, status: statusFilter, dateFrom, dateTo, page: pg, limit: LIMIT }); setCarts(r.carts); setTotal(r.total); setPage(pg); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { void load(1); }, [load]);

  async function handleWA(cart: AbandonedCart) {
    setWaLoading(cart.id);
    try { await sendWhatsAppToCart(cart.id); alert("✅ WhatsApp sent!"); setCarts((prev) => prev.map((c) => c.id === cart.id ? { ...c, recoveryStatus: "Called" } : c)); }
    catch (err) { alert(err instanceof Error ? err.message : "WhatsApp failed"); }
    finally { setWaLoading(null); }
  }

  async function handleRecover(cart: AbandonedCart) {
    if (!confirm(`Move "${cart.name}" (${cart.phone}) to Orders as a new COD order?`)) return;
    setRecoverLoading(cart.id);
    try {
      await recoverAbandonedCart(cart.id);
      alert(`✅ Order created for ${cart.name}! It's now visible in the Orders tab.`);
      setCarts((prev) => prev.map((c) => c.id === cart.id ? { ...c, recoveryStatus: "Recovered" } : c));
    } catch (err) { alert(err instanceof Error ? err.message : "Recovery failed"); }
    finally { setRecoverLoading(null); }
  }

  async function handleExport(type: "xlsx" | "csv") {
    setExporting(true);
    try {
      const r = await fetchAbandonedCarts({ search, status: statusFilter, dateFrom, dateTo, page: 1, limit: 5000 });
      const now = new Date().toISOString().slice(0, 10);
      if (type === "xlsx") exportAbandonedCartsToXLSX(r.carts, `abandoned_carts_${now}.xlsx`);
      else exportAbandonedCartsToCSV(r.carts, `abandoned_carts_${now}.csv`);
    } catch { alert("Export failed. Please try again."); }
    finally { setExporting(false); }
  }

  function toggleCartSelect(id: number) { setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function toggleAllCarts() { setSelected((p) => p.size === carts.length ? new Set() : new Set(carts.map((c) => c.id))); }

  async function handleDeleteCart(id: number) {
    setDeleting(id);
    try {
      await deleteAbandonedCartAdmin(id);
      setCarts((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); setDeleteConfirm(null); }
  }

  async function handleBulkDeleteCarts() {
    if (selected.size === 0) return;
    if (!confirm(`⚠️ क्या आप ${selected.size} abandoned carts हमेशा के लिए delete करना चाहते हैं? यह action पूरी तरह अपरिवर्सनीय है।`)) return;
    setBulkDeleting(true);
    try {
      const r = await bulkDeleteAbandonedCarts([...selected]);
      alert(`✅ ${r.deleted} carts deleted`);
      void load(page);
      setSelected(new Set());
    } catch (e) { alert(e instanceof Error ? e.message : "Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Abandoned Carts</h1>
          <p className="text-xs text-gray-500 mt-0.5">Customers who filled name/phone but didn't complete the order</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Download:</span>
          <button onClick={() => void handleExport("xlsx")} disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#e8f5e9", color: G, borderColor: "#a5d6a7" }}>
            {exporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />}
            XLSX
          </button>
          <button onClick={() => void handleExport("csv")} disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9" }}>
            {exporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Total", carts.length > 0 ? total : 0, "bg-white border-gray-200 text-gray-800"], ["New", carts.filter((c) => c.recoveryStatus === "New").length, "bg-blue-50 border-blue-200 text-blue-800"], ["Called", carts.filter((c) => c.recoveryStatus === "Called" || c.recoveryStatus === "Follow-up").length, "bg-yellow-50 border-yellow-200 text-yellow-800"], ["Recovered", carts.filter((c) => c.recoveryStatus === "Recovered").length, "bg-green-50 border-green-200 text-green-800"]].map(([label, value, cls]) => (
          <StatCard key={label as string} label={label as string} value={value as number} color={cls as string} />
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
              onKeyDown={(e) => e.key === "Enter" && void load(1)} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">All Status</option>
            {RECOVERY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => void load(1)} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setDatePreset("all"); }}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Clear</button>
          <button onClick={() => void load(page)} disabled={loading} className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Range:</span>
          <select value={datePreset} onChange={(e) => handlePresetChange(e.target.value as CartDatePreset)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500/30">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
          </select>
          <span className="text-xs text-gray-400">or custom:</span>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all"); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("all"); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setDatePreset("all"); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline">Clear dates</button>
          )}
        </div>
        <p className="text-xs text-gray-400">{total} cart{total !== 1 ? "s" : ""} found</p>
      </div>

      {isSA && selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-red-700">{selected.size} cart{selected.size !== 1 ? "s" : ""} selected</span>
          <button onClick={() => void handleBulkDeleteCarts()} disabled={bulkDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors">
            {bulkDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Bulk Delete Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Deselect</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {carts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No abandoned carts</p>
            <p className="text-xs mt-1 opacity-70">Customers who start filling the order form appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  {isSA && (
                    <th className="px-3 py-3">
                      <button onClick={toggleAllCarts} className="text-gray-400 hover:text-gray-700">
                        {selected.size === carts.length && carts.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                  )}
                  {["Date", "Name", "Mobile", "Address", "Pincode", "Recovery Status", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {carts.map((cart, idx) => (
                  <tr key={cart.id} className={`hover:bg-orange-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} ${selected.has(cart.id) ? "bg-red-50/40" : ""}`}>
                    {isSA && (
                      <td className="px-3 py-3">
                        <button onClick={() => toggleCartSelect(cart.id)} className="text-gray-300 hover:text-gray-600">
                          {selected.has(cart.id) ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtShort(cart.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{cart.name}</div>
                      {cart.email && (
                        <div className="text-[11px] text-gray-400 font-mono truncate max-w-[140px]" title={cart.email}>{cart.email}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <a href={`tel:+91${cart.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-mono">
                        <Phone className="w-3 h-3" /> {cart.phone}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-[140px] truncate">{cart.address ?? "—"}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{cart.pincode ?? "—"}</td>
                    <td className="px-3 py-3">
                      <RecoverySelect cartId={cart.id} current={cart.recoveryStatus} onUpdate={(id, s) => setCarts((prev) => prev.map((c) => c.id === id ? { ...c, recoveryStatus: s } : c))} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => void handleWA(cart)} disabled={waLoading === cart.id} title="Send WhatsApp"
                          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 disabled:opacity-50">
                          {waLoading === cart.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        </button>
                        <a href={`https://wa.me/91${cart.phone}?text=${encodeURIComponent(`नमस्ते ${cart.name} जी! आपने KamaSutra Gold+ का ऑर्डर अधूरा छोड़ा। अभी ₹999 में ऑर्डर करें prakritiherbs.in`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200">
                          WhatsApp
                        </a>
                        {cart.recoveryStatus !== "Recovered" && (
                          <button onClick={() => void handleRecover(cart)} disabled={recoverLoading === cart.id} title="Create order from this cart"
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors">
                            {recoverLoading === cart.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                            Recover
                          </button>
                        )}
                        {isSA && (
                          deleteConfirm === cart.id ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => void handleDeleteCart(cart.id)} disabled={deleting === cart.id}
                                className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 whitespace-nowrap">
                                {deleting === cart.id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : "✓ हाँ"}
                              </button>
                              <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">नहीं</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(cart.id)} title="Delete cart"
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => void load(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Downloads ─── */
const SOURCES = ["All Sources", "Facebook", "Instagram", "WhatsApp", "Direct"];

function toISTDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
}

function filterLabel(f: ReportFilters): string {
  const parts: string[] = [];
  if (f.dateFrom || f.dateTo) parts.push(`${f.dateFrom ?? ""}–${f.dateTo ?? ""}`);
  if (f.source && f.source !== "All Sources") parts.push(f.source);
  if (f.repeatOnly) parts.push("Repeat only");
  return parts.join(" | ") || "All data";
}

function getPresetDatesR(preset: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const ist = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (preset === "today") { const t = ist(now); return { dateFrom: t, dateTo: t }; }
  if (preset === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1); const ys = ist(y);
    return { dateFrom: ys, dateTo: ys };
  }
  if (preset === "this_week") {
    const day = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return { dateFrom: ist(mon), dateTo: ist(now) };
  }
  if (preset === "this_month") {
    const fm = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: ist(fm), dateTo: ist(now) };
  }
  if (preset === "last_month") {
    const fm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lm = new Date(now.getFullYear(), now.getMonth(), 0);
    return { dateFrom: ist(fm), dateTo: ist(lm) };
  }
  return { dateFrom: "", dateTo: "" };
}

function DownloadsPage() {
  const [downloads, setDownloads] = useState<AdminDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [redownloading, setRedownloading] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState<DeleteAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const isSA = isSuperAdmin();

  /* modal filter state */
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [source, setSource] = useState("All Sources");
  const [orderType, setOrderType] = useState<"orders" | "abandoned">("orders");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");

  function loadHistory() { setLoading(true); fetchDownloads().then(setDownloads).finally(() => setLoading(false)); }
  useEffect(loadHistory, []);

  async function loadAuditLog() {
    setAuditLoading(true);
    try { const r = await fetchDeleteAuditLog(); setAuditLog(r); }
    catch { alert("Failed to load audit log"); }
    finally { setAuditLoading(false); }
  }

  function toggleAuditLog() {
    if (!showAuditLog && auditLog.length === 0) void loadAuditLog();
    setShowAuditLog((v) => !v);
  }

  function handlePreset(p: string) {
    setDatePreset(p);
    if (p !== "all") { const { dateFrom: df, dateTo: dt } = getPresetDatesR(p); setDateFrom(df); setDateTo(dt); }
    else { setDateFrom(""); setDateTo(""); }
  }

  async function generateReport(filters: ReportFilters, silent = false): Promise<void> {
    const src = filters.source === "All Sources" ? undefined : filters.source;
    const now = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 10).replace(/\//g, "-");

    if (filters.orderType === "orders") {
      const r = await fetchOrders({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, page: 1, limit: 5000 });
      let orders = r.orders;
      if (src) orders = orders.filter((o) => (o.visitorSource ?? "Direct") === src);
      if (filters.repeatOnly) orders = orders.filter((o) => o.isRepeat);
      const fn = `prakriti_orders_${now}.${filters.format}`;
      if (filters.format === "xlsx") exportOrdersToXLSX(orders, fn);
      else exportOrdersToCSV(orders, fn);
      if (!silent) await logDownload(fn, orders.length, filters);
      return;
    } else {
      const r = await fetchAbandonedCarts({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, page: 1, limit: 5000 });
      let carts = r.carts;
      if (src) carts = carts.filter((c) => (c.source ?? "Direct") === src);
      const fn = `prakriti_abandoned_${now}.${filters.format}`;
      if (filters.format === "xlsx") exportAbandonedCartsToXLSX(carts, fn);
      else exportAbandonedCartsToCSV(carts, fn);
      if (!silent) await logDownload(fn, carts.length, filters);
      return;
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const filters: ReportFilters = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, source, orderType, repeatOnly: orderType === "orders" ? repeatOnly : false, format };
      await generateReport(filters);
      setShowModal(false);
      loadHistory();
    } catch (e) { alert(e instanceof Error ? e.message : "Generation failed"); }
    finally { setGenerating(false); }
  }

  async function handleRedownload(dl: AdminDownload) {
    const filters = parseDownloadFilters(dl);
    if (!filters) { alert("This entry was created before structured filters were added. Cannot re-generate."); return; }
    setRedownloading(dl.id);
    try { await generateReport(filters, true); }
    catch (e) { alert(e instanceof Error ? e.message : "Download failed"); }
    finally { setRedownloading(null); }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try { await deleteDownload(id); setDownloads((prev) => prev.filter((d) => d.id !== id)); }
    catch { alert("Delete failed"); }
    finally { setDeleting(null); setDeleteConfirm(null); }
  }

  const STAT_COLS = "px-4 py-3 text-xs";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Downloads</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate and manage your data export reports</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95"
          style={{ background: `linear-gradient(135deg, ${G}, #2e7d32)`, color: "#fff" }}>
          <PlusCircle className="w-4 h-4" /> Generate New Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Exports", value: downloads.length, icon: <History className="w-4 h-4" />, color: "bg-white border-gray-200" },
          { label: "Order Reports", value: downloads.filter((d) => d.filename.includes("orders")).length, icon: <Package className="w-4 h-4 text-green-600" />, color: "bg-green-50 border-green-200" },
          { label: "Cart Reports", value: downloads.filter((d) => d.filename.includes("abandoned")).length, icon: <ShoppingCart className="w-4 h-4 text-orange-600" />, color: "bg-orange-50 border-orange-200" },
        ].map((c) => (
          <div key={c.label} className={`${c.color} border rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">{c.icon}</div>
            <div><p className="text-xs text-gray-500">{c.label}</p><p className="text-lg font-bold text-gray-900">{c.value}</p></div>
          </div>
        ))}
      </div>

      {/* History table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Download History</span>
          <button onClick={loadHistory} disabled={loading} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : downloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-gray-400">
            <History className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No reports generated yet</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-xs font-semibold underline" style={{ color: G }}>Generate your first report</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#f8f9fa" }}>
                <tr>
                  {["Date & Time (IST)", "Report Type", "Filters", "Records", "Format", "Action", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {downloads.map((dl) => {
                  const pf = parseDownloadFilters(dl);
                  const isXlsx = dl.filename.endsWith(".xlsx");
                  const isCsv = dl.filename.endsWith(".csv");
                  return (
                    <tr key={dl.id} className="hover:bg-gray-50 transition-colors">
                      <td className={`${STAT_COLS} text-gray-600 whitespace-nowrap`}>{toISTDate(dl.downloadedAt)}</td>
                      <td className={STAT_COLS}>
                        {pf ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${pf.orderType === "orders" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                            {pf.orderType === "orders" ? <Package className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
                            {pf.orderType === "orders" ? "Orders" : "Abandoned Carts"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono truncate max-w-[120px] block">{dl.filename}</span>
                        )}
                      </td>
                      <td className={`${STAT_COLS} text-gray-500 max-w-[200px]`}>
                        {pf ? filterLabel(pf) : (dl.filters ?? "—")}
                      </td>
                      <td className={STAT_COLS}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{dl.recordCount} rows</span>
                      </td>
                      <td className={STAT_COLS}>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${isXlsx ? "text-green-700" : isCsv ? "text-blue-600" : "text-red-600"}`}>
                          {isXlsx ? <FileSpreadsheet className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                          {isXlsx ? "XLSX" : isCsv ? "CSV" : "PDF"}
                        </span>
                      </td>
                      <td className={STAT_COLS}>
                        <button onClick={() => void handleRedownload(dl)} disabled={redownloading === dl.id || !pf}
                          title={pf ? "Re-download this report" : "Cannot re-generate (old format)"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: "#e8f5e9", color: G, borderColor: "#a5d6a7" }}>
                          {redownloading === dl.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Download
                        </button>
                      </td>
                      <td className={STAT_COLS}>
                        {deleteConfirm === dl.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => void handleDelete(dl.id)} disabled={deleting === dl.id}
                              className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600">
                              {deleting === dl.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Confirm"}
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(dl.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete this entry">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Audit Log — super admin only */}
      {isSA && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={toggleAuditLog}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Delete Audit Log</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Super Admin Only</span>
            </div>
            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${showAuditLog ? "rotate-90" : ""}`} />
          </button>
          {showAuditLog && (
            <div className="border-t border-gray-100">
              {auditLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading audit log…
                </div>
              ) : auditLog.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No deletions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead style={{ background: "#f8f9fa" }}>
                      <tr>
                        {["When", "Entity", "Ref / Name", "Deleted By"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLog.map((entry) => (
                        <tr key={entry.id} className="hover:bg-red-50/30">
                          <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{toISTDate(entry.deletedAt)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${entry.entityType === "order" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                              {entry.entityType}
                            </span>
                            <span className="ml-1.5 text-gray-400 font-mono">#{entry.entityId}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 font-medium">{entry.entityRef || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-500 font-mono">{entry.deletedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">Last 500 deletions — oldest entries auto-purged</p>
                    <button onClick={() => void loadAuditLog()} className="text-[11px] text-gray-400 hover:text-gray-600 underline flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Generate Report Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Generate New Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Choose filters and download your report instantly</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-5">

                {/* Order Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Report Type</label>
                  <div className="flex gap-3">
                    {([["orders", "Confirmed Orders", <Package key="o" className="w-4 h-4" />], ["abandoned", "Abandoned Carts", <ShoppingCart key="a" className="w-4 h-4" />]] as const).map(([val, lbl, ico]) => (
                      <button key={val} onClick={() => { setOrderType(val as "orders" | "abandoned"); if (val === "abandoned") setRepeatOnly(false); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${orderType === val ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        {ico} {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    <CalendarRange className="inline w-3.5 h-3.5 mr-1" />Date Range
                  </label>
                  <select value={datePreset} onChange={(e) => handlePreset(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white mb-2 focus:outline-none focus:ring-2 focus:ring-green-500/30">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_month">Last Month</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all"); }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                    <span className="text-gray-400 text-xs">to</span>
                    <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("all"); }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
                  </div>
                </div>

                {/* Source/Channel */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    <Globe className="inline w-3.5 h-3.5 mr-1" />Channel / Source
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCES.map((s) => (
                      <button key={s} onClick={() => setSource(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${source === s ? "text-white border-transparent" : "border-gray-300 text-gray-600 hover:border-gray-400"}`}
                        style={source === s ? { background: G } : {}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repeat Customers — only for orders */}
                {orderType === "orders" && (
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div onClick={() => setRepeatOnly((v) => !v)}
                        className={`w-10 h-5 rounded-full transition-colors flex items-center ${repeatOnly ? "bg-green-600" : "bg-gray-300"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${repeatOnly ? "translate-x-5" : "translate-x-0"}`} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-gray-800 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Repeat Customers Only</span>
                        <span className="text-xs text-gray-500">Include only customers who ordered more than once</span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Format */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">File Format</label>
                  <div className="flex gap-3">
                    {([["xlsx", "Excel (.xlsx)", <FileSpreadsheet key="x" className="w-4 h-4" />, "text-green-700 border-green-300 bg-green-50"], ["csv", "CSV", <FileText key="c" className="w-4 h-4" />, "text-blue-700 border-blue-300 bg-blue-50"]] as const).map(([val, lbl, ico, cls]) => (
                      <button key={val} onClick={() => setFormat(val as "xlsx" | "csv")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${format === val ? cls + " border-opacity-100" : "border-gray-200 text-gray-500"}`}
                        style={format === val ? {} : {}}>
                        {ico} {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-700">Report Preview:</p>
                  <p>• Type: <strong>{orderType === "orders" ? "Confirmed Orders" : "Abandoned Carts"}</strong></p>
                  <p>• Date: <strong>{dateFrom || dateTo ? `${dateFrom || "any"} → ${dateTo || "any"}` : "All Time"}</strong></p>
                  <p>• Channel: <strong>{source}</strong>{repeatOnly ? " | Repeat customers only" : ""}</p>
                  <p>• Format: <strong>{format.toUpperCase()}</strong></p>
                  <p>• Columns: DATE · NAME · MOBILE · ADDRESS · CITY · PINCODE · STATE · SOURCE{orderType === "orders" ? " · AMOUNT · STATUS · REPEAT" : " · RECOVERY STATUS"}</p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
                  <button onClick={() => void handleGenerate()} disabled={generating}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 transition-all"
                    style={{ background: `linear-gradient(135deg, ${G}, #2e7d32)` }}>
                    {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><Download className="w-4 h-4" /> Generate &amp; Download</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main Shell ─── */
export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const VALID_PAGES: Page[] = ["home", "orders", "abandoned", "analytics", "marketing", "settings", "downloads"];
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem("admin_page") as Page | null;
    return saved && VALID_PAGES.includes(saved) ? saved : "home";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const adminUser = localStorage.getItem("admin_user") ?? "Admin";

  useEffect(() => {
    if (!isAdminLoggedIn()) { setLocation("/admin/login"); return; }
    Promise.all([
      fetchOrders({ page: 1, limit: 1 }).then((r) => setStats(r.stats)).catch(() => {}),
      fetchAnalytics().then((a) => { setAnalytics(a); setAbandonedCount(a.abandonedStats.new); }).catch(() => {}),
      fetchSettings().then((s) => setSettings(s.settings)).catch(() => {}),
    ]).finally(() => setHomeLoading(false));
  }, [setLocation]);

  function handleLogout() { clearAdminToken(); setLocation("/admin/login"); }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault(); setGlobalSearch(searchInput); setPage("orders");
  }

  function navigateTo(p: Page) {
    if (p === "abandoned") setAbandonedCount(0);
    localStorage.setItem("admin_page", p);
    setPage(p);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar page={page} setPage={navigateTo} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
        adminUser={adminUser} onLogout={handleLogout} badgeCounts={{ abandoned: abandonedCount }} />

      <div className="flex-1 flex flex-col lg:ml-56 min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700 flex-shrink-0">
            <Menu className="w-5 h-5" />
          </button>
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search orders by name or mobile..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:bg-white transition-colors" />
            </div>
          </form>
          <span className="text-xs text-gray-500 hidden md:block">Welcome, {adminUser}</span>
        </header>

        <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, transparent, ${GOLD} 30%, #e8c96a 50%, ${GOLD} 70%, transparent)` }} />

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {page === "home" && <HomePage stats={stats} analytics={analytics} loading={homeLoading} />}
          {page === "orders" && <AdminOrders globalSearch={globalSearch} settings={settings} />}
          {page === "abandoned" && <AbandonedCartsPage />}
          {page === "analytics" && <AdminAnalytics />}
          {page === "marketing" && <AdminMarketing />}
          {page === "lead-tracking" && <AdminLeadTracking />}
          {page === "event-tracking" && <AdminEventTracking />}
          {page === "settings" && <AdminSettings />}
          {page === "downloads" && <DownloadsPage />}
        </main>
      </div>
    </div>
  );
}
