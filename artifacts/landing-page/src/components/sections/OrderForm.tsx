import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShieldCheck, Truck, Package, X, Loader2, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import { cleanMobile, sendLeadToCRM, DuplicateOrderError, hasOrderedToday } from "@/lib/crm";
import { fireLead, fireInitiateCheckout, markPaymentInitiated, generateEventId, getCookie, setAdvancedMatching } from "@/lib/pixel";
import { getVisitorSource, startVisitorPing, getAgencySource, clearAgencySource, captureLandingUrl, getLandingPageUrl, clearLandingPageUrl } from "@/lib/visitorTracking";
import { openWhatsApp } from "@/lib/whatsapp";

/* ─── Types ─── */
type LocationStatus = "idle" | "detecting" | "gps_ok" | "gps_denied" | "pin_ok" | "pin_err";

/* ─── Helpers ─── */
function captureAbandonedCart(name: string, phone: string, address: string, pincode: string, email?: string, source?: string) {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length < 10) return;
  fetch("/api/abandoned-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.trim(), phone: cleanPhone,
      email: email && email.includes("@") ? email.trim() : undefined,
      address: address.trim() || null, pincode: pincode.trim() || null,
      source: source || "direct",
    }),
    keepalive: true,
  }).catch(() => {});
}

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyh89OCWVJJePou7B73Q0H2mJBzlWewT4YORz0QF0U2AVb1QvkKLp-h0_MjveBxc_2Txw/exec";

const CASHFREE_URL = "https://payments.cashfree.com/forms/kama";

function getEnglishDate() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function sendToSheet(name: string, mobile: string, address: string, pincode: string, source: string, city?: string, state?: string) {
  const payload = JSON.stringify({
    date: getEnglishDate(), name, mobile, address, pincode, source,
    city: city ?? "", state: state ?? "",
  });
  fetch(GOOGLE_SHEET_URL, { method: "POST", mode: "no-cors", body: payload }).catch(() => {});
}

/* ─── Reverse geocode via BigDataCloud (free, no API key) ─── */
async function reverseGeocode(lat: number, lon: number): Promise<{ pincode: string; city: string; state: string } | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      postcode?: string;
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    };
    const pincode = (data.postcode ?? "").replace(/\D/g, "").slice(0, 6);
    const city = data.city || data.locality || "";
    const state = data.principalSubdivision || "";
    if (!pincode || pincode.length !== 6) return null;
    return { pincode, city, state };
  } catch {
    return null;
  }
}

/* ─── Pincode lookup via India Post API (free, no key) ─── */
async function lookupPincode(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ Status: string; PostOffice?: Array<{ District: string; State: string }> }>;
    if (!data[0] || data[0].Status !== "Success" || !data[0].PostOffice?.length) return null;
    const po = data[0].PostOffice[0];
    return { city: po.District ?? "", state: po.State ?? "" };
  } catch {
    return null;
  }
}

/* ─── Success Modal ─── */
function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl max-w-md w-full text-center relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-4 font-display" style={{ color: "#1B5E20" }}>ऑर्डर कन्फर्म! 🎉</h2>
        <p className="text-base text-gray-700 leading-relaxed mb-5">
          धन्यवाद! आपका COD ऑर्डर सफलतापूर्वक बुक हो गया है।
          <br />हमारी टीम जल्द ही आपसे संपर्क करेगी।
          <br /><span className="font-semibold mt-2 block" style={{ color: "#1B5E20" }}>📦 100% गोपनीय पैकिंग की गारंटी है।</span>
        </p>
        <button onClick={onClose} className="w-full py-3 font-bold rounded-xl text-[#1B5E20] text-lg"
          style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)" }}>
          बंद करें ✓
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─── Location Status Badge ─── */
function LocationBadge({ status }: { status: LocationStatus }) {
  if (status === "detecting") return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium animate-pulse">
      <Loader2 className="w-3 h-3 animate-spin" /> Detecting location…
    </span>
  );
  if (status === "gps_ok") return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
      <MapPin className="w-3 h-3" /> Location Detected ✓
    </span>
  );
  if (status === "pin_ok") return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
      <CheckCircle className="w-3 h-3" /> Pincode Verified ✓
    </span>
  );
  if (status === "pin_err") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
      <AlertCircle className="w-3 h-3" /> Invalid Pincode
    </span>
  );
  return null;
}

/* ─── Main Component ─── */
export function OrderForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [_wurl, set_wurl] = useState("");
  const abandonedFired = useRef(false);
  const geoAttempted = useRef(false);
  const visitorSource = getVisitorSource();

  /**
   * Agency source — read from ?source= URL param first (highest priority),
   * then fall back to localStorage (persisted from a previous page load).
   * URL param ALWAYS overwrites any stored value so a returning customer
   * clicking a new agency link gets the correct attribution.
   */
  const agencySource = getAgencySource();

  /* ─── GPS Auto-Detect on Page Load ─── */
  useEffect(() => {
    // Must run BEFORE any navigation — captures the URL visitor first landed on
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
        } else {
          setLocationStatus("gps_denied");
        }
      },
      () => {
        setLocationStatus("gps_denied");
      },
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false }
    );
  }, []);

  /* ─── Pincode Lookup Fallback ─── */
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
      setCity((prev) => prev || result.city);
      setState((prev) => prev || result.state);
      setLocationStatus("pin_ok");
      setErrors((e) => ({ ...e, pincode: "" }));
    } else {
      setLocationStatus("pin_err");
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) e.name = "Please enter your full name";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) e.phone = "Please enter a valid 10-digit mobile number";
    if (!address.trim() || address.trim().length < 10) e.address = "Please enter your complete address";
    if (!pincode.trim() || pincode.replace(/\D/g, "").length !== 6) e.pincode = "Please enter a valid 6-digit pincode";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCODSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOrderError(null);
    if (_wurl.trim()) return; // honeypot filled — silent drop
    if (!validate()) return;

    const mobile = cleanMobile(phone);
    if (!mobile) { setOrderError("Please enter a valid 10-digit mobile number."); return; }
    if (hasOrderedToday(mobile)) {
      setOrderError("This mobile number has already placed an order today. Please try again tomorrow or call us at +91 89681 22246.");
      return;
    }

    setLoading(true);
    try {
      sendLeadToCRM({
        name:    name.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        Number:  mobile,
        STATE:   state.trim() || undefined,
      }).then(() => {
        console.log("[COD] CRM lead saved successfully.");
      }).catch((err) => {
        if (err instanceof DuplicateOrderError) return;
        console.error("[COD] CRM failed (non-blocking):", err instanceof Error ? err.message : err);
      });

      const leadEventId = generateEventId();

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
            quantity: parseInt(quantity, 10), product: "KamaSutra Gold+",
            // Agency source from ?source= URL param (highest priority) → localStorage → "direct"
            source: agencySource || "direct",
            email: email.trim() || undefined,
            visitorSource: visitorSource ?? "Direct",
            landingPageUrl: getLandingPageUrl() || undefined,
            eventId: leadEventId,
            fbp: getCookie("_fbp"),
            fbc: getCookie("_fbc"),
            userAgent: navigator.userAgent,
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

      sendToSheet(name.trim(), mobile, address.trim(), pincode.trim(), agencySource || "COD", city.trim() || undefined, state.trim() || undefined);

      // ── Fire pixel BEFORE WhatsApp redirect ──────────────────────────────────
      // CRITICAL: On Android, openWhatsApp() calls window.location.href which
      // navigates away immediately. Any code after it will NOT execute on Android.
      // fireLead MUST be called before openWhatsApp or the Purchase event is lost.
      void setAdvancedMatching({
        phone: mobile, firstName: name.trim(),
        city: city.trim() || undefined, state: state.trim() || undefined, zip: pincode.trim() || undefined,
      });
      fireLead({ name: name.trim(), phone: mobile, eventId: leadEventId, orderId: serverOrderId });
      // Clear agency attribution + landing URL after order — avoid carrying over to next session
      clearAgencySource();
      clearLandingPageUrl();

      /* WhatsApp redirect — after pixel fired */
      const msg = `*New COD Order:*\n*Product:* KamaSutra Gold+\n*Name:* ${name}\n*Mobile:* ${mobile}\n*Address:* ${address}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""}\n*Pincode:* ${pincode}\n*Qty:* ${quantity} bottle(s)`;
      openWhatsApp(msg);
      setLoading(false);
      setShowSuccess(true);
    } catch (err) {
      console.error("[COD] Order submit error:", err);
      setLoading(false);
      setOrderError("Something went wrong. Please try again or call us at +91 89681 22246.");
    }
  }

  function handlePayNowClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!validate()) return;
    const mobile = cleanMobile(phone);
    if (!mobile) { alert("Please enter a valid 10-digit mobile number."); return; }
    if (hasOrderedToday(mobile)) { alert("आप आज इस नंबर से ऑर्डर कर चुके हैं। कृपया कल प्रयास करें।"); return; }

    sendLeadToCRM({
      name: name.trim(), address: address.trim(), pincode: pincode.trim(), Number: mobile, STATE: state.trim() || undefined,
    }).then(() => console.log("[PayNow] CRM lead saved."))
      .catch((err) => { if (err instanceof DuplicateOrderError) return; console.error("[PayNow] CRM failed:", err instanceof Error ? err.message : err); });

    sendToSheet(name.trim(), mobile, address.trim(), pincode.trim(), "Online Attempt", city.trim() || undefined, state.trim() || undefined);
    fireInitiateCheckout({ quantity: parseInt(quantity, 10) });
    markPaymentInitiated();
    try { window.open(CASHFREE_URL, "_parent"); } catch { window.location.href = CASHFREE_URL; }
  }

  function handleClose() {
    setShowSuccess(false);
    setName(""); setPhone(""); setEmail(""); setAddress("");
    setPincode(""); setCity(""); setState(""); setQuantity("1"); setErrors({});
    setLocationStatus("idle");
  }

  const inputClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors ${errors[field] ? "border-red-500" : locationStatus !== "idle" && field === "pincode" && locationStatus === "pin_err" ? "border-red-500" : "border-border"}`;

  const locationInputClass = (field: string) => {
    const hasVal = field === "city" ? city : state;
    if ((locationStatus === "gps_ok" || locationStatus === "pin_ok") && hasVal) {
      return "w-full px-4 py-3 rounded-xl border border-green-400 bg-green-50/50 focus:outline-none focus:ring-2 focus:ring-green-500/30 transition-colors text-gray-800";
    }
    return "w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors";
  };

  return (
    <>
      <AnimatePresence>{showSuccess && <SuccessModal onClose={handleClose} />}</AnimatePresence>

      <section id="order-form" className="py-16 md:py-24 bg-muted/30 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto bg-card rounded-3xl shadow-2xl border border-border overflow-hidden flex flex-col lg:flex-row">

            {/* Left Panel */}
            <div className="lg:w-2/5 bg-secondary text-secondary-foreground p-8 md:p-12 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 font-display text-white">
                  Secure Your <span className="text-primary">Order</span> Today
                </h2>
                <p className="text-secondary-foreground/80 mb-8 text-lg">
                  Pay only when the product reaches your doorstep. 100% secure and discreet packaging.
                </p>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">Free Delivery</h4>
                      <p className="text-secondary-foreground/70 text-sm">3–5 days delivery across India</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">Discreet Packaging</h4>
                      <p className="text-secondary-foreground/70 text-sm">No branding on the outer box</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">📦 100% Secret Packaging</h4>
                      <p className="text-secondary-foreground/70 text-sm">No product name on outer box — complete privacy</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative z-10 mt-12 pt-8 border-t border-secondary-foreground/20">
                <div className="flex items-center gap-4">
                  <div className="font-display">
                    <p className="text-sm text-secondary-foreground/70 uppercase tracking-widest font-bold">Total Price</p>
                    <p className="text-3xl font-bold text-white">
                      ₹999{" "}
                      <span className="text-sm font-sans font-normal text-secondary-foreground/70 line-through">₹1,999</span>
                    </p>
                  </div>
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase">
                    50% OFF
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel — Form */}
            <div className="lg:w-3/5 p-8 md:p-12">
              <h3 className="text-2xl font-bold mb-1">Cash on Delivery (COD) Form</h3>
              <p className="text-sm text-muted-foreground mb-6">
                नीचे फॉर्म भरें — कोई एडवांस पेमेंट नहीं, डिलीवरी पर ही भुगतान करें।
              </p>

              <form onSubmit={handleCODSubmit} noValidate className="space-y-5">
                {/* Honeypot — invisible to real users, filled by bots */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                  <label htmlFor="wurl_trap2">Website</label>
                  <input id="wurl_trap2" type="text" name="_wurl" value={_wurl} onChange={(e) => set_wurl(e.target.value)}
                    tabIndex={-1} autoComplete="off" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Full Name *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className={inputClass("name")} placeholder="e.g. Rahul Sharma" />
                    {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                  </div>

                  {/* Mobile */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Mobile Number *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-muted-foreground text-sm">+91</span>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        onBlur={() => {
                          if (!abandonedFired.current && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 10) {
                            abandonedFired.current = true;
                            captureAbandonedCart(name, phone, address, pincode, email, agencySource || undefined);
                          }
                        }}
                        className={`${inputClass("phone")} pl-12`} placeholder="98765 43210" maxLength={10} />
                    </div>
                    {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-foreground">
                      Email ID <span className="text-muted-foreground font-normal">(Optional — for order updates)</span>
                    </label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className={inputClass("email")} placeholder="e.g. rahul@gmail.com" autoComplete="email" />
                    <p className="text-[11px] text-muted-foreground">Your email is used only for order updates — it will not be shared with anyone.</p>
                  </div>

                  {/* Address */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-semibold text-foreground">Complete Address *</label>
                    <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)}
                      className={`${inputClass("address")} resize-none`}
                      placeholder="House/Flat No., Street, Area" />
                    {errors.address && <p className="text-red-500 text-xs">{errors.address}</p>}
                  </div>

                  {/* Pincode */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground flex items-center justify-between">
                      <span>Pincode *</span>
                      <LocationBadge status={locationStatus} />
                    </label>
                    <div className="relative">
                      <input
                        type="text" inputMode="numeric" value={pincode}
                        onChange={(e) => void handlePincodeChange(e.target.value)}
                        className={`${inputClass("pincode")} pr-10`}
                        placeholder={locationStatus === "detecting" ? "Detecting…" : "e.g. 110001"}
                        maxLength={6}
                      />
                      {pinLookupLoading && (
                        <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-gray-400" />
                      )}
                      {!pinLookupLoading && locationStatus === "gps_ok" && (
                        <MapPin className="absolute right-3 top-3.5 w-4 h-4 text-green-500" />
                      )}
                      {!pinLookupLoading && locationStatus === "pin_ok" && (
                        <CheckCircle className="absolute right-3 top-3.5 w-4 h-4 text-green-500" />
                      )}
                      {!pinLookupLoading && locationStatus === "pin_err" && (
                        <AlertCircle className="absolute right-3 top-3.5 w-4 h-4 text-red-500" />
                      )}
                    </div>
                    {errors.pincode && <p className="text-red-500 text-xs">{errors.pincode}</p>}
                    {!errors.pincode && locationStatus === "pin_err" && (
                      <p className="text-red-500 text-xs">Please enter a valid Pincode.</p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">Quantity</label>
                    <select value={quantity} onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors">
                      <option value="1">1 Bottle – ₹999</option>
                      <option value="2">2 Bottles – ₹1,899 (Save ₹99)</option>
                      <option value="3">3 Bottles – ₹2,699 (Best Value)</option>
                    </select>
                  </div>

                  {/* City */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">City / District</label>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                      className={locationInputClass("city")}
                      placeholder="e.g. New Delhi" />
                    {(locationStatus === "gps_ok" || locationStatus === "pin_ok") && city && (
                      <p className="text-[11px] text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Auto-filled — you can edit if needed
                      </p>
                    )}
                  </div>

                  {/* State */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground">State</label>
                    <input type="text" value={state} onChange={(e) => setState(e.target.value)}
                      className={locationInputClass("state")}
                      placeholder="e.g. Delhi" />
                    {(locationStatus === "gps_ok" || locationStatus === "pin_ok") && state && (
                      <p className="text-[11px] text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Auto-filled — you can edit if needed
                      </p>
                    )}
                  </div>

                </div>

                {orderError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    <span>{orderError}</span>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 px-8 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)", color: "#1B5E20" }}>
                  {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</> : <>🛒 Place Order Now (COD)</>}
                </button>

                <p className="text-center text-xs text-muted-foreground">
                  By placing an order, you agree to our terms. No advance payment required.
                </p>
              </form>

              {/* Online Payment */}
              <div className="mt-8 pt-8 border-t border-border">
                <p className="text-red-600 font-bold text-center text-base mb-1">ऑनलाइन पेमेंट करें और 10% की छूट पाएं!</p>
                <p className="text-center text-sm text-muted-foreground mb-5">
                  ऊपर फॉर्म भरने के बाद नीचे Pay Now दबाएं — UPI / Card / Net Banking
                </p>
                <div className="flex justify-center">
                  <button type="button" onClick={handlePayNowClick}
                    style={{ background: "#000", border: "1px solid gold", borderRadius: "15px", display: "flex", alignItems: "center", padding: "10px 16px", cursor: "pointer", gap: "0" }}>
                    <img src="https://cashfree-checkoutcartimages-prod.cashfree.com/Prakriti Herbs (1)Ea4uq7u9fiug_prod.png"
                      alt="Prakriti Herbs" style={{ width: "40px", height: "40px", borderRadius: "4px" }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "10px", marginRight: "10px" }}>
                      <div style={{ fontFamily: "Arial", color: "#fff", marginBottom: "5px", fontSize: "16px", fontWeight: "bold" }}>Pay Now (Get 10% OFF)</div>
                      <div style={{ fontFamily: "Arial", color: "#fff", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span>Powered By Cashfree</span>
                        <img src="https://cashfreelogo.cashfree.com/cashfreepayments/logosvgs/Group_4355.svg"
                          alt="Cashfree" style={{ width: "16px", height: "16px", verticalAlign: "middle" }} />
                      </div>
                    </div>
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-4">🔒 Secured by Cashfree • UPI, Cards, Net Banking accepted</p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
