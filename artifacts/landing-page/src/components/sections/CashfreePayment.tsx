const CASHFREE_PAYMENT_URL = "CASHFREE_URL_PLACEHOLDER";

export function CashfreePayment() {
  return (
    <section className="py-12 bg-background border-t border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-red-600 font-bold text-xl md:text-2xl mb-2">
            ऑनलाइन पेमेंट करें और 10% की छूट पाएं!
          </p>
          <p className="text-muted-foreground text-sm md:text-base mb-8">
            ऑनलाइन पेमेंट करने पर आपका पार्सल जल्दी पहुंचेगा और 100% सुरक्षा की गारंटी है।
          </p>

          <a
            href={CASHFREE_PAYMENT_URL}
            target="_parent"
            className="inline-block"
            rel="noopener noreferrer"
          >
            <div
              style={{
                background: "#000",
                border: "1px solid gold",
                borderRadius: "15px",
                display: "flex",
                alignItems: "center",
                padding: "10px 16px",
                cursor: "pointer",
                textDecoration: "none",
                gap: "0",
              }}
            >
              <img
                src="https://cashfree-checkoutcartimages-prod.cashfree.com/Prakriti Herbs (1)Ea4uq7u9fiug_prod.png"
                alt="Prakriti Herbs"
                style={{ width: "40px", height: "40px", borderRadius: "4px" }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginLeft: "10px",
                  justifyContent: "center",
                  marginRight: "10px",
                }}
              >
                <div
                  style={{
                    fontFamily: "Arial",
                    color: "#fff",
                    marginBottom: "5px",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                >
                  Pay Now (Get 10% OFF)
                </div>
                <div
                  style={{
                    fontFamily: "Arial",
                    color: "#fff",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>Powered By Cashfree</span>
                  <img
                    src="https://cashfreelogo.cashfree.com/cashfreepayments/logosvgs/Group_4355.svg"
                    alt="Cashfree"
                    style={{ width: "16px", height: "16px", verticalAlign: "middle" }}
                  />
                </div>
              </div>
            </div>
          </a>

          <p className="mt-6 text-xs text-muted-foreground">
            🔒 Secured by Cashfree Payments • UPI, Cards, Net Banking accepted
          </p>
        </div>
      </div>
    </section>
  );
}
