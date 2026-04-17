import { motion } from "framer-motion";
import { Phone, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackCall, trackWhatsApp } from "@/lib/leadTracking";

const WA_GREETING = "Namaste, I want more information about Kamasutra Gold +";

export function ExpertCTA() {
  return (
    <section className="py-20 bg-muted/40 border-y border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center mx-auto mb-6">
            <Phone className="w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">
            Need Help? <span className="text-gradient">Talk to Expert Now</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            हमारे Ayurvedic expert से बात करें — पूरी तरह confidential और free। कोई भी सवाल पूछें।
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+918968122246"
              onClick={() => trackCall()}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-secondary text-secondary-foreground font-bold text-lg rounded-xl shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-all"
            >
              <Phone className="w-5 h-5" />
              Call Now – +91 89681 22246
            </a>
            <button
              type="button"
              onClick={() => { trackWhatsApp(); openWhatsApp(WA_GREETING); }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#25D366] text-white font-bold text-lg rounded-xl shadow-lg hover:bg-[#20bd5a] hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Expert
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            सुबह 9 बजे से रात 9 बजे तक उपलब्ध • 100% Confidential
          </p>
        </motion.div>
      </div>
    </section>
  );
}
