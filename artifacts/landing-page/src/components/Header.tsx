import { Phone } from "lucide-react";

export function Header() {
  const scrollToOrder = () => {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ background: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #1B5E20 100%)" }}>
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #C9A14A 0px, #C9A14A 1px, transparent 1px, transparent 12px)",
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex items-center justify-between h-20 md:h-24">

          <a
            href="tel:+918968122246"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: "#C9A14A" }}
          >
            <Phone className="w-4 h-4" />
            +91 89681 22246
          </a>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: "3px solid #C9A14A",
                boxShadow: "0 0 0 4px rgba(201,161,74,0.25), 0 4px 20px rgba(0,0,0,0.45)",
                overflow: "hidden",
                background: "#fff",
                flexShrink: 0,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}images/logo.png`}
                alt="Prakriti Herbs Logo"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          </div>

          <button
            onClick={scrollToOrder}
            className="flex items-center gap-1.5 font-bold text-sm rounded-lg px-4 py-2 md:px-5 md:py-2.5 transition-all hover:brightness-110 active:scale-95 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #C9A14A 0%, #e8c96a 50%, #C9A14A 100%)",
              color: "#1B5E20",
              boxShadow: "0 4px 15px rgba(201,161,74,0.4)",
            }}
          >
            Order Now
          </button>

        </div>
      </div>

      <div
        className="h-0.5 w-full"
        style={{ background: "linear-gradient(to right, transparent, #C9A14A 30%, #e8c96a 50%, #C9A14A 70%, transparent)" }}
      />
    </header>
  );
}
