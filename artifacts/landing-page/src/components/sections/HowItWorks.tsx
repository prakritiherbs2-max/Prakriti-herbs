import { motion } from "framer-motion";

export function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Take Daily",
      desc: "Consume 1 capsule twice a day preferably with warm milk or water after meals.",
    },
    {
      number: "02",
      title: "Feel the Difference",
      desc: "Experience naturally increased energy, reduced stress, and better mood within a few weeks.",
    },
    {
      number: "03",
      title: "Live Better",
      desc: "Enjoy sustained vitality, peak performance, and an overall elevated lifestyle.",
    },
  ];

  return (
    <section className="py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
      {/* Decorative Texture */}
      <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white">
            Simple Path to <span className="text-primary">Vitality</span>
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 max-w-5xl mx-auto items-start">
          {steps.map((step, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.2 }}
              className="flex-1 relative"
            >
              {/* Connector line for desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-primary/50 to-transparent"></div>
              )}
              
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-secondary-foreground text-secondary flex items-center justify-center text-2xl font-bold font-display shadow-[0_0_30px_rgba(212,175,55,0.2)] border-4 border-primary mb-6 relative z-10">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white font-display">{step.title}</h3>
                <p className="text-secondary-foreground/80 leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
