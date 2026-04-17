import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";

const comparisons = [
  {
    before: "कमजोरी",
    after: "ताकत",
    beforeDesc: "थका हुआ, ऊर्जाहीन, हमेशा थकान",
    afterDesc: "मज़बूत, शक्तिशाली, हर दिन तैयार",
    emoji: "💪",
  },
  {
    before: "थकान",
    after: "ऊर्जा",
    beforeDesc: "काम के बाद पूरी तरह टूट जाना",
    afterDesc: "दिनभर की ऊर्जा, रात को भी तरोताज़ा",
    emoji: "⚡",
  },
  {
    before: "निराशा",
    after: "आत्मविश्वास",
    beforeDesc: "खुद पर भरोसा नहीं, परफॉर्मेंस की चिंता",
    afterDesc: "पूरा आत्मविश्वास, बेहतरीन परफॉर्मेंस",
    emoji: "🔥",
  },
];

export function BeforeAfter() {
  return (
    <section className="py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay pointer-events-none"></div>
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/15 blur-3xl"></div>
      <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-primary/10 blur-3xl"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-bold mb-4 border border-primary/30">
            <TrendingUp className="w-4 h-4" />
            Real Transformation
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            7 दिनों में <span className="text-primary">बदलाव देखें</span>
          </h2>
          <p className="text-secondary-foreground/75 text-lg">
            हज़ारों पुरुषों ने महसूस किया — अब आपकी बारी है
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {comparisons.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.15 }}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="text-center text-3xl py-4 bg-white/5">{item.emoji}</div>

              <div className="grid grid-cols-2 divide-x divide-white/10">
                <div className="p-5 bg-red-900/30">
                  <p className="text-xs font-bold uppercase tracking-widest text-red-300 mb-1">पहले</p>
                  <p className="text-xl font-bold text-white font-display mb-2">{item.before}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.beforeDesc}</p>
                </div>

                <div className="p-5 bg-green-900/30 relative">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full gold-gradient flex items-center justify-center shadow-lg">
                    <ArrowRight className="w-3 h-3 text-[#1B5E20]" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">बाद में</p>
                  <p className="text-xl font-bold text-primary font-display mb-2">{item.after}</p>
                  <p className="text-xs text-white/70 leading-relaxed">{item.afterDesc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-12"
        >
          <button
            onClick={() => document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 px-10 py-4 gold-gradient text-[#1B5E20] font-bold text-lg rounded-xl shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all"
          >
            अभी Order करें – ₹999 COD
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
