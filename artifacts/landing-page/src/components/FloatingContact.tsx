import { Phone, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { openWhatsApp } from "@/lib/whatsapp";
import { trackCall, trackWhatsApp } from "@/lib/leadTracking";

const WA_GREETING = "Namaste, I want more information about Kamasutra Gold +";

export function FloatingContact() {
  return (
    <>
      <motion.button
        type="button"
        onClick={() => { trackWhatsApp(); openWhatsApp(WA_GREETING); }}
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 left-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-xl shadow-[#25D366]/40 font-bold text-sm border-0 outline-none cursor-pointer"
        aria-label="WhatsApp Us"
      >
        <MessageCircle className="h-5 w-5 shrink-0" />
        <span>WhatsApp Order</span>
      </motion.button>

      <motion.a
        href="tel:8968122246"
        onClick={() => trackCall()}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-secondary text-secondary-foreground shadow-xl shadow-secondary/30 font-bold text-sm"
        aria-label="Call Us"
      >
        <Phone className="h-5 w-5 shrink-0" />
        <span>Call Now</span>
      </motion.a>
    </>
  );
}
