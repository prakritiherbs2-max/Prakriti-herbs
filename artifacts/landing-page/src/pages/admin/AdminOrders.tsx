import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchOrders, updateOrderStatus, exportOrdersToXLSX, exportSingleOrderToXLSX,
  exportSingleOrderToPDF, exportOrdersToPDF, exportOrdersToCSV, logDownload,
  bulkUpdateOrderStatus, shipViaShinprocket, updateIndiaPostTracking,
  sendWhatsAppToOrder, shipViaShadowfax, getShadowfaxLabel,
  deleteOrder, bulkDeleteOrders, isSuperAdmin, updateOrderFull,
  fetchTrashOrders, restoreOrdersFromTrash, emptyTrash, permanentDeleteOrder,
  type Order, type OrderStats, type TrashOrder,
} from "@/lib/adminApi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search, RefreshCw, Download, Filter, FileSpreadsheet, FileText,
  ChevronLeft, ChevronRight, Package, CheckSquare, Square, AlertCircle,
  Printer, Truck, MessageSquare, Star, X, Zap, ExternalLink, Tag, Trash2, Pencil, Save,
} from "lucide-react";

const G = "#1B5E20";
const GOLD = "#C9A14A";
const ALL_STATUSES = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-200",
  Confirmed: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Shipped: "bg-purple-100 text-purple-700 border-purple-200",
  Delivered: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
};

function fmtIST(d: string) {
  const dt = new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return dt.replace(/(\d{2})\/(\d{2})\/(\d{4}),?\s/, "$3-$2-$1 ");
}
function fmtShort(d: string) {
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusSelect({ orderId, currentStatus, onUpdate }: { orderId: number; currentStatus: string; onUpdate: (id: number, s: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = e.target.value; if (s === currentStatus) return;
    setLoading(true);
    try { await updateOrderStatus(orderId, s); onUpdate(orderId, s); }
    catch (err) { alert(err instanceof Error ? err.message : "Update failed"); }
    finally { setLoading(false); }
  }
  const cls = STATUS_COLORS[currentStatus] ?? "bg-gray-100 text-gray-700";
  return (
    <select value={currentStatus} onChange={handleChange} disabled={loading}
      className={`text-xs font-semibold border rounded-full px-2.5 py-1 cursor-pointer focus:outline-none ${cls}`}>
      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function IndiaPostModal({ orderId, onClose, onSave }: { orderId: number; onClose: () => void; onSave: (id: number, track: string) => void }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!val.trim()) return;
    setSaving(true);
    try { await updateIndiaPostTracking(orderId, val.trim()); onSave(orderId, val.trim()); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">India Post Tracking</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Enter the India Post consignment number for this order.</p>
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="e.g. EM123456789IN"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
          <button onClick={save} disabled={saving || !val.trim()}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: G }}>
            {saving ? "Saving..." : "Save Tracking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const defaultMsg = `नमस्ते ${order.name} जी! आपका KamaSutra Gold+ ऑर्डर #${order.orderId} ${order.status} है। - Prakriti Herbs`;
  const [msg, setMsg] = useState(defaultMsg);
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    try { await sendWhatsAppToOrder(order.id, msg); alert("✅ WhatsApp message sent!"); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "WhatsApp send failed"); }
    finally { setSending(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-green-600" /> Send WhatsApp</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-1">To: <strong>+91{order.phone}</strong> ({order.name})</p>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 mb-4 resize-none" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Cancel</button>
          <button onClick={send} disabled={sending}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#25D366" }}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function printGSTInvoice(order: Order, settings: Record<string, string>) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(27, 94, 32); doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(201, 161, 74); doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("PRAKRITI HERBS PRIVATE LIMITED", 105, 12, { align: "center" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(255, 255, 255);
  doc.text(`GSTIN: ${settings["gst_number"] ?? "[GSTIN Not Set]"} | PAN: ${settings["company_pan"] ?? "[PAN Not Set]"}`, 105, 19, { align: "center" });
  doc.text("contact@prakritiherbs.in | +91 89681 22246 | prakritiherbs.in", 105, 25, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", 105, 44, { align: "center" });

  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  const d = new Date(order.createdAt);
  const invoiceDate = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "long", year: "numeric" });
  const invoiceTime = d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  doc.text(`Invoice No: INV-${order.orderId}`, 14, 54);
  doc.text(`Date: ${invoiceDate} ${invoiceTime} (IST)`, 14, 60);
  doc.text(`Order ID: ${order.orderId}`, 14, 66);
  if (order.paymentId) doc.text(`Payment ID: ${order.paymentId}`, 14, 72);
  if (order.paymentMethod) doc.text(`Payment Mode: ${order.paymentMethod}`, 14, 78);

  doc.setFont("helvetica", "bold"); doc.text("Bill To:", 120, 54);
  doc.setFont("helvetica", "normal");
  doc.text(order.name, 120, 60);
  doc.text(`Ph: ${order.phone}`, 120, 66);
  const addrLines = doc.splitTextToSize(order.address, 70);
  doc.text(addrLines, 120, 72);
  doc.text(`PIN: ${order.pincode}`, 120, 72 + addrLines.length * 5);

  const amt = 999 * order.quantity;
  const gstAmt = Math.round(amt * 18 / 118);
  const baseAmt = amt - gstAmt;
  const igstAmt = gstAmt;

  autoTable(doc, {
    startY: 100,
    head: [["#", "Description", "HSN", "Qty", "Base Rate (₹)", "IGST 18% (₹)", "Total (₹)"]],
    body: [[
      "1", "KamaSutra Gold+ (Ayurvedic)\nPrakriti Herbs", "3004",
      String(order.quantity), `₹${baseAmt.toLocaleString()}`,
      `₹${igstAmt.toLocaleString()}`, `₹${amt.toLocaleString()}`,
    ]],
    foot: [
      ["", "", "", "", "Subtotal", "", `₹${baseAmt.toLocaleString()}`],
      ["", "", "", "", "IGST @ 18%", "", `₹${igstAmt.toLocaleString()}`],
      ["", "", "", "", "TOTAL (COD)", "", `₹${amt.toLocaleString()}`],
    ],
    headStyles: { fillColor: [27, 94, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [245, 250, 245], textColor: [27, 94, 32], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 3 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 160;
  doc.setFontSize(8);
  doc.text("Amount in Words: " + toWords(amt), 14, finalY + 10);
  doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text("Bank Details: [Add your bank details here]", 14, finalY + 18);
  doc.text("Terms: Goods once sold will not be taken back or exchanged.", 14, finalY + 24);

  doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", 150, finalY + 40);
  doc.text(`${settings["director_name"] ?? "Director"}`, 150, finalY + 47);
  doc.text("Prakriti Herbs Private Limited", 150, finalY + 53);
  doc.line(135, finalY + 36, 200, finalY + 36);

  doc.setFontSize(7); doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated invoice. | Subject to Jaipur, Rajasthan Jurisdiction.", 105, 287, { align: "center" });
  doc.save(`invoice_${order.orderId}.pdf`);
}

function toWords(n: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n === 0) return "Zero";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + toWords(n % 100) : "");
  if (n < 100000) return toWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + toWords(n % 1000) : "");
  return n.toLocaleString();
}

function ShadowfaxWarningModal({ pincode, onClose }: { pincode: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Pincode Not Serviceable</h3>
            <p className="text-xs text-gray-500">Shadowfax delivery check failed</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-800 font-semibold">
            ⚠️ Pincode <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">{pincode}</span> is <strong>not serviceable</strong> by Shadowfax.
          </p>
          <p className="text-xs text-red-700 mt-2">
            This customer's delivery area is outside Shadowfax's current coverage. Please use Shiprocket or India Post for this order.
          </p>
        </div>
        <button onClick={onClose}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "#ef4444" }}>
          Understood
        </button>
      </div>
    </div>
  );
}

function RowActions({ order, onShipped, settings }: { order: Order; onShipped: (id: number) => void; settings: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);
  const [showIndiaPost, setShowIndiaPost] = useState(false);
  const [showWA, setShowWA] = useState(false);
  const [sfxWarning, setSfxWarning] = useState<string | null>(null);

  async function handleShiprocket() {
    setOpen(false); setShipLoading(true);
    try {
      const r = await shipViaShinprocket(order.id);
      alert(`✅ Shipped via ${r.courier}!\nAWB: ${r.awb}\n🔗 ${r.trackingUrl}`);
      onShipped(order.id);
    } catch (err) { alert(err instanceof Error ? err.message : "Shiprocket failed"); }
    finally { setShipLoading(false); }
  }

  async function handleShadowfax() {
    setOpen(false); setShipLoading(true);
    try {
      const r = await shipViaShadowfax(order.id);
      alert(`✅ Shipped via Shadowfax!\nAWB: ${r.awb}${r.zone ? `\nZone: ${r.zone}` : ""}\n🔗 ${r.trackingUrl}\n📄 Label URL ready — use "Download Label" in tracking column.`);
      onShipped(order.id);
    } catch (err) {
      const e = err as Error & { serviceable?: boolean; pincode?: string };
      if (e.serviceable === false) {
        setSfxWarning(e.pincode ?? order.pincode);
      } else {
        alert(e.message ?? "Shadowfax shipping failed");
      }
    } finally { setShipLoading(false); }
  }

  return (
    <>
      {sfxWarning && <ShadowfaxWarningModal pincode={sfxWarning} onClose={() => setSfxWarning(null)} />}
      {showIndiaPost && <IndiaPostModal orderId={order.id} onClose={() => setShowIndiaPost(false)} onSave={(_, t) => { alert(`✅ India Post tracking saved: ${t}`); onShipped(order.id); }} />}
      {showWA && <WhatsAppModal order={order} onClose={() => setShowWA(false)} />}

      <div className="flex items-center gap-1">
        <button onClick={() => setShowWA(true)} title="Send WhatsApp"
          className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors">
          <MessageSquare className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <button onClick={() => setOpen((v) => !v)} disabled={shipLoading} title="Download / Ship"
            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            {shipLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 min-w-[210px]">
                <div className="px-3 py-1.5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Download</p>
                </div>
                <button onClick={() => { exportSingleOrderToXLSX(order); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-green-50">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> Excel (.xlsx)
                </button>
                <button onClick={() => { exportSingleOrderToPDF(order); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-red-50">
                  <FileText className="w-3.5 h-3.5 text-red-600" /> PDF
                </button>
                <button onClick={() => { printGSTInvoice(order, settings); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-purple-50">
                  <Printer className="w-3.5 h-3.5 text-purple-600" /> GST Invoice
                </button>
                <div className="px-3 py-1.5 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase">Ship</p>
                </div>
                <button onClick={handleShadowfax}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-orange-50">
                  <Zap className="w-3.5 h-3.5 text-orange-500" />
                  <span>Shadowfax</span>
                  <span className="ml-auto text-orange-400 text-xs font-bold">NEW</span>
                </button>
                <button onClick={handleShiprocket}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">
                  <Truck className="w-3.5 h-3.5 text-blue-600" /> Shiprocket
                </button>
                <button onClick={() => { setShowIndiaPost(true); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-orange-50">
                  <Package className="w-3.5 h-3.5 text-orange-600" /> India Post (Manual)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "all";

function toISTDateStr(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = istNow.getFullYear(), m = istNow.getMonth(), day = istNow.getDate();
  switch (preset) {
    case "today":
      return { from: toISTDateStr(istNow), to: toISTDateStr(istNow) };
    case "yesterday": {
      const yd = new Date(y, m, day - 1);
      return { from: toISTDateStr(yd), to: toISTDateStr(yd) };
    }
    case "this_week": {
      const dow = istNow.getDay(); // 0=Sun
      const mon = new Date(y, m, day - (dow === 0 ? 6 : dow - 1));
      return { from: toISTDateStr(mon), to: toISTDateStr(istNow) };
    }
    case "this_month":
      return { from: toISTDateStr(new Date(y, m, 1)), to: toISTDateStr(istNow) };
    case "last_month": {
      const lm1 = new Date(y, m - 1, 1);
      const lm2 = new Date(y, m, 0);
      return { from: toISTDateStr(lm1), to: toISTDateStr(lm2) };
    }
    default:
      return { from: "", to: "" };
  }
}

/* ── Edit Order Modal ───────────────────────────────────────────────────────── */
function EditOrderModal({
  order, onClose, onSave,
}: { order: Order; onClose: () => void; onSave: (updated: Order) => void }) {
  const [name, setName] = useState(order.name ?? "");
  const [phone, setPhone] = useState(order.phone ?? "");
  const [email, setEmail] = useState(order.email ?? "");
  const [address, setAddress] = useState(order.address ?? "");
  const [city, setCity] = useState(order.city ?? "");
  const [state, setState] = useState(order.state ?? "");
  const [pincode, setPincode] = useState(order.pincode ?? "");
  const [status, setStatus] = useState(order.status ?? "New");
  const [trackingId, setTrackingId] = useState(order.trackingId ?? "");
  const [courier, setCourier] = useState(order.courier ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const result = await updateOrderFull(order.id, {
        name: name.trim(), phone: phone.trim(), email: email.trim(),
        address: address.trim(), city: city.trim(), state: state.trim(),
        pincode: pincode.trim(), status, trackingId: trackingId.trim(), courier: courier.trim(),
      });
      onSave(result.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Pencil className="w-4 h-4" style={{ color: G }} />
            Edit Order #{order.orderId}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Name", value: name, setter: setName, placeholder: "Customer name" },
              { label: "Phone", value: phone, setter: setPhone, placeholder: "10-digit mobile" },
              { label: "Email", value: email, setter: setEmail, placeholder: "email@example.com" },
              { label: "Pincode", value: pincode, setter: setPincode, placeholder: "6-digit" },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                <input type="text" value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Address</label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Full address…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">State</label>
              <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Order Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {["New", "Confirmed", "Shipped", "Delivered", "Cancelled"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Tracking ID</label>
              <input type="text" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="AWB / Tracking no."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Courier</label>
              <input type="text" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Shiprocket, India Post…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-2 rounded-b-2xl">
          <button onClick={() => void handleSave()} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(135deg, ${G}, #2E7D32)` }}>
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function AdminOrders({ globalSearch, settings }: { globalSearch: string; settings: Record<string, string> }) {
  const [tab, setTab] = useState<"orders" | "trash">("orders");

  /* ── Orders tab state ── */
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState(globalSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("Confirmed");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);

  /* ── Trash tab state ── */
  const [trashOrders, setTrashOrders] = useState<TrashOrder[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashSelected, setTrashSelected] = useState<Set<number>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [permDeleting, setPermDeleting] = useState<number | null>(null);
  const [permDelConfirm, setPermDelConfirm] = useState<number | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);

  const isSA = isSuperAdmin();
  const LIMIT = 25;

  const loadOrders = useCallback(async (pg = 1) => {
    setLoading(true); setSelected(new Set());
    try {
      const r = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: pg, limit: LIMIT });
      setOrders(r.orders); setStats(r.stats); setTotal(r.total); setPage(pg);
    } catch { alert("Failed to load orders"); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { void loadOrders(1); }, [loadOrders]);
  useEffect(() => { setSearch(globalSearch); }, [globalSearch]);

  function toggleSelect(id: number) { setSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function toggleAll() { setSelected((p) => p.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))); }

  async function handleBulkUpdate() {
    if (selected.size === 0) return;
    if (!confirm(`Mark ${selected.size} orders as "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try { const r = await bulkUpdateOrderStatus([...selected], bulkStatus); alert(`✅ ${r.updated} orders updated`); void loadOrders(page); }
    catch { alert("Bulk update failed"); }
    finally { setBulkLoading(false); }
  }

  async function handleDeleteOrder(id: number) {
    setDeleting(id);
    try {
      await deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      setTotal((t) => t - 1);
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(null); setDeleteConfirm(null); }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`क्या आप ${selected.size} ऑर्डर Trash में भेजना चाहते हैं?\n\nTrash से बाद में Restore किया जा सकता है।`)) return;
    setBulkDeleting(true);
    try {
      const r = await bulkDeleteOrders([...selected]);
      alert(`✅ ${r.deleted} orders ट्रैश में भेज दिए गए`);
      void loadOrders(page);
    } catch (e) { alert(e instanceof Error ? e.message : "Move to trash failed"); }
    finally { setBulkDeleting(false); }
  }

  /* ── Trash Tab Handlers ── */
  const loadTrash = useCallback(async () => {
    setTrashLoading(true); setTrashSelected(new Set());
    try { const r = await fetchTrashOrders(); setTrashOrders(r.orders); }
    catch { alert("Trash load failed"); }
    finally { setTrashLoading(false); }
  }, []);

  useEffect(() => { if (tab === "trash") void loadTrash(); }, [tab, loadTrash]);

  function toggleTrash(id: number) { setTrashSelected((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function toggleAllTrash() { setTrashSelected((p) => p.size === trashOrders.length ? new Set() : new Set(trashOrders.map((o) => o.id))); }

  async function handleRestore() {
    if (trashSelected.size === 0) return;
    setRestoring(true);
    try {
      const r = await restoreOrdersFromTrash([...trashSelected]);
      alert(`✅ ${r.restored} ऑर्डर वापस restore हो गए`);
      void loadTrash();
    } catch (e) { alert(e instanceof Error ? e.message : "Restore failed"); }
    finally { setRestoring(false); }
  }

  async function handleEmptyTrash() {
    setEmptyConfirm(false); setEmptyingTrash(true);
    try {
      const r = await emptyTrash();
      alert(`🗑️ ${r.deleted} ऑर्डर हमेशा के लिए डिलीट हो गए`);
      void loadTrash();
    } catch (e) { alert(e instanceof Error ? e.message : "Empty trash failed"); }
    finally { setEmptyingTrash(false); }
  }

  async function handlePermDelete(id: number) {
    setPermDelConfirm(null); setPermDeleting(id);
    try {
      await permanentDeleteOrder(id);
      setTrashOrders((prev) => prev.filter((o) => o.id !== id));
    } catch (e) { alert(e instanceof Error ? e.message : "Permanent delete failed"); }
    finally { setPermDeleting(null); }
  }

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    const { from, to } = getPresetDates(preset);
    setDateFrom(from);
    setDateTo(to);
  }

  async function handleExport(type: "xlsx" | "pdf" | "csv") {
    setExporting(true);
    try {
      const r = await fetchOrders({ search, status: statusFilter, dateFrom, dateTo, page: 1, limit: 10000 });
      const now = new Date().toISOString().slice(0, 10);
      const filters = [search && `search=${search}`, statusFilter !== "all" && `status=${statusFilter}`, dateFrom && `from=${dateFrom}`, dateTo && `to=${dateTo}`].filter(Boolean).join(", ") || "all";
      if (type === "xlsx") { const fn = `prakriti_orders_${now}.xlsx`; exportOrdersToXLSX(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
      else if (type === "pdf") { const fn = `prakriti_orders_${now}.pdf`; exportOrdersToPDF(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
      else { const fn = `prakriti_orders_${now}.csv`; exportOrdersToCSV(r.orders, fn); await logDownload(fn, r.orders.length, filters); }
    } catch { alert("Export failed. Please try again."); }
    finally { setExporting(false); }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* ── Edit Order Modal ── */}
      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={(updated) => {
            setOrders((prev) => prev.map((o) => o.id === updated.id ? updated : o));
            setEditOrder(null);
          }}
        />
      )}
      {/* ── Empty Trash Confirmation Modal ── */}
      {emptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Trash खाली करें</h3>
                <p className="text-xs text-gray-500">यह एक्शन वापस नहीं होगा</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              Trash के <strong>{trashOrders.length} ऑर्डर</strong> हमेशा के लिए डिलीट हो जाएंगे।
              यह एक्शन <strong className="text-red-600">पूरी तरह अपरिवर्सनीय</strong> है।
            </p>
            <div className="flex gap-2">
              <button onClick={() => setEmptyConfirm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">रद्द करें</button>
              <button onClick={() => void handleEmptyTrash()} disabled={emptyingTrash}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {emptyingTrash ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : "हाँ, खाली करें"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-gray-900">Orders</h1>
            {/* Tab Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button onClick={() => setTab("orders")}
                className={`px-3 py-1.5 transition-colors ${tab === "orders" ? "bg-green-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                📋 All Orders
              </button>
              <button onClick={() => setTab("trash")}
                className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${tab === "trash" ? "bg-red-600 text-white" : "bg-white text-gray-500 hover:bg-red-50"}`}>
                <Trash2 className="w-3 h-3" /> Trash {trashOrders.length > 0 && <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === "trash" ? "bg-red-500" : "bg-red-100 text-red-600"}`}>{trashOrders.length}</span>}
              </button>
            </div>
          </div>
          {tab === "orders" && stats && <p className="text-xs text-gray-500">{stats.total.toLocaleString()} total · {stats.today} today · {stats.new} new</p>}
          {tab === "trash" && <p className="text-xs text-gray-500">{trashOrders.length} orders in trash · 30 दिन बाद auto-delete होंगे</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Download:</span>
          {(["xlsx", "pdf", "csv"] as const).map((t) => (
            <button key={t} onClick={() => void handleExport(t)} disabled={exporting || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={t === "xlsx" ? { background: "#e8f5e9", color: "#1B5E20", borderColor: "#a5d6a7" } : t === "pdf" ? { background: "#fce4ec", color: "#c62828", borderColor: "#ef9a9a" } : { background: "#e3f2fd", color: "#1565c0", borderColor: "#90caf9" }}>
              {exporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {[["Total", stats.total, "text-gray-800 bg-white border-gray-200"], ["Today", stats.today, "text-blue-800 bg-blue-50 border-blue-200"], ["New", stats.new, "text-blue-700 bg-blue-50 border-blue-100"], ["Confirmed", stats.confirmed, "text-yellow-700 bg-yellow-50 border-yellow-100"], ["Shipped", stats.shipped, "text-purple-700 bg-purple-50 border-purple-100"], ["Delivered", stats.delivered, "text-green-700 bg-green-50 border-green-100"], ["Cancelled", stats.cancelled, "text-red-700 bg-red-50 border-red-100"]].map(([label, value, cls]) => (
            <div key={label as string} className={`rounded-xl border px-3 py-2 ${cls as string}`}>
              <p className="text-xs opacity-60 uppercase font-semibold">{label as string}</p>
              <p className="text-lg font-bold">{(value as number).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); void loadOrders(1); }} className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px] relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, address..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none">
            <option value="all">All Status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:brightness-110" style={{ background: G }}>
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
            <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); setDatePreset("all"); void loadOrders(1); }}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">Clear</button>
            <button type="button" onClick={() => void loadOrders(page)} disabled={loading}
              className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </form>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Range:</span>
          <select value={datePreset} onChange={(e) => { handlePresetChange(e.target.value as DatePreset); }}
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
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Clear dates
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 flex-wrap">
            <span className="text-xs font-semibold text-gray-600">{selected.size} selected</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none">
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={handleBulkUpdate} disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60" style={{ background: G }}>
              {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />} Apply Status
            </button>
            {isSA && (
              <button onClick={() => void handleBulkDelete()} disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 transition-colors">
                {bulkDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Move to Trash
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Deselect</button>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">{orders.length} of {total} orders</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading && orders.length === 0 ? <div className="flex items-center justify-center h-32 gap-2 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin" /> Loading...</div>
          : orders.length === 0 ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Package className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">No orders found</p></div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#f8f9fa" }}>
                    <tr>
                      <th className="px-3 py-3 text-left">
                        <button onClick={toggleAll} className="text-gray-400 hover:text-gray-700">
                          {selected.size === orders.length ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                        </button>
                      </th>
                      {["Date", "Name", "Mobile", "Address", "PIN", "Qty/Amt", "Channel", "Payment", "Status", "Tracking", "Actions"].map((h) => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order, idx) => {
                      const badPin = order.pincode.replace(/\D/g, "").length !== 6;
                      return (
                        <tr key={order.id} className={`hover:bg-green-50/40 transition-colors ${selected.has(order.id) ? "bg-green-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                          <td className="px-3 py-3">
                            <button onClick={() => toggleSelect(order.id)} className="text-gray-400 hover:text-gray-700">
                              {selected.has(order.id) ? <CheckSquare className="w-4 h-4 text-green-600" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtShort(order.createdAt)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{order.name}</span>
                              {order.isRepeat && <span title="Repeat Customer" className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700"><Star className="w-2.5 h-2.5" /> Repeat</span>}
                            </div>
                            {order.email && (
                              <div className="text-[11px] text-gray-400 font-mono truncate max-w-[140px]" title={order.email}>
                                {order.email}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-700 font-mono text-xs">{order.phone}</td>
                          <td className="px-3 py-3 text-gray-600 max-w-[160px] truncate text-xs" title={order.address}>{order.address}</td>
                          <td className={`px-3 py-3 text-xs font-mono ${badPin ? "text-red-600 font-bold" : "text-gray-600"}`}>
                            <div className="flex items-center gap-0.5">
                              {order.pincode}
                              {badPin && <AlertCircle className="w-3 h-3 text-red-500" />}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <div className="text-gray-700 font-medium">×{order.quantity}</div>
                            <div className="text-green-700 font-bold">₹{(999 * order.quantity).toLocaleString()}</div>
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {(() => {
                              const src = order.visitorSource ?? "Direct";
                              const cfg: Record<string, { bg: string; text: string }> = {
                                Facebook: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
                                Instagram: { bg: "bg-pink-50 border-pink-200", text: "text-pink-700" },
                                WhatsApp: { bg: "bg-green-50 border-green-200", text: "text-green-700" },
                                Direct: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
                              };
                              const c = cfg[src] ?? cfg["Direct"]!;
                              return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}>{src}</span>;
                            })()}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            <div className="font-medium text-gray-700">{order.paymentMethod ?? "COD"}</div>
                            {order.paymentId && <div className="text-gray-400 font-mono text-xs truncate max-w-[80px]" title={order.paymentId ?? ""}>{order.paymentId}</div>}
                            <div className={`text-xs font-semibold ${order.paymentStatus === "success" ? "text-green-600" : "text-orange-500"}`}>{order.paymentStatus ?? "pending"}</div>
                          </td>
                          <td className="px-3 py-3">
                            <StatusSelect orderId={order.id} currentStatus={order.status} onUpdate={(id, s) => setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: s } : o))} />
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {order.trackingId ? (
                              <div className="space-y-0.5">
                                <div className={`text-xs font-semibold flex items-center gap-1 ${order.courier === "Shadowfax" ? "text-orange-600" : order.courier === "India Post" ? "text-red-700" : "text-blue-700"}`}>
                                  {order.courier === "Shadowfax" && <Zap className="w-3 h-3" />}
                                  {order.courier === "India Post" && <Package className="w-3 h-3" />}
                                  {order.courier === "Shiprocket" && <Truck className="w-3 h-3" />}
                                  {order.courier}
                                </div>
                                <a
                                  href={
                                    order.courier === "Shadowfax" ? `https://shadowfax.in/track-your-order/?awb=${order.trackingId}` :
                                    order.courier === "India Post" ? `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx` :
                                    `https://shiprocket.co/tracking/${order.trackingId}`
                                  }
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-mono text-xs flex items-center gap-0.5">
                                  {order.trackingId} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                </a>
                                {order.courier === "Shadowfax" && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const { labelUrl } = await getShadowfaxLabel(order.id);
                                        window.open(labelUrl, "_blank");
                                      } catch { alert("Could not fetch shipping label. Check Shadowfax credentials."); }
                                    }}
                                    className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                                    <Tag className="w-3 h-3" /> Download Label
                                  </button>
                                )}
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <RowActions order={order} settings={settings} onShipped={() => void loadOrders(page)} />
                              <button
                                onClick={() => setEditOrder(order)}
                                title="Edit Order"
                                className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {isSA && (
                                deleteConfirm === order.id ? (
                                  <div className="flex items-center gap-1 ml-1">
                                    <button onClick={() => void handleDeleteOrder(order.id)} disabled={deleting === order.id}
                                      className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 whitespace-nowrap">
                                      {deleting === order.id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : "✓ हाँ"}
                                    </button>
                                    <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">नहीं</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeleteConfirm(order.id)}
                                    title="Move to Trash"
                                    className="ml-1 p-1.5 rounded-lg text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => void loadOrders(page - 1)} disabled={page <= 1 || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button onClick={() => void loadOrders(page + 1)} disabled={page >= totalPages || loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          🗑️ TRASH VIEW
          ══════════════════════════════════════════ */}
      {tab === "trash" && (
        <div className="space-y-3">
          {/* Trash Header Actions */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                {trashOrders.length} ऑर्डर Trash में हैं
              </p>
              <p className="text-xs text-red-600">30 दिन बाद automatically permanent delete हो जाएंगे</p>
            </div>
            <button onClick={() => void loadTrash()} className="p-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-600" title="Refresh Trash">
              <RefreshCw className={`w-4 h-4 ${trashLoading ? "animate-spin" : ""}`} />
            </button>
            {trashSelected.size > 0 && (
              <button onClick={() => void handleRestore()} disabled={restoring}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
                {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                Restore ({trashSelected.size})
              </button>
            )}
            {isSA && trashOrders.length > 0 && (
              <button onClick={() => setEmptyConfirm(true)} disabled={emptyingTrash}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                {emptyingTrash ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Empty Trash
              </button>
            )}
          </div>

          {/* Trash Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {trashLoading && trashOrders.length === 0
              ? <div className="flex items-center justify-center h-32 gap-2 text-gray-400"><RefreshCw className="w-5 h-5 animate-spin" /> Loading...</div>
              : trashOrders.length === 0
                ? <div className="flex flex-col items-center justify-center h-32 text-gray-400"><Trash2 className="w-8 h-8 mb-2 opacity-20" /><p className="text-sm">Trash खाली है</p></div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50 border-b border-red-100">
                        <tr>
                          <th className="px-3 py-3 text-left">
                            <button onClick={toggleAllTrash} className="text-gray-400 hover:text-gray-700">
                              {trashSelected.size === trashOrders.length && trashOrders.length > 0
                                ? <CheckSquare className="w-4 h-4 text-red-500" />
                                : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          {["Order ID", "Customer", "Mobile", "Amount", "Status", "Source", "Trashed On", "Actions"].map((h) => (
                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {trashOrders.map((order) => (
                          <tr key={order.id} className={`hover:bg-red-50/40 transition-colors ${trashSelected.has(order.id) ? "bg-red-50" : "bg-white"}`}>
                            <td className="px-3 py-3">
                              <button onClick={() => toggleTrash(order.id)} className="text-gray-400 hover:text-gray-700">
                                {trashSelected.has(order.id) ? <CheckSquare className="w-4 h-4 text-red-500" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-gray-500">{order.order_id}</td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-900 text-sm">{order.name}</div>
                              <div className="text-xs text-gray-400 truncate max-w-[140px]" title={order.address}>{order.address}</div>
                            </td>
                            <td className="px-3 py-3 text-xs font-mono text-gray-600">{order.phone}</td>
                            <td className="px-3 py-3 text-xs font-bold text-green-700">₹{(999 * order.quantity).toLocaleString()}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                order.status === "New" ? "bg-blue-50 text-blue-700 border-blue-200"
                                : order.status === "Delivered" ? "bg-green-50 text-green-700 border-green-200"
                                : order.status === "Cancelled" ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-500">{order.source || "—"}</td>
                            <td className="px-3 py-3 text-xs text-red-500 whitespace-nowrap">{fmtShort(order.deleted_at)}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                {/* Restore */}
                                <button onClick={() => void restoreOrdersFromTrash([order.id]).then(() => {
                                  setTrashOrders((prev) => prev.filter((o) => o.id !== order.id));
                                }).catch((e) => alert(e instanceof Error ? e.message : "Restore failed"))}
                                  title="Restore this order"
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors">
                                  ↩ Restore
                                </button>
                                {/* Permanent Delete */}
                                {isSA && (
                                  permDelConfirm === order.id ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => void handlePermDelete(order.id)} disabled={permDeleting === order.id}
                                        className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 whitespace-nowrap">
                                        {permDeleting === order.id ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : "हमेशा के लिए"}
                                      </button>
                                      <button onClick={() => setPermDelConfirm(null)} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">नहीं</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setPermDelConfirm(order.id)}
                                      title="Permanently delete"
                                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          </div>
        </div>
      )}
    </div>
  );
}
