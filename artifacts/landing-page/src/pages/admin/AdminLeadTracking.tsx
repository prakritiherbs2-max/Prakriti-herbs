import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import {
  fetchLeadTracking, exportLeadTracking,
  updateLead, deleteLead, bulkDeleteLeads, cleanupLeads,
  type LeadEntry, type LeadFilters,
} from "@/lib/adminApi";
import {
  RefreshCw, Phone, MessageCircle, Download, PhoneCall,
  ChevronLeft, ChevronRight, Pencil, Trash2, CheckSquare,
  Square, AlertTriangle, Eraser, X, Save,
} from "lucide-react";

const G = "#1B5E20";
const CALL_STATUSES = ["all", "clicked", "missed", "answered", "called_back"];
const EDIT_STATUSES = ["clicked", "missed", "answered", "called_back"];
const TYPES = ["all", "call", "whatsapp"];
const LIMIT = 50;

/* ── helpers ── */
function toISTDate(d: Date) { return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); }
function fmtDT(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── badges ── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    clicked: "bg-blue-100 text-blue-700", missed: "bg-red-100 text-red-700",
    answered: "bg-green-100 text-green-700", called_back: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}
function TypeBadge({ type }: { type: string }) {
  if (type === "call") return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
      <Phone className="w-3 h-3" /> Call
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
      <MessageCircle className="w-3 h-3" /> WhatsApp
    </span>
  );
}

/* ── Excel download ── */
async function downloadExcel(filters: LeadFilters) {
  const result = await exportLeadTracking(filters);
  const rows = result.data;
  function fmtRow(r: LeadEntry) {
    return {
      "DATE": new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      "TYPE": r.type.toUpperCase(), "STATUS": r.call_status.toUpperCase(),
      "MOBILE": r.customer_phone ?? "", "SOURCE": r.source.toUpperCase(),
      "NOTES": r.notes ?? "", "EVENT_ID": r.event_id ?? "",
      "CALL_DURATION": r.call_duration ?? "", "PAGE_URL": r.page_url ?? "",
      "LANDING_PAGE": r.landing_page ?? "", "CAMPAIGN_NAME": r.campaign_name ?? "",
      "ADSET_NAME": r.adset_name ?? "", "AD_NAME": r.ad_name ?? "",
      "DEVICE_TYPE": r.device_type ?? "", "BROWSER": r.browser ?? "",
      "IP_ADDRESS": r.ip_address ?? "", "REFERRER": r.referrer ?? "",
      "CITY": r.city ?? "", "STATE": r.state ?? "",
      "COUNTRY": r.country ?? "India", "USER_AGENT": r.user_agent ?? "",
    };
  }
  const allSheet = XLSX.utils.json_to_sheet(rows.map(fmtRow));
  const missedSheet = XLSX.utils.json_to_sheet(rows.filter((r) => r.call_status === "missed").map(fmtRow));
  const waSheet = XLSX.utils.json_to_sheet(rows.filter((r) => r.type === "whatsapp").map(fmtRow));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, allSheet, "All Data");
  XLSX.utils.book_append_sheet(wb, missedSheet, "Missed Calls");
  XLSX.utils.book_append_sheet(wb, waSheet, "WhatsApp Leads");
  XLSX.writeFile(wb, `Lead_Tracking_${new Date().toLocaleDateString("en-CA")}.xlsx`);
}

/* ── Edit Modal ── */
function EditLeadModal({
  lead, onClose, onSave,
}: { lead: LeadEntry; onClose: () => void; onSave: (updated: LeadEntry) => void }) {
  const [phone, setPhone] = useState(lead.customer_phone ?? "");
  const [status, setStatus] = useState(lead.call_status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const result = await updateLead(lead.id, {
        customerPhone: phone.trim() || undefined,
        callStatus: status,
        notes: notes.trim(),
      });
      onSave(result.lead as unknown as LeadEntry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Pencil className="w-4 h-4" style={{ color: G }} />
            Edit Lead #{lead.id}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {EDIT_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ").toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirm ── */
function DeleteConfirm({
  count, onConfirm, onCancel, loading,
}: { count: number; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Delete {count > 1 ? `${count} leads` : "this lead"}?</h3>
        <p className="text-xs text-gray-500 mb-5">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50"
          >
            {loading ? "Deleting…" : "Yes, Delete"}
          </button>
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Cleanup Modal ── */
function CleanupModal({ onClose, onDone }: { onClose: () => void; onDone: (deleted: number) => void }) {
  const [days, setDays] = useState(30);
  const [missedOnly, setMissedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function handleCleanup() {
    setLoading(true); setError("");
    try {
      const r = await cleanupLeads(days, missedOnly);
      setResult(r.deleted);
      onDone(r.deleted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cleanup failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Eraser className="w-4 h-4 text-orange-500" />
            Delete Old Data
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result !== null ? (
          <div className="text-center py-4">
            <p className="text-3xl font-black text-red-600">{result}</p>
            <p className="text-sm text-gray-500 mt-1">leads deleted successfully</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 text-sm font-semibold text-white rounded-xl" style={{ background: G }}>
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Delete leads older than (days)</label>
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 30))}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={missedOnly}
                onChange={(e) => setMissedOnly(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Only delete <strong>missed calls</strong></span>
            </label>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs text-orange-700">
                ⚠️ Will delete {missedOnly ? "missed call" : "all"} leads older than {days} days. This is permanent.
              </p>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => void handleCleanup()}
                disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl disabled:opacity-50"
              >
                {loading ? "Cleaning…" : "Delete Old Data"}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function AdminLeadTracking() {
  const now = new Date();
  const [entries, setEntries] = useState<LeadEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(toISTDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(toISTDate(now));

  // Debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Modals
  const [editLead, setEditLead] = useState<LeadEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: number[]; mode: "single" | "bulk" } | null>(null);
  const [deletingIds, setDeletingIds] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filters: LeadFilters = {
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    source: sourceFilter.trim() || undefined,
    phone: phoneFilter.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const r = await fetchLeadTracking({ ...filters, page: pg, limit: LIMIT });
      setEntries(r.data);
      setTotal(r.total);
      setPage(pg);
      setSelected(new Set());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [typeFilter, statusFilter, sourceFilter, phoneFilter, dateFrom, dateTo]); // eslint-disable-line

  // Debounced load when text inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void load(1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [sourceFilter, phoneFilter]); // eslint-disable-line

  // Immediate load for dropdowns / dates
  useEffect(() => { void load(1); }, [typeFilter, statusFilter, dateFrom, dateTo]); // eslint-disable-line

  /* ── Selection helpers ── */
  function toggleOne(id: number) {
    setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    setSelected((p) => p.size === entries.length ? new Set() : new Set(entries.map((e) => e.id)));
  }

  /* ── Actions ── */
  async function handleCallBack(id: number) {
    setUpdatingId(id);
    try {
      await updateLead(id, { callStatus: "called_back" });
      setEntries((prev) => prev.map((e) => e.id === id ? { ...e, call_status: "called_back" } : e));
    } catch { /* ignore */ }
    finally { setUpdatingId(null); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingIds(true);
    try {
      if (deleteTarget.mode === "single") {
        await deleteLead(deleteTarget.ids[0]!);
        setEntries((p) => p.filter((e) => e.id !== deleteTarget.ids[0]));
        setTotal((t) => t - 1);
      } else {
        const r = await bulkDeleteLeads(deleteTarget.ids);
        const delSet = new Set(deleteTarget.ids);
        setEntries((p) => p.filter((e) => !delSet.has(e.id)));
        setTotal((t) => t - r.deleted);
        setSelected(new Set());
      }
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeletingIds(false); setDeleteTarget(null); }
  }

  function handleEditSave(updated: LeadEntry) {
    setEntries((p) => p.map((e) => e.id === updated.id ? { ...e, ...updated } : e));
    setEditLead(null);
  }

  async function handleExport() {
    setExporting(true);
    try { await downloadExcel(filters); } catch { alert("Export failed"); }
    finally { setExporting(false); }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const callCount = entries.filter((e) => e.type === "call").length;
  const waCount = entries.filter((e) => e.type === "whatsapp").length;
  const missedCount = entries.filter((e) => e.call_status === "missed").length;
  const allSelected = entries.length > 0 && selected.size === entries.length;

  return (
    <div className="space-y-5">
      {/* Modals */}
      {editLead && (
        <EditLeadModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSave={handleEditSave}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          count={deleteTarget.ids.length}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
          loading={deletingIds}
        />
      )}
      {showCleanup && (
        <CleanupModal
          onClose={() => setShowCleanup(false)}
          onDone={() => { void load(1); setShowCleanup(false); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5" style={{ color: G }} />
            Lead Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Call + WhatsApp interactions — edit, delete, cleanup</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void load(1)} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => void handleExport()} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Excel"}
          </button>
          <button
            onClick={() => setShowCleanup(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all"
          >
            <Eraser className="w-4 h-4" />
            Delete Old Data
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", val: total, cls: "bg-white border-gray-200", v: "text-gray-900" },
          { label: "Calls", val: callCount, cls: "bg-orange-50 border-orange-200", v: "text-orange-700" },
          { label: "WhatsApp", val: waCount, cls: "bg-green-50 border-green-200", v: "text-green-700" },
          { label: "Missed", val: missedCount, cls: "bg-red-50 border-red-200", v: "text-red-700" },
        ].map(({ label, val, cls, v }) => (
          <div key={label} className={`rounded-xl border p-4 ${cls}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-black mt-1 ${v}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              {TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All Types" : t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500">
              {CALL_STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "All Status" : s.replace("_", " ").toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Source</label>
            <input type="text" placeholder="taj, direct…" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 w-28 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Phone</label>
            <input type="text" placeholder="10-digit…" value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 w-32 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <button
            onClick={() => {
              setTypeFilter("all"); setStatusFilter("all"); setSourceFilter(""); setPhoneFilter("");
              const n = new Date(); setDateFrom(toISTDate(new Date(n.getFullYear(), n.getMonth(), 1))); setDateTo(toISTDate(n));
            }}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >Reset</button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm font-semibold text-red-700">{selected.size} lead{selected.size > 1 ? "s" : ""} selected</span>
          <button
            onClick={() => setDeleteTarget({ ids: [...selected], mode: "bulk" })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No lead interactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-3 w-8">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-gray-600">
                      {allSelected ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <tr key={entry.id}
                    className={`hover:bg-gray-50 transition-colors ${selected.has(entry.id) ? "bg-blue-50/30" : entry.call_status === "missed" ? "bg-red-50/40" : entry.type === "whatsapp" ? "bg-green-50/30" : ""}`}>
                    <td className="px-3 py-3">
                      <button onClick={() => toggleOne(entry.id)} className="text-gray-400 hover:text-gray-600">
                        {selected.has(entry.id)
                          ? <CheckSquare className="w-4 h-4 text-blue-600" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDT(entry.created_at)}</td>
                    <td className="px-4 py-3"><TypeBadge type={entry.type} /></td>
                    <td className="px-4 py-3 font-semibold text-gray-700">
                      {entry.customer_phone ? `+91 ${entry.customer_phone}` : <span className="text-gray-400 italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 uppercase">{entry.source}</span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={entry.call_status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px] truncate">
                      {entry.notes || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {entry.type === "call" && entry.call_status !== "called_back" && entry.call_status !== "answered" && (
                          <button
                            onClick={() => void handleCallBack(entry.id)}
                            disabled={updatingId === entry.id}
                            title="Mark Called Back"
                            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-white rounded-lg disabled:opacity-50"
                            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
                          >
                            <Phone className="w-3 h-3" />
                            {updatingId === entry.id ? "…" : "CB"}
                          </button>
                        )}
                        <button
                          onClick={() => setEditLead(entry)}
                          title="Edit"
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ ids: [entry.id], mode: "single" })}
                          title="Delete"
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => void load(page - 1)} disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs font-semibold text-gray-700">{page} / {totalPages}</span>
              <button onClick={() => void load(page + 1)} disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
        {entries.length > 0 && total <= LIMIT && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
            {total} lead{total !== 1 ? "s" : ""}{loading && " · Refreshing…"}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 mb-1">Excel Export — 3 Sheets (21 columns)</p>
        <p className="text-xs text-blue-600">Sheet 1: All Data · Sheet 2: Missed Calls · Sheet 3: WhatsApp Leads</p>
      </div>
    </div>
  );
}
