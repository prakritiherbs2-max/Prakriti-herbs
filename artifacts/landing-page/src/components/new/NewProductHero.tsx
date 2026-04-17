import { useState, useEffect } from "react";
import { openOrderModal } from "@/lib/orderModalUtils";

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(hours = 24) {
  const [time, setTime] = useState(hours * 3600);

  useEffect(() => {
    const id = setInterval(() => {
      setTime((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(time / 3600).toString().padStart(2, "0");
  const m = Math.floor((time % 3600) / 60).toString().padStart(2, "0");
  const s = (time % 60).toString().padStart(2, "0");
  return { h, m, s };
}


// ─── Main Component ───────────────────────────────────────────────────────────
export function NewProductHero() {
  const { h, m, s } = useCountdown(23);

const handleOrder = () => {
  openOrderModal();
};

  return (
    <>
      {/* ── Inline Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .ks-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .ks-root { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f0fdf4; color: #1a1a1a; line-height: 1.6; }

        /* ── Top Banner ── */
        .ks-banner { background: linear-gradient(90deg,#16a34a 0%,#22c55e 100%); color:#fff; text-align:center; padding:8px 16px; font-size:14px; font-weight:500; }

        /* ── Hero ── */
        .ks-hero { max-width:1200px; margin:0 auto; padding:40px 20px; display:grid; grid-template-columns:1fr 1fr; gap:40px; align-items:start; }

        .ks-img-wrap { position:relative; }
        .ks-product-img { width:100%; border-radius:16px; box-shadow:0 20px 40px rgba(0,0,0,.15); display:block; }

        .ks-rating-badge {
          position:absolute; top:20px; left:20px;
          background:rgba(0,0,0,.8); color:#fbbf24;
          padding:10px 16px; border-radius:50%;
          width:80px; height:80px;
          display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
        }
        .ks-rating-badge .num { font-size:20px; font-weight:800; line-height:1; }
        .ks-rating-badge .txt { font-size:10px; color:#fff; font-weight:600; }
        .ks-rating-badge .stars { color:#fbbf24; font-size:12px; letter-spacing:1px; }

        .ks-herbal-badge {
          position:absolute; top:20px; right:20px;
          background:rgba(0,0,0,.8); color:#86efac;
          padding:10px; border-radius:50%;
          width:80px; height:80px;
          display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
          border:2px solid #86efac;
        }
        .ks-herbal-badge .leaf { font-size:24px; }
        .ks-herbal-badge .htxt { font-size:11px; font-weight:700; color:#86efac; letter-spacing:1px; }
        .ks-herbal-badge .hstars { color:#fbbf24; font-size:10px; letter-spacing:1px; }

        /* ── Hero Content ── */
        .ks-content { padding-top:10px; }
        .ks-title { font-size:42px; font-weight:800; line-height:1.2; margin-bottom:16px; color:#111827; }
        .ks-title .hi { color:#16a34a; }
        .ks-desc { font-size:16px; color:#6b7280; margin-bottom:24px; line-height:1.6; }

        .ks-price-row { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
        .ks-orig { font-size:20px; color:#9ca3af; text-decoration:line-through; }
        .ks-curr { font-size:32px; font-weight:800; color:#dc2626; }
        .ks-disc { background:#dc2626; color:#fff; padding:6px 12px; border-radius:20px; font-size:13px; font-weight:700; }

        @keyframes ks-pulse {
          0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.4); }
          50%      { box-shadow:0 0 20px 5px rgba(239,68,68,.4); }
        }
        .ks-cta {
          display:flex; align-items:center; justify-content:center; gap:10px;
          width:100%; background:linear-gradient(90deg,#1f2937 0%,#374151 100%);
          color:#fff; padding:18px 24px; border-radius:12px;
          font-size:18px; font-weight:700; border:none; cursor:pointer;
          margin-bottom:20px; transition:transform .2s;
          animation:ks-pulse 2s infinite;
        }
        .ks-cta:hover { transform:translateY(-2px); }

        .ks-features { display:flex; gap:24px; margin-bottom:20px; }
        .ks-feat { display:flex; align-items:center; gap:8px; font-size:14px; color:#4b5563; }
        .ks-feat svg { width:18px; height:18px; color:#16a34a; }

        .ks-social { display:flex; align-items:center; gap:16px; font-size:13px; color:#6b7280; margin-bottom:20px; }
        .ks-urgency { color:#dc2626; font-weight:600; }

        /* ── Countdown ── */
        .ks-countdown { display:flex; gap:12px; margin-bottom:24px; }
        .ks-cd-item { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; text-align:center; min-width:60px; }
        .ks-cd-item .num { font-size:24px; font-weight:800; color:#111827; line-height:1; }
        .ks-cd-item .lbl { font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:600; margin-top:4px; }

        /* ── Benefits ── */
        .ks-ben-title { font-size:24px; font-weight:700; color:#16a34a; margin-bottom:16px; }
        .ks-ben-p { font-size:15px; color:#4b5563; line-height:1.8; margin-bottom:16px; }

        /* ── Before / After ── */
        .ks-ba-section { max-width:1200px; margin:60px auto; padding:0 20px; background-color:#fff; }
        .ks-ba-header { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:32px; }
        .ks-ba-before { font-size:32px; font-weight:600; color:#6b7280; }
        .ks-ba-div { width:2px; height:24px; background:#d1d5db; }
        .ks-ba-after { font-size:32px; font-weight:700; color:#16a34a; }

        .ks-cmp-row { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:24px; }
        .ks-arrow { flex-shrink:0; width:52px; height:52px; border-radius:50%; background:#16a34a; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(22,163,74,.4); }

        .ks-card { background:#fff; border-radius:10px; text-align:center; box-shadow:0 4px 6px rgba(0,0,0,.05); margin:6px; }
        .ks-card-before { border:2px solid #fff; width:460px; }
        .ks-card-after  { border:2px solid #16a34a; width:460px; }
        .before-img { background:#fff; padding:10px; border-radius:8px; }
        .after-img  { background-color:#b5d6c1; padding:10px; border-radius:6px; }
        .ks-compare-img { width:420px; height:300px; display:block; }

        /* Alt row */
        .ks-alt-wrap { margin-top:56px; padding-top:40px; }
        .ks-alt-grid { display:grid; grid-template-columns:1fr 1fr; gap:32px; }
        .ks-alt-card { border-radius:20px; text-align:center; box-shadow:0 6px 20px rgba(0,0,0,.08); width:fit-content; height:fit-content; }
        .ks-benefit1 { width:100%; height:400px; display:block; }
        .ks-benefit2 { width:100%; height:800px; display:block; }

        /* Gov badge */
        .ks-gov { display:flex; align-items:center; justify-content:center; gap:12px; margin-top:32px; padding:16px; background:#fff; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,.05); }

        /* ── Testimonials ── */
        .ks-test-section { max-width:1200px; margin:60px auto; padding:0 20px; }
        .ks-test-header { text-align:center; margin-bottom:40px; }
        .ks-test-header .star { font-size:32px; color:#fbbf24; margin-bottom:8px; }
        .ks-test-header h2 { font-size:28px; font-weight:800; color:#111827; }
        .ks-reviews-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        .ks-test-card { background:#fff; border-radius:16px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.06); display:flex; align-items:center; justify-content:center; }
        .ks-review-img { width:100%; height:auto; border-radius:8px; }

        /* ── CTA Section ── */
        .ks-cta-section { max-width:100%; padding:50px 20px; text-align:center; background:linear-gradient(135deg,rgb(15,107,47),rgb(45,190,110)); }
        .ks-cta-section h2 { font-size:28px; font-weight:800; color:#fff; margin-bottom:8px; }
        .ks-cta-section p { font-size:16px; color:#d1fae5; margin-bottom:24px; }
        .ks-cta-large {
          display:inline-flex; align-items:center; gap:10px;
          background:linear-gradient(90deg,#1f2937 0%,#374151 100%);
          color:#fff; padding:18px 40px; border-radius:12px;
          font-size:18px; font-weight:700; border:none; cursor:pointer; transition:transform .2s;
        }
        .ks-cta-large:hover { transform:translateY(-2px); }

        /* ── Responsive ── */
        @media (max-width: 968px) {
          .ks-hero { grid-template-columns:1fr; }
          .ks-title { font-size:32px; }
          .ks-reviews-grid { grid-template-columns:1fr; }
          .ks-cmp-row { flex-direction:column; }
          .ks-arrow { transform:rotate(90deg); }
          .ks-alt-grid { grid-template-columns:1fr; }
        }
        @media (max-width: 640px) {
          .ks-title { font-size:28px; }
          .ks-price-row { flex-wrap:wrap; }
          .ks-features { flex-direction:column; gap:12px; }
          .ks-countdown { justify-content:center; }
          .ks-rating-badge, .ks-herbal-badge { width:60px; height:60px; }
          .ks-rating-badge .num { font-size:16px; }
          .ks-herbal-badge .leaf { font-size:18px; }
          .ks-card-before, .ks-card-after { width:100%; }
          .ks-compare-img { width:100%; height:auto; }
        }
      `}</style>

      <div className="ks-root">


        {/* ── Hero Section ── */}
        <section className="ks-hero">
          {/* Left: Product Image */}
          <div className="ks-img-wrap">
            <img src="./assets/hero.png" alt="Kama Sutra" className="ks-product-img" />
            <div className="ks-rating-badge">
              <div className="num">4.8</div>
              <div className="txt">Rating</div>
              <div className="stars">★★★★★</div>
            </div>
            <div className="ks-herbal-badge">
              <div className="leaf">🌿</div>
              <div className="htxt">HERBAL</div>
              <div className="hstars">★★★★★</div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="ks-content">
            <h1 className="ks-title">
              Kama Sutra से <span className="hi">30 दिन</span> में आपके लिंग का आकार 8 इंच हो जाएगा
            </h1>

            <div className="ks-price-row">
              <span className="ks-orig">₹2,499</span>
              <span className="ks-curr">₹999</span>
              <span className="ks-disc">35% OFF</span>
            </div>

            <button className="ks-cta" onClick={handleOrder}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                <path d="M9 2L6 7H3v2h2l2 12h10l2-12h2V7h-3l-3-5H9z" />
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="17" cy="20" r="1.5" />
              </svg>
              अभी ऑर्डर करें – COD
            </button>

            <div className="ks-features">
              <div className="ks-feat">
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ width: 18, height: 18 }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                फ्री डिलीवरी
              </div>
              <div className="ks-feat">
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ width: 18, height: 18 }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                COD उपलब्ध
              </div>
            </div>

            <div className="ks-social">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>127 लोग अभी देख रहे हैं</span>
              <span>|</span>
              <span className="ks-urgency">ऑफ़र जल्दी खत्म होगा</span>
            </div>

            {/* Countdown */}
            <div className="ks-countdown">
              <div className="ks-cd-item">
                <div className="num">{h}</div>
                <div className="lbl">Hours</div>
              </div>
              <div className="ks-cd-item">
                <div className="num">{m}</div>
                <div className="lbl">Min</div>
              </div>
              <div className="ks-cd-item">
                <div className="num">{s}</div>
                <div className="lbl">Sec</div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h3 className="ks-ben-title">Benefits</h3>
              <p className="ks-ben-p">
                जब मैंने पहली बार गोली ली थी तो मैं और मेरी बीवी एक घंटे तक सेक्स करते रहे थे। मेरा पहले इतना खड़ा
                नहीं हुआ: मेरा पत्थर जैसा सख्ती से खड़ा था।
              </p>
              <p className="ks-ben-p">
                दो हफ्ते बाद मैंने अपनी बीवी को सेक्स के समय आहें भरते सुना। मैंने उससे पूछा कि उसे दर्द तो नहीं हो
                रहा। ऐसा नहीं था, उसे असल में पहली बार ओरगाज़्म मिला था। उसे दो-दो बार ओरगाज़्म आया और उसमें बहुत
                मजा भी आया।
              </p>
              <p className="ks-ben-p">
                हालाँकि मैं देख सकता था कि मेरा लिंग दिन-ब-दिन बड़ा होता जा रहा है, फिर भी मुझे ऐसे परिणामों की
                उम्मीद नहीं थी। छह सेंटीमीटर जितना! अब मेरा लिंग सिर्फ एक लिंग नहीं था, बल्कि एक चुदाई का दैत्य था।
              </p>
              <p className="ks-ben-p">
                इसलिए दोस्तों, मैं तो आपको यही सलाह दूँगा। यदि आपको लग रहा है कि आपकी बीवी या प्रेमी ओरगाज़्म आने का
                नाटक करते हैं तो – कभी सीधे उनसे न पूछें। यदि आप औरत को सच में ओरगाज़्म दे सकेंगे तो आप चेक कर
                सकते हैं कि वह कितना सच बोल रही है।
              </p>
            </div>
          </div>
        </section>

        {/* ── Before / After Section ── */}
        <section className="ks-ba-section">
          <div className="ks-ba-header">
            <span className="ks-ba-before">पहले</span>
            <div className="ks-ba-div" />
            <span className="ks-ba-after">Kama Sutra के बाद</span>
          </div>

          {/* Row 1 */}
          <div className="ks-cmp-row">
            <div className="ks-card ks-card-before">
              <div className="before-img">
                <img src="./assets/small.png" className="ks-compare-img" alt="small" />
              </div>
            </div>
            <div className="ks-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div className="ks-card ks-card-after">
              <div className="after-img">
                <img src="./assets/big.png" className="ks-compare-img" alt="big" />
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="ks-cmp-row">
            <div className="ks-card ks-card-before">
              <div className="before-img">
                <img src="./assets/unhappy.png" className="ks-compare-img" alt="unhappy" />
              </div>
            </div>
            <div className="ks-arrow">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
            <div className="ks-card ks-card-after">
              <div className="after-img">
                <img src="./assets/nonstop.png" className="ks-compare-img" alt="nonstop" />
              </div>
            </div>
          </div>

          {/* Row 3 – Alt style */}
          <div className="ks-alt-wrap">
            <div className="ks-alt-grid">
              <div className="ks-alt-card" style={{ padding: 0 }}>
                <div className="before-img" style={{ padding: 0 }}>
                  <img src="./assets/jokar.png" className="ks-benefit1" alt="jokar" />
                </div>
              </div>
              <div className="ks-alt-card" style={{ padding: 0 }}>
                <div className="after-img" style={{ padding: 0, backgroundColor: "black" }}>
                  <img src="./assets/long.png" className="ks-benefit2" alt="long" />
                </div>
              </div>
            </div>
          </div>

          {/* Government Approved */}
          <div className="ks-gov">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" width="32" height="32">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>Government Approved</span>
              </div>
              <img src="./assets/certi.png" alt="certificate" style={{ maxWidth: "100%" }} />
            </div>
          </div>
        </section>

        {/* ── Testimonials Section ── */}
        <section className="ks-test-section">
          <div className="ks-test-header">
            <div className="star">⭐</div>
            <h2>ग्राहकों का अनुभव</h2>
          </div>
          <div className="ks-reviews-grid">
            <div className="ks-test-card">
              <img src="./assets/reviews.png" className="ks-review-img" alt="reviews" />
            </div>
            <div className="ks-test-card">
              <img src="./assets/reviews2.png" className="ks-review-img" alt="reviews2" />
            </div>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="ks-cta-section">
          <h2>Kama Sutra अभी ऑर्डर करें</h2>
          <p>आयुर्वेदिक पावर पैक — सीमित समय ऑफ़र!</p>
          <button className="ks-cta-large" onClick={handleOrder}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
              <path d="M9 2L6 7H3v2h2l2 12h10l2-12h2V7h-3l-3-5H9z" />
              <circle cx="9" cy="20" r="1.5" />
              <circle cx="17" cy="20" r="1.5" />
            </svg>
            Cash on Delivery से ऑर्डर करें
          </button>
        </section>

        {/* ── Order Popup ── */}
        <OrderPopup onOrder={handleOrder} />

      </div>
    </>
  );
}

// ─── Order Popup Component ────────────────────────────────────────────────────
function OrderPopup({ onOrder }: { onOrder: () => void }) {
  const [visible, setVisible] = useState(false);
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ fullName: "", phone: "+91", address: "", pincode: "" });

  // Expose show via global so parent CTA buttons can trigger it
  useEffect(() => {
    (window as any).__showKSPopup = () => setVisible(true);
    return () => { delete (window as any).__showKSPopup; };
  }, []);

  const changeQty = (d: number) => setQty((q) => Math.max(1, q + d));

  const submit = () => {
    const { fullName, phone, address, pincode } = form;
    if (!fullName || !phone || !address || !pincode) {
      alert("कृपया सभी फ़ील्ड भरें");
      return;
    }
    alert("आपका ऑर्डर सफलतापूर्वक दर्ज कर लिया गया है!\nहमारी टीम जल्द ही आपसे संपर्क करेगी।");
    setVisible(false);
    setForm({ fullName: "", phone: "+91", address: "", pincode: "" });
    setQty(1);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        .ks-overlay { position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(5px); }
        .ks-popup { background:#fff;width:100%;max-width:550px;max-height:95vh;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;font-family:'Inter',sans-serif; }
        .ks-ph { display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #e5e7eb;background:#f8fafc; }
        .ks-ph h2 { margin:0;font-size:20px;font-weight:700;color:#1f2937; }
        .ks-ph-close { background:#e5e7eb;color:#374151;border:none;width:32px;height:32px;border-radius:50%;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer; }
        .ks-pinfo { background:#f0fdf4;padding:16px 20px;display:flex;align-items:center;gap:14px;border-radius:0; }
        .ks-pimg { width:72px;height:72px;border-radius:10px;object-fit:contain;background:#fff;padding:6px;box-shadow:0 2px 8px rgba(0,0,0,.08); }
        .ks-pdetails h3 { margin:0 0 4px;font-size:17px;font-weight:600;color:#1f2937; }
        .ks-pprice { font-size:19px;font-weight:700;color:#dc2626; }
        .ks-qty { margin-left:auto;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e5e7eb;border-radius:9999px;padding:4px 8px; }
        .ks-qty button { width:32px;height:32px;border:none;background:#f1f5f9;border-radius:50%;font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer; }
        .ks-qty span { font-weight:600;font-size:17px;min-width:24px;text-align:center; }
        .ks-form { padding:20px;overflow-y:auto;max-height:calc(95vh - 180px); }
        .ks-form input { width:100%;padding:14px 16px;margin-bottom:12px;border:1px solid #d1d5db;border-radius:12px;font-size:15px;outline:none; }
        .ks-form input:focus { border-color:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.1); }
        .ks-dinfo { display:flex;justify-content:center;gap:24px;margin:16px 0 20px;font-size:14px;color:#16a34a;font-weight:500; }
        .ks-submit { width:100%;background:#111827;color:#fff;border:none;padding:17px;font-size:17.5px;font-weight:700;border-radius:12px;cursor:pointer; }
        .ks-submit:hover { background:#1f2937; }
        @media (max-width:640px) { .ks-popup { max-height:92vh;margin:10px;border-radius:16px; } }
      `}</style>

      <div className="ks-overlay" onClick={(e) => { if (e.target === e.currentTarget) setVisible(false); }}>
        <div className="ks-popup">
          {/* Header */}
          <div className="ks-ph">
            <h2>ऑर्डर करें</h2>
            <button className="ks-ph-close" onClick={() => setVisible(false)}>×</button>
          </div>

          {/* Product info */}
          <div className="ks-pinfo">
            <img src="./assets/hero.png" alt="Kama Sutra" className="ks-pimg" />
            <div className="ks-pdetails">
              <h3>Kama Sutra</h3>
              <div className="ks-pprice">₹999</div>
            </div>
            <div className="ks-qty">
              <button onClick={() => changeQty(-1)}>−</button>
              <span>{qty}</span>
              <button onClick={() => changeQty(1)}>+</button>
            </div>
          </div>

          {/* Form */}
          <div className="ks-form">
            <input
              type="text" placeholder="Full Name / पूरा नाम"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              type="text" placeholder="Address / पता"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <input
              type="text" placeholder="Pincode / पिनकोड" maxLength={6}
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
            <div className="ks-dinfo">
              <span>🚚 फ्री डिलीवरी</span>
              <span>🔒 सुरक्षित ऑर्डर</span>
            </div>
            <button className="ks-submit" onClick={submit}>
              ऑर्डर करें – ₹999
            </button>
          </div>
        </div>
      </div>
    </>
  );
}