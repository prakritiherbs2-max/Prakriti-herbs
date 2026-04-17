import { motion } from "framer-motion";
import { ShieldCheck, Truck, Leaf, Lock } from "lucide-react";

const badges = [
  {
    icon: ShieldCheck,
    title: "Secure Order",
    desc: "Your order is 100% safe and secure with us",
  },
  {
    icon: Truck,
    title: "COD Available",
    desc: "Pay only when product arrives at your door",
  },
  {
    icon: Leaf,
    title: "100% Herbal",
    desc: "Pure Ayurvedic formula, no chemicals or fillers",
  },
  {
    icon: Lock,
    title: "Privacy Protected",
    desc: "Discreet packaging, your details are private",
  },
];

export function TrustBadges() {
  return (
    <section className="py-14 bg-background border-b border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {badges.map((badge, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <badge.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{badge.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{badge.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
