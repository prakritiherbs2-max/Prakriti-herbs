import { useState, useEffect, useCallback } from "react";
import {
  fetchEventTracking,
  type EventTrackingEntry,
  type EventTrackingSummary,
} from "@/lib/adminApi";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Fingerprint } from "lucide-react";

const G = "#1B5E20";

function toISTDate(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: EventTrackingEntry["status"] }) {
  if (status === "Matched")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Matched
      </span>
    );
  if (status === "Missing")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Missing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
      <AlertTriangle className="w-3 h-3" /> Duplicate
    </span>
  );
}

export function AdminEventTracking() {
  const now = new Date();
  const [entries, setEntries] = useState<EventTrackingEntry[]>([]);
  const [summary, setSummary] = useState<EventTrackingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(toISTDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(toISTDate(now));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEventTracking({
        source: sourceFilter.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setEntries(result.data);
      setSummary(result.summary);
    } catch {
      setError("डेटा load नहीं हो सका। कृपया retry करें।");
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const matchRate = summary && summary.total > 0
    ? Math.round((summary.matched / summary.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Fingerprint className="w-5 h-5" style={{ color: G }} />
            Event Match Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Meta Pixel + CAPI event_id coverage per order
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-3xl font-black text-gray-900 mt-1">{summary.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-4">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Matched</p>
            <p className="text-3xl font-black text-green-700 mt-1">{summary.matched}</p>
            <p className="text-xs text-green-500 mt-0.5">{matchRate}% coverage</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-4">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Missing</p>
            <p className="text-3xl font-black text-red-700 mt-1">{summary.missing}</p>
            <p className="text-xs text-red-400 mt-0.5">No event_id tracked</p>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Duplicate</p>
            <p className="text-3xl font-black text-yellow-700 mt-1">{summary.duplicate}</p>
            <p className="text-xs text-yellow-500 mt-0.5">Same event_id reused</p>
          </div>
        </div>
      )}

      {/* Coverage Bar */}
      {summary && summary.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Deduplication Coverage</p>
            <p className="text-sm font-bold" style={{ color: matchRate >= 80 ? G : matchRate >= 50 ? "#D97706" : "#DC2626" }}>
              {matchRate}%
            </p>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${summary.total > 0 ? (summary.matched / summary.total) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${summary.total > 0 ? (summary.duplicate / summary.total) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all duration-500"
              style={{ width: `${summary.total > 0 ? (summary.missing / summary.total) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Matched</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Duplicate</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Missing</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Source</label>
            <input
              type="text"
              placeholder="e.g. taj, default"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 w-36 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={() => { setSourceFilter(""); const n = new Date(); setDateFrom(toISTDate(new Date(n.getFullYear(), n.getMonth(), 1))); setDateTo(toISTDate(n)); }}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>
        )}
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Fingerprint className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No orders found</p>
            <p className="text-xs mt-1">Try adjusting the filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Event ID</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <tr key={entry.orderId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{entry.orderId}</td>
                    <td className="px-4 py-3 text-gray-700">+91 {entry.phone}</td>
                    <td className="px-4 py-3">
                      {entry.eventId ? (
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded max-w-[160px] truncate block" title={entry.eventId}>
                          {entry.eventId.slice(0, 16)}…
                        </span>
                      ) : (
                        <span className="text-xs text-red-400 italic">— not captured —</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 uppercase">
                        {entry.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
            Showing {entries.length} order{entries.length !== 1 ? "s" : ""}
            {loading && " · Refreshing…"}
          </div>
        )}
      </div>
    </div>
  );
}
