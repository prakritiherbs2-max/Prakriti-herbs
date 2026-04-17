import { useState } from "react";
import { openOrderModal } from "@/lib/orderModalUtils";

export function NewNavbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollToOrder = () => {
    setSidebarOpen(false);
    openOrderModal();
  };

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "#fff",
          borderBottom: "1px solid #eee",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <nav
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 16px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Mobile Hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "none",
              border: "none",
              fontSize: 23,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
            className="d-lg-none"
            aria-label="Menu"
          >
            ☰
          </button>

          {/* Logo */}
          <a
            href="#"
            style={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            <img
              src="/new-images/logo.png"
              alt="Prakriti Herbs"
              fetchPriority="high"
              decoding="async"
              style={{ maxWidth: 70, height: "auto" }}
            />
          </a>

          {/* Desktop nav links */}
          <div style={{ display: "none" }} className="desktop-nav">
            <ul
              style={{
                display: "flex",
                listStyle: "none",
                margin: 0,
                padding: 0,
                gap: 24,
              }}
            >
              <li>
                <a
                  href="#"
                  style={{
                    fontFamily: "'Playpen Sans', cursive",
                    fontWeight: 600,
                    fontSize: 14,
                    letterSpacing: 1,
                    color: "#000",
                    textDecoration: "none",
                  }}
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#"
                  style={{
                    fontFamily: "'Playpen Sans', cursive",
                    fontWeight: 600,
                    fontSize: 14,
                    letterSpacing: 1,
                    color: "#555",
                    textDecoration: "none",
                  }}
                >
                  Men Wellness
                </a>
              </li>
            </ul>
          </div>

          {/* Right icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={scrollToOrder}
              style={{
                background: "#39593d",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Playpen Sans', cursive",
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >
              Order Now
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 1110,
          }}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: sidebarOpen ? 0 : -280,
          width: 280,
          height: "100%",
          background: "#fff",
          boxShadow: "2px 0 10px rgba(0,0,0,0.1)",
          transition: "left 0.3s ease-in-out",
          zIndex: 9999,
          padding: 20,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #eee",
            paddingBottom: 15,
            marginBottom: 20,
          }}
        >
          <img
            src="/new-images/logo.png"
            alt="Prakriti Herbs"
            style={{ maxWidth: 80 }}
          />
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: 28,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Sidebar links */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
          <li style={{ marginBottom: 20 }}>
            <a
              href="#"
              style={{
                fontFamily: "'Playpen Sans', cursive",
                fontSize: 18,
                color: "#000",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Home
            </a>
          </li>
          <li style={{ marginBottom: 20 }}>
            <a
              href="#"
              style={{
                fontFamily: "'Playpen Sans', cursive",
                fontSize: 18,
                color: "#555",
                textDecoration: "none",
              }}
            >
              Men Wellness
            </a>
          </li>
          <li>
            <button
              onClick={scrollToOrder}
              style={{
                background: "#39593d",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                padding: "12px 24px",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'Playpen Sans', cursive",
                cursor: "pointer",
                width: "100%",
                marginTop: 10,
              }}
            >
              Order Now (COD)
            </button>
          </li>
        </ul>

        {/* Sidebar footer info */}
        <div
          style={{
            borderTop: "1px solid #eee",
            paddingTop: 16,
            fontSize: 12,
            color: "#777",
            fontFamily: "'Playpen Sans', cursive",
          }}
        >
          <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#39593d", fontSize: 11 }}>
            PRAKRITI HERBS PRIVATE LIMITED
          </p>
          <p style={{ margin: "0 0 2px" }}>📍 Amer, Jaipur – 302012 (Rajasthan)</p>
          <p style={{ margin: "0 0 2px" }}>📞 +91 8968122276</p>
          <p style={{ margin: "0 0 2px" }}>📧 contact@prakritiherbs.com</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#aaa" }}>CIN: U46497RJ2025PTC109202</p>
        </div>
      </div>
    </>
  );
}
