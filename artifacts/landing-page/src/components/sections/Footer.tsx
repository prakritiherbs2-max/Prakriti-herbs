import { Phone, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16 border-t-4 border-primary">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10 border-b border-white/10 pb-12 mb-8">

          <div className="flex flex-col items-center md:items-start">
            <img
              src="/images/logo.png"
              alt="Prakriti Herbs"
              className="h-16 w-auto object-contain mb-3"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <p className="text-white/60 max-w-sm text-center md:text-left text-sm">
              Authentic Ayurvedic formulations crafted with ancient wisdom for the modern world.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-3 text-white/80 text-center md:text-right">
            <p className="font-semibold text-white text-lg">Contact Us</p>

            <div className="flex flex-col gap-2">
              <a
                href="tel:+918968122246"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4 text-primary" />
                +91 89681 22246
              </a>
              <a
                href="tel:+918968122276"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4 text-primary" />
                +91 89681 22276
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); openWhatsApp("Namaste, I want more information about Kamasutra Gold +"); }}
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                WhatsApp: +91 89681 22246
              </a>
            </div>

            <p className="text-sm mt-1 text-white/50">Support: 9 AM – 9 PM, Mon–Sat</p>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-white/50 gap-3">
          <p>© {new Date().getFullYear()} Prakriti Herbs Private Limited. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#disclaimer" className="hover:text-white transition-colors">Disclaimer</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms & Conditions</a>
            <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
