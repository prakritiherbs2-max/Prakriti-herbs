import { motion } from "framer-motion";
import { Star, Crown } from "lucide-react";

const reviews = [
  {
    name: "Rajesh Kumar",
    location: "Delhi",
    rating: 5,
    text: "7 दिन में ही फर्क महसूस हुआ। पहले थकान रहती थी, अब पूरे दिन energy रहती है। बिल्कुल असली आयुर्वेदिक प्रोडक्ट है!",
    initials: "RK",
    isTop: true,
  },
  {
    name: "Suresh Tiwari",
    location: "Lucknow",
    rating: 5,
    text: "Premium packaging और असरदार formula. Ashwagandha और Shilajit का combination जबरदस्त है। दोबारा order करूँगा।",
    initials: "ST",
  },
  {
    name: "Amit Sharma",
    location: "Jaipur",
    rating: 5,
    text: "पत्नी ने मेरे लिए order किया था। 2 हफ्तों में जो बदलाव आया वो बेमिसाल है। COD option बहुत convenient है।",
    initials: "AS",
  },
  {
    name: "Priya Malhotra",
    location: "Mumbai",
    rating: 5,
    text: "Husband के लिए लिया, बहुत खुश हैं दोनों। Natural ingredients तो हैं ही, packaging भी बहुत discreet थी।",
    initials: "PM",
  },
  {
    name: "Vikram Singh",
    location: "Pune",
    rating: 5,
    text: "3 महीने से use कर रहा हूँ। Stamina में जबरदस्त सुधार। No side effects — 100% recommend करता हूँ।",
    initials: "VS",
  },
  {
    name: "Manoj Patel",
    location: "Ahmedabad",
    rating: 5,
    text: "बहुत अच्छा product है। पहले डर था कि काम करेगा या नहीं, लेकिन 10 दिन में ही confidence वापस आ गया।",
    initials: "MP",
  },
  {
    name: "Deepak Verma",
    location: "Bhopal",
    rating: 5,
    text: "Prakriti Herbs का यह product बेहतरीन है। Shilajit और Safed Musli का effect एक हफ्ते में feel होता है।",
    initials: "DV",
  },
  {
    name: "Sanjay Yadav",
    location: "Hyderabad",
    rating: 5,
    text: "COD पर मंगाया, delivery fast आई और packaging बिल्कुल plain थी। Quality से 100% satisfied हूँ।",
    initials: "SY",
  },
];

export function Reviews() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-primary font-bold tracking-wider uppercase text-sm">Real Customers</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mt-4 mb-4">
            हज़ारों खुश <span className="text-gradient">ग्राहक</span>
          </h2>
          <p className="text-muted-foreground text-lg">Verified Indian customers sharing their real experience</p>
          <div className="flex items-center justify-center gap-1 mt-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-primary text-primary" />
            ))}
            <span className="ml-2 font-bold text-foreground">4.9/5</span>
            <span className="text-muted-foreground ml-1">(2,400+ Reviews)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {reviews.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.07 }}
              className={`bg-card p-6 rounded-2xl shadow-sm border transition-shadow relative ${
                review.isTop
                  ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                  : "border-border hover:shadow-md"
              }`}
            >
              {review.isTop && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full gold-gradient text-[#1B5E20] text-xs font-bold shadow">
                    <Crown className="w-3 h-3" />
                    Top Review
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm font-display shrink-0">
                  {review.initials}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">{review.name}</h4>
                  <p className="text-xs text-muted-foreground">{review.location}</p>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3 text-primary">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? "fill-current" : "opacity-30"}`} />
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">"{review.text}"</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
