import { motion } from "framer-motion";
import { CheckCircle, ShieldCheck, MessageCircle, ArrowRight, AlertCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackWhatsApp } from "@/lib/leadTracking";

const badges = [
  "✔ 100% Ayurvedic",
  "✔ No Side Effects",
  "✔ Fast Result",
  "✔ COD Available",
];

const WA_GREETING = "Namaste, I want more information about Kamasutra Gold +";

export function Hero() {
  const scrollToOrder = () => {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden bg-secondary text-secondary-foreground min-h-[92vh] flex items-center">
      <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-start text-left"
          >
            <div className="flex items-center gap-3 mb-5">
              <motion.span
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                LIMITED STOCK
              </motion.span>
              <span className="text-primary font-semibold text-sm tracking-wide uppercase">Prakriti Herbs</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-4 text-white font-display">
              KamaSutra Gold+ –{" "}
              <span className="text-primary">7 दिनों में</span>
              <br />वैवाहिक जीवन की
              <br /><span className="text-primary">खुशियाँ वापस पायें</span>
            </h1>

            <p className="text-base sm:text-lg text-secondary-foreground/80 mb-6 max-w-xl font-sans">
              100% आयुर्वेदिक | बिना साइड इफेक्ट | पुरुष शक्ति बढ़ाएं
            </p>

            <div className="flex flex-wrap gap-2 mb-8">
              {badges.map((badge, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-semibold"
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10">
              <button
                onClick={scrollToOrder}
                className="group flex items-center justify-center gap-2 px-8 py-4 gold-gradient text-[#1B5E20] font-bold rounded-xl text-lg shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all"
              >
                👉 Order Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => { trackWhatsApp(); openWhatsApp(WA_GREETING); }}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-[#25D366] text-white font-bold rounded-xl text-lg shadow-xl hover:bg-[#20bd5a] hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                👉 WhatsApp Order
              </button>
            </div>

            <div className="flex flex-wrap gap-6 text-sm font-medium text-secondary-foreground/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <span>GMP Certified</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span>Free & Discreet Delivery</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="relative lg:ml-auto w-full max-w-md mx-auto lg:max-w-none"
          >
            <div className="relative">
              <div className="absolute -inset-3 rounded-2xl bg-primary/20 blur-xl"></div>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border-2 border-primary/30">
                <img
                  src={`${import.meta.env.BASE_URL}images/product1.jpg`}
                  alt="KamaSutra Gold+ Premium Ayurvedic Bottle"
                  className="object-cover w-full h-full"
                  onError={(e) => { (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}images/hero-bottle.png`; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <span className="inline-block px-4 py-1.5 rounded-full gold-gradient text-[#1B5E20] text-sm font-bold shadow-lg">
                    Best Selling Ayurvedic Formula
                  </span>
                </div>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -bottom-6 -left-6 bg-card text-card-foreground p-4 rounded-xl shadow-xl border border-border flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">GMP Certified</p>
                <p className="text-xs text-muted-foreground">₹999 – Cash on Delivery</p>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
