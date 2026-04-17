import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const images = [
  {
    src: `${import.meta.env.BASE_URL}images/product1.jpg`,
    fallback: `${import.meta.env.BASE_URL}images/gallery-1.png`,
    alt: "KamaSutra Gold+ Product – Front View",
  },
  {
    src: `${import.meta.env.BASE_URL}images/product2.jpg`,
    fallback: `${import.meta.env.BASE_URL}images/gallery-2.png`,
    alt: "KamaSutra Gold+ – Ingredients View",
  },
  {
    src: `${import.meta.env.BASE_URL}images/product3.jpg`,
    fallback: `${import.meta.env.BASE_URL}images/gallery-3.png`,
    alt: "KamaSutra Gold+ – Packaging",
  },
];

export function Gallery() {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (zoomed) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [zoomed]);

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full gold-gradient text-[#1B5E20] text-sm font-bold mb-4 shadow">
            Best Selling Ayurvedic Formula
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            The Gold Standard of <span className="text-gradient">Purity</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Handpicked herbs, processed with ancient Ayurvedic wisdom to deliver unmatched potency.
          </p>
        </div>

        <div className="max-w-lg mx-auto relative select-none">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/20 bg-card cursor-zoom-in"
            style={{ aspectRatio: "3/4" }}
            onMouseEnter={() => setZoomed(true)}
            onMouseLeave={() => setZoomed(false)}
          >
            <AnimatePresence mode="wait">
              <motion.img
                key={current}
                src={images[current].src}
                alt={images[current].alt}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: zoomed ? 1.08 : 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.45 }}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = images[current].fallback; }}
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
          </div>

          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-secondary shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-secondary shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex justify-center gap-2 mt-5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${i === current ? "w-6 h-3 bg-primary" : "w-3 h-3 bg-primary/30"}`}
                aria-label={`Go to image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
