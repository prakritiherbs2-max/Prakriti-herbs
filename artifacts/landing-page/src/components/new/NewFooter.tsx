import { useState, useEffect } from "react";

const themeGreen = "#39593d";
const font = "'Playpen Sans', cursive";

const DEFAULT_PHONE = "+91 8968122276";
const DEFAULT_EMAIL = "contact@prakritiherbs.com";

export function NewFooter() {
  const [phone, setPhone] = useState(DEFAULT_PHONE);
  const [email, setEmail] = useState(DEFAULT_EMAIL);

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.footer_phone) setPhone(data.footer_phone);
        if (data.footer_email) setEmail(data.footer_email);
      })
      .catch(() => {});
  }, []);

  return (
    <footer
      style={{
        background: themeGreen,
        color: "#ddd",
        padding: "60px 0 15px",
        fontFamily: font,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            marginBottom: 30,
          }}
        >
          {/* Left section */}
          <div style={{ flex: "1 1 280px" }}>
            <img
              src="/new-images/logo.png"
              alt="Prakriti Herbs"
              style={{
                maxWidth: 100,
                marginBottom: 14,
                filter: "brightness(0) invert(1)",
                opacity: 0.9,
              }}
            />
            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              PRAKRITI HERBS PRIVATE LIMITED
            </h4>
            <p style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
              30-31 South Part, Bilochi Nagar A, Amer
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
              Jaipur, Rajasthan – 302012
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
              Customer Support: {phone}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
              Email: {email}
            </p>
            <p style={{ margin: "0 0 4px", fontSize: "0.95em", color: "#ddd" }}>
              CIN No.: U46497RJ2025PTC109202
            </p>
          </div>

          {/* Right section */}
          <div style={{ flex: "1 1 200px" }}>
            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              MENU
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["Home", "Shop", "Our Story", "Contact us"].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    color: "#ddd",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  {item}
                </a>
              ))}
            </div>

            <h4
              style={{
                color: "#fff",
                fontWeight: "bold",
                marginBottom: 10,
                marginTop: 20,
                fontSize: 15,
              }}
            >
              OUR POLICY
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Privacy Policy",
                "Return & Refund Policy",
                "Shipping & Delivery Policy",
                "Terms & Conditions",
              ].map((item) => (
                <a
                  key={item}
                  href="#"
                  style={{
                    color: "#ddd",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            textAlign: "center",
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <p style={{ color: "#ddd", fontSize: 12, margin: 0 }}>
            © 2026, PRAKRITI HERBS PRIVATE LIMITED | CIN: U46497RJ2025PTC109202
          </p>
        </div>
      </div>
    </footer>
  );
}
