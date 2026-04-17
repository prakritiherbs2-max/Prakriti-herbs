import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { cleanMobile, sendLeadToCRM, DuplicateOrderError, hasOrderedToday } from "@/lib/crm";
import { fireLead, generateEventId, getCookie, setAdvancedMatching } from "@/lib/pixel";
import {
  getVisitorSource, startVisitorPing, getAgencySource,
  clearAgencySource, captureLandingUrl, getLandingPageUrl, clearLandingPageUrl,
} from "@/lib/visitorTracking";
import { openWhatsApp } from "@/lib/whatsapp";

/* ─── Pack Options ─── */
const PACKS = [
  { qty: 1, label: "1 Pack",  price: 999,  mrp: 1999,  tag: null,           desc: "1 महीने का कोर्स" },
  { qty: 2, label: "2 Packs", price: 1499, mrp: 3998,  tag: "Best Seller",  desc: "2 महीने का कोर्स" },
  { qty: 3, label: "3 Packs", price: 1999, mrp: 5997,  tag: "Best Value",   desc: "3 महीने का कोर्स" },
];

const GREEN  = "#39593d";
const YELLOW = "#e6cf73";
const font   = "'Playpen Sans', cursive";

type LocationStatus = "idle" | "detecting" | "gps_ok" | "gps_denied" | "pin_ok" | "pin_err";

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyh89OCWVJJePou7B73Q0H2mJBzlWewT4YORz0QF0U2AVb1QvkKLp-h0_MjveBxc_2Txw/exec";

function getEnglishDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function sendToSheet(name: string, mobile: string, address: string, pincode: string, source: string, city?: string, state?: string, qty?: number, amount?: number) {
  const payload = JSON.stringify({
    date: getEnglishDate(), name, mobile, address, pincode, source,
    city: city ?? "", state: state ?? "",
    qty: qty ?? 1, amount: amount ?? 999,
  });
  fetch(GOOGLE_SHEET_URL, { method: "POST", mode: "no-cors", body: payload }).catch(() => {});
}

async function reverseGeocode(lat: number, lon: number): Promise<{ pincode: string; city: string; state: string } | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { postcode?: string; city?: string; locality?: string; principalSubdivision?: string };
    const pincode = (data.postcode ?? "").replace(/\D/g, "").slice(0, 6);
    const city = data.city || data.locality || "";
    const state = data.principalSubdivision || "";
    if (!pincode || pincode.length !== 6) return null;
    return { pincode, city, state };
  } catch { return null; }
}

async function lookupPincode(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ Status: string; PostOffice?: Array<{ District: string; State: string }> }>;
    if (!data[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) return null;
    const po = data[0].PostOffice[0];
    return { city: po.District ?? "", state: po.State ?? "" };
  } catch { return null; }
}

/* ─── Location Badge ─── */
function LocationBadge({ status }: { status: LocationStatus }) {
  if (status === "detecting") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#2563eb", fontWeight: 600 }}>
      <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> Detecting…
    </span>
  );
  if (status === "gps_ok" || status === "pin_ok") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
      <CheckCircle style={{ width: 12, height: 12 }} /> {status === "gps_ok" ? "GPS Detected ✓" : "Pincode Verified ✓"}
    </span>
  );
  if (status === "pin_err") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
      <AlertCircle style={{ width: 12, height: 12 }} /> Invalid Pincode
    </span>
  );
  return null;
}

/* ─── Success Modal ─── */
function SuccessScreen({ onClose, pack }: { onClose: () => void; pack: typeof PACKS[0] }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%", background: "#dcfce7", color: "#16a34a",
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
      }}>
        <CheckCircle2 style={{ width: 40, height: 40 }} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: GREEN, marginBottom: 8, fontFamily: font }}>ऑर्डर कन्फर्म! 🎉</h2>
      <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.6, marginBottom: 4 }}>
        आपका COD ऑर्डर सफलतापूर्वक बुक हो गया है।
      </p>
      <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 6 }}>
        <strong>{pack.label}</strong> — <strong style={{ color: GREEN }}>₹{pack.price}</strong>
      </p>
      <p style={{ fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 20 }}>📦 100% गोपनीय पैकिंग की गारंटी है।</p>
      <button onClick={onClose} style={{
        width: "100%", padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 16,
        background: `linear-gradient(135deg, #C9A14A 0%, ${YELLOW} 50%, #C9A14A 100%)`,
        color: GREEN, border: "none", cursor: "pointer", fontFamily: font,
      }}>
        बंद करें ✓
      </button>
    </div>
  );
}

/* ─── Main OrderModal ─── */
export function OrderModal({ open, onClose, bannerUrl }: { open: boolean; onClose: () => void; bannerUrl?: string }) {
  const [selectedPackIdx, setSelectedPackIdx] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [_wurl, set_wurl] = useState("");
  const geoAttempted = useRef(false);
  const visitorSource = getVisitorSource();
  const agencySource = getAgencySource();

  const selectedPack = PACKS[selectedPackIdx];

  /* GPS on first open */
  useEffect(() => {
    if (!open) return;
    captureLandingUrl();
    startVisitorPing();
    if (geoAttempted.current || !navigator.geolocation) return;
    geoAttempted.current = true;
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (result) {
          setPincode(result.pincode);
          setCity(result.city);
          setState(result.state);
          setLocationStatus("gps_ok");
          setErrors((e) => ({ ...e, pincode: "" }));
        } else { setLocationStatus("gps_denied"); }
      },
      () => setLocationStatus("gps_denied"),
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, [open]);

  async function handlePincodeChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setPincode(digits);
    if (digits.length !== 6) {
      if (locationStatus === "pin_ok" || locationStatus === "pin_err") setLocationStatus("gps_denied");
      return;
    }
    setPinLookupLoading(true);
    const result = await lookupPincode(digits);
    setPinLookupLoading(false);
    if (result) {
      setCity((p) => p || result.city);
      setState((p) => p || result.state);
      setLocationStatus("pin_ok");
      setErrors((e) => ({ ...e, pincode: "" }));
    } else { setLocationStatus("pin_err"); }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = "पूरा नाम डालें";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) e.phone = "10 अंकों का मोबाइल नंबर डालें";
    if (!address.trim()) e.address = "पता डालें (शहर का नाम भी मान्य है)";
    if (!pincode.trim() || pincode.replace(/\D/g, "").length !== 6) e.pincode = "6 अंकों का पिनकोड डालें";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOrderError(null);
    if (_wurl.trim()) return; // honeypot filled — silent drop
    if (!validate()) return;
    const mobile = cleanMobile(phone);
    if (!mobile) { setOrderError("Valid 10-digit mobile number enter करें।"); return; }
    if (hasOrderedToday(mobile)) {
      setOrderError("इस नंबर से आज पहले से ऑर्डर हो चुका है। कल प्रयास करें या +91 89681 22246 पर call करें।");
      return;
    }

    setLoading(true);
    try {
      const pack = PACKS[selectedPackIdx];
      const leadEventId = generateEventId();

      sendLeadToCRM({
        name: name.trim(), address: address.trim(), pincode: pincode.trim(),
        Number: mobile, STATE: state.trim() || undefined,
      }).catch((err) => { if (!(err instanceof DuplicateOrderError)) console.error("[Modal] CRM:", err instanceof Error ? err.message : err); });

      // Await the order API so we get the server-assigned orderId for pixel dedup.
      // orderId (ORD-XXXXXXXX) is the stable key for px_purch_order_<orderId>.
      let serverOrderId: string | undefined;
      try {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(), phone: mobile, address: address.trim(),
            pincode: pincode.trim(), city: city.trim() || undefined, state: state.trim() || undefined,
            quantity: pack.qty, product: "KamaSutra Gold+",
            source: agencySource || "direct",
            visitorSource: visitorSource ?? "Direct",
            landingPageUrl: getLandingPageUrl() || undefined,
            eventId: leadEventId,
            fbp: getCookie("_fbp"),
            fbc: getCookie("_fbc"),
            userAgent: navigator.userAgent,
            amount: pack.price,
            _wurl: "",  // honeypot — real submissions always send empty string
          }),
        });
        if (orderRes.ok) {
          const data = await orderRes.json() as { orderId?: string };
          serverOrderId = data.orderId;
        }
      } catch {
        // non-blocking — pixel still fires with eventId fallback
      }

      sendToSheet(name.trim(), mobile, address.trim(), pincode.trim(), agencySource || "COD",
        city.trim() || undefined, state.trim() || undefined, pack.qty, pack.price);

      // ── Fire pixel BEFORE WhatsApp redirect ──────────────────────────────────
      // CRITICAL: On Android, openWhatsApp() calls window.location.href which
      // navigates away immediately. Any code after it will NOT execute on Android.
      // fireLead MUST be called before openWhatsApp or the Purchase event is lost.
      void setAdvancedMatching({
        phone: mobile, firstName: name.trim(),
        city: city.trim() || undefined, state: state.trim() || undefined, zip: pincode.trim() || undefined,
      });
      fireLead({ phone: mobile, eventId: leadEventId, value: pack.price, orderId: serverOrderId });
      clearAgencySource();
      clearLandingPageUrl();

      /* WhatsApp redirect — after pixel fired */
      const msg = `*New COD Order — KamaSutra Gold+*\n*Name:* ${name.trim()}\n*Mobile:* ${mobile}\n*Address:* ${address.trim()}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""}\n*Pincode:* ${pincode}\n*Qty:* ${pack.label} (${pack.qty} bottle)\n*Amount:* ₹${pack.price} (COD)\n*Source:* ${agencySource || "direct"}`;
      openWhatsApp(msg);

      setLoading(false);
      setSuccess(true);
    } catch (err) {
      console.error("[Modal] Submit error:", err);
      setLoading(false);
      setOrderError("कुछ गलत हुआ। कृपया पुनः प्रयास करें या +91 89681 22246 पर call करें।");
    }
  }

  function handleClose() {
    setSuccess(false);
    setName(""); setPhone(""); setAddress(""); setPincode("");
    setCity(""); setState(""); setErrors({}); setOrderError(null);
    setLocationStatus("idle");
    onClose();
  }

  const inp = (field: string): React.CSSProperties => ({
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${errors[field] ? "#ef4444" : locationStatus !== "idle" && field === "pincode" && locationStatus === "pin_err" ? "#ef4444" : "#d1d5db"}`,
    outline: "none", fontSize: 14, fontFamily: font, boxSizing: "border-box",
    background: "#fff",
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "12px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
          }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            style={{
              background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480,
              maxHeight: "92vh", overflowY: "auto", position: "relative",
              fontFamily: font, boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              style={{
                position: "absolute", top: 12, right: 12, zIndex: 10,
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: "rgba(0,0,0,0.15)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X style={{ width: 16, height: 16, color: "#fff" }} />
            </button>

            {success ? (
              <SuccessScreen onClose={handleClose} pack={selectedPack} />
            ) : (
              <>
                {/* Banner Image */}
                <div style={{ borderRadius: "20px 20px 0 0", overflow: "hidden" }}>
                  <img
                    src={bannerUrl || "/new-images/1.jpg"}
                    alt="KamaSutra Gold+ Offer"
                    style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/new-images/1.jpg"; }}
                  />
                </div>

                <div style={{ padding: "20px 20px 24px" }}>
                  {/* Header */}
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: GREEN, margin: "0 0 4px", textAlign: "center" }}>
                    अपना पैक चुनें — COD उपलब्ध
                  </h2>
                  <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", margin: "0 0 16px" }}>
                    💰 कोई अग्रिम भुगतान नहीं — डिलीवरी पर भुगतान करें
                  </p>

                  {/* Pack Selection */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {PACKS.map((pack, i) => {
                      const active = i === selectedPackIdx;
                      return (
                        <button
                          key={pack.qty}
                          type="button"
                          onClick={() => setSelectedPackIdx(i)}
                          style={{
                            flex: 1, padding: "10px 6px", borderRadius: 12, cursor: "pointer",
                            border: active ? `2.5px solid ${GREEN}` : "2px solid #e5e7eb",
                            background: active ? "#f0f7f1" : "#fafafa",
                            position: "relative", textAlign: "center", transition: "all 0.18s",
                          }}
                        >
                          {pack.tag && (
                            <span style={{
                              position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                              background: pack.tag === "Best Seller" ? "#ef4444" : GREEN,
                              color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 20,
                              padding: "2px 8px", whiteSpace: "nowrap",
                            }}>
                              {pack.tag}
                            </span>
                          )}
                          <div style={{ fontSize: 13, fontWeight: 700, color: active ? GREEN : "#374151", marginTop: pack.tag ? 4 : 0 }}>
                            {pack.label}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, lineHeight: 1.2 }}>
                            ₹{pack.price}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", textDecoration: "line-through" }}>₹{pack.mrp}</div>
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{pack.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Summary */}
                  <div style={{
                    background: `linear-gradient(135deg, ${GREEN}15, ${YELLOW}30)`,
                    borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    border: `1px solid ${GREEN}30`,
                  }}>
                    <span style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>
                      {selectedPack.label} — {selectedPack.desc}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 800, color: GREEN }}>₹{selectedPack.price}</span>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} noValidate>
                    {/* Honeypot — invisible to real users, filled by bots */}
                    <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                      <label htmlFor="wurl_trap">Website</label>
                      <input id="wurl_trap" type="text" name="_wurl" value={_wurl} onChange={(e) => set_wurl(e.target.value)}
                        tabIndex={-1} autoComplete="off" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                      {/* Name */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                          पूरा नाम *
                        </label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="जैसे: राहुल शर्मा" style={inp("name")} />
                        {errors.name && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>{errors.name}</p>}
                      </div>

                      {/* Mobile */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                          मोबाइल नंबर * (10 अंक)
                        </label>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#6b7280" }}>+91</span>
                          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                            maxLength={10} placeholder="98765 43210"
                            style={{ ...inp("phone"), paddingLeft: 48 }} />
                        </div>
                        {errors.phone && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>{errors.phone}</p>}
                      </div>

                      {/* Address */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
                          पूरा पता *
                        </label>
                        <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)}
                          placeholder="घर/फ्लैट नंबर, गली, मोहल्ला, शहर"
                          style={{ ...inp("address"), resize: "none" }} />
                        {errors.address && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>{errors.address}</p>}
                      </div>

                      {/* Pincode */}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>पिनकोड * (6 अंक)</label>
                          {locationStatus !== "idle" && <LocationBadge status={locationStatus} />}
                        </div>
                        <div style={{ position: "relative" }}>
                          {locationStatus === "detecting" && (
                            <MapPin style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#2563eb" }} />
                          )}
                          <input type="text" inputMode="numeric" value={pincode}
                            onChange={(e) => void handlePincodeChange(e.target.value)}
                            maxLength={6}
                            placeholder={locationStatus === "detecting" ? "Detecting…" : "जैसे: 110001"}
                            style={{ ...inp("pincode"), paddingRight: pinLookupLoading ? 38 : undefined }}
                          />
                          {pinLookupLoading && (
                            <Loader2 className="animate-spin" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#9ca3af" }} />
                          )}
                        </div>
                        {errors.pincode && <p style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>{errors.pincode}</p>}
                      </div>

                    </div>

                    {/* Error Banner */}
                    {orderError && (
                      <div style={{
                        marginTop: 12, padding: "10px 14px", borderRadius: 10,
                        background: "#fef2f2", border: "1px solid #fecaca",
                        color: "#b91c1c", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 8,
                      }}>
                        <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
                        {orderError}
                      </div>
                    )}

                    {/* Trust Row */}
                    <div style={{
                      display: "flex", gap: 10, marginTop: 14, marginBottom: 14,
                      fontSize: 11, color: "#4b5563", justifyContent: "center",
                    }}>
                      {["🚚 Free Delivery", "📦 Secret Packing", "✅ COD Available"].map((t) => (
                        <span key={t} style={{
                          background: "#f9fafb", border: "1px solid #e5e7eb",
                          borderRadius: 20, padding: "4px 10px", fontWeight: 600,
                        }}>{t}</span>
                      ))}
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                        background: loading ? "#9ca3af" : GREEN,
                        color: "#fff", fontSize: 16, fontWeight: 700,
                        cursor: loading ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        fontFamily: font, transition: "all 0.2s",
                      }}
                    >
                      {loading ? (
                        <><Loader2 className="animate-spin" style={{ width: 18, height: 18 }} />Order Place हो रहा है...</>
                      ) : (
                        <>🛒 ₹{selectedPack.price} — COD Order करें</>
                      )}
                    </button>

                    <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                      Order के बाद WhatsApp पर confirm होगा • 100% Genuine Product
                    </p>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

