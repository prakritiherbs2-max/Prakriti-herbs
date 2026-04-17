import { motion } from "framer-motion";
import { Activity, Mountain, Zap, Leaf, Heart, Flame } from "lucide-react";

export function Ingredients() {
  const ingredients = [
    {
      name: "Ashwagandha",
      benefit: "→ Stamina",
      desc: "An ancient adaptogen that significantly reduces stress, balances energy, and boosts overall stamina.",
      icon: Activity,
    },
    {
      name: "Shilajit",
      benefit: "→ Power",
      desc: "Sourced from high altitudes, it deeply enhances energy, vitality, and supports physical endurance.",
      icon: Mountain,
    },
    {
      name: "Safed Musli",
      benefit: "→ Performance",
      desc: "A rare herb known to naturally improve physical strength, performance, and combat fatigue.",
      icon: Zap,
    },
    {
      name: "Kaunch Beej",
      benefit: "→ Vigor",
      desc: "A traditional Ayurvedic aphrodisiac famous for building vigor and supporting reproductive health.",
      icon: Leaf,
    },
    {
      name: "Shatavari",
      benefit: "→ Vitality",
      desc: "A powerful rejuvenator that helps tone the body, providing sustained vitality and health.",
      icon: Heart,
    },
    {
      name: "Akarkara",
      benefit: "→ Endurance",
      desc: "Boosts metabolism and supports intense physical endurance when you need it the most.",
      icon: Flame,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <section className="py-24 bg-muted/50 border-y border-border/50 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-primary font-bold tracking-wider uppercase text-sm">The Formulation</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-4 mb-4">
            क्यों चुनें <span className="text-gradient">KamaSutra Gold+?</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            6 शक्तिशाली आयुर्वेदिक जड़ी-बूटियाँ जो आपके शरीर को पुनः ऊर्जावान बनाती हैं।
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {ingredients.map((item, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-xl hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 text-primary">
                <item.icon className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold font-display">{item.name}</h3>
                <span className="text-sm font-semibold text-primary">{item.benefit}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
