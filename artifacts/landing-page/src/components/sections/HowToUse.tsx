import { motion } from "framer-motion";
import { CheckCircle, Clock, Droplets } from "lucide-react";

const benefits = [
  "वैवाहिक जीवन में नई ऊर्जा और जोश लाएं",
  "शारीरिक कमज़ोरी और थकान से छुटकारा पाएं",
  "स्टैमिना और परफॉर्मेंस में ज़बरदस्त सुधार",
  "100% आयुर्वेदिक – कोई भी साइड इफेक्ट नहीं",
  "7 दिनों में असर, 30 दिनों में पूरा बदलाव",
  "आत्मविश्वास और मानसिक शक्ति में वृद्धि",
];

const steps = [
  {
    icon: Clock,
    title: "कैप्सूल लेने का सही समय",
    desc: "रोजाना रात को खाना खाने के आधे घंटे बाद 1 कैप्सूल लें।",
  },
  {
    icon: Droplets,
    title: "तेल से मालिश",
    desc: "सोने से पहले तेल से हल्की मालिश करें।",
  },
];

export function HowToUse() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none"></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-primary font-bold tracking-wider uppercase text-sm">Product Information</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-4 mb-4">
            <span className="text-gradient">KamaSutra Gold+</span> के फायदे
          </h2>
          <p className="text-muted-foreground text-lg">
            प्राकृतिक जड़ी-बूटियों से बना, पुरुषों के लिए विशेष आयुर्वेदिक फार्मूला
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold mb-6 font-display text-secondary">✨ मुख्य फायदे</h3>
            <div className="space-y-4">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground font-medium">{b}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h3 className="text-2xl font-bold mb-6 font-display text-secondary">📋 कैसे इस्तेमाल करें</h3>
            <div className="space-y-5">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-5 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">{step.title}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm text-foreground font-semibold">
                ⚠️ सलाह: इसे लगातार 90 दिन उपयोग करने पर सर्वोत्तम परिणाम मिलते हैं। किसी गंभीर बीमारी में डॉक्टर से सलाह लें।
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
