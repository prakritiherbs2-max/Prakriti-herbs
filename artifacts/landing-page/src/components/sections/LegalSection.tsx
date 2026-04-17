import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const sections = [
  {
    id: "disclaimer",
    title: "Disclaimer",
    content: `KamaSutra Gold+ is an Ayurvedic proprietary medicine manufactured by Prakriti Herbs Private Limited. This product is not intended to diagnose, treat, cure, or prevent any disease. Results may vary from person to person. The statements made on this website have not been evaluated by any regulatory authority.

This product is meant for adult males above 18 years of age only. Consult a qualified Ayurvedic or medical practitioner before use if you have any underlying health condition, are on prescription medication, or have known allergies to any of the listed ingredients.

Do not exceed the recommended dosage. Keep out of reach of children. Store in a cool, dry place away from direct sunlight.`,
  },
  {
    id: "terms",
    title: "Terms & Conditions",
    content: `1. AGE RESTRICTION: This product is strictly for adults aged 18 years and above. By placing an order, you confirm that you are 18 years or older.

2. CASH ON DELIVERY (COD): We offer COD facility across India. The order amount is to be paid in full to the delivery executive at the time of delivery. Please keep exact change ready.

3. DELIVERY TIME: Orders are typically dispatched within 24–48 hours of confirmation. Estimated delivery time is 4–7 business days depending on your location. Remote areas may take longer.

4. ORDER CANCELLATION: Orders can be cancelled before dispatch by calling our helpline. Once dispatched, cancellation is not possible.

5. RETURN & REFUND: Returns are accepted only if the product is received in damaged or incorrect condition. Report must be raised within 24 hours of delivery with photographic evidence. Refunds will be processed within 7–10 business days after verification.

6. PRODUCT AUTHENTICITY: All products sold on this website are 100% genuine and sourced directly from Prakriti Herbs Private Limited.

7. PRIVACY: Your personal information (name, phone, address) is collected solely for order fulfillment purposes and is not shared with any third party for marketing purposes.

8. GOVERNING LAW: These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Haryana, India.`,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    content: `Prakriti Herbs Private Limited ("we", "us", or "our") is committed to protecting your personal data and privacy.

INFORMATION WE COLLECT:
We collect your name, mobile number, delivery address, and pincode for the sole purpose of processing and delivering your order.

HOW WE USE YOUR DATA:
- To process and confirm your order
- To communicate order status and delivery updates via phone/WhatsApp
- To maintain internal sales records (Google Sheets CRM)
Your data is never sold, rented, or shared with external marketing parties.

DISCREET PACKAGING:
All orders are shipped in plain, neutral outer packaging. There is no brand name, product name, or any indication of the product's nature on the outer box or label. Your privacy is fully protected throughout delivery.

DATA RETENTION:
Order data is retained for a period of 2 years for business and legal compliance purposes.

YOUR RIGHTS:
You may request deletion or correction of your personal data by contacting us at the number listed below.

CONTACT:
For any privacy-related concerns, call or WhatsApp us at +91 89681 22246.`,
  },
];

function LegalAccordion({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 bg-card hover:bg-muted/40 transition-colors text-left"
      >
        <span className="font-bold text-foreground">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-6 py-5 bg-muted/20 border-t border-border/40">
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{content}</p>
        </div>
      )}
    </div>
  );
}

export function LegalSection() {
  return (
    <section className="py-16 bg-muted/30 border-t border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8 text-muted-foreground uppercase tracking-wider text-sm">
            Legal Information
          </h2>
          <div className="space-y-3">
            {sections.map((s) => (
              <LegalAccordion key={s.id} title={s.title} content={s.content} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
