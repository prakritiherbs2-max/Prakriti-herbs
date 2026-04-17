import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";

const orders = [
  { name: "Rohit", city: "Delhi", qty: 2 },
  { name: "Amit", city: "Jaipur", qty: 1 },
  { name: "Suresh", city: "Lucknow", qty: 3 },
  { name: "Vikram", city: "Mumbai", qty: 2 },
  { name: "Deepak", city: "Pune", qty: 1 },
  { name: "Manoj", city: "Ahmedabad", qty: 2 },
  { name: "Rajesh", city: "Bhopal", qty: 1 },
  { name: "Sanjay", city: "Hyderabad", qty: 3 },
  { name: "Anil", city: "Kolkata", qty: 2 },
  { name: "Pankaj", city: "Chandigarh", qty: 1 },
];

export function LiveOrderPopup() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const show = () => {
      setCurrent((c) => (c + 1) % orders.length);
      setVisible(true);
      setTimeout(() => setVisible(false), 3500);
    };

    const timer = setInterval(show, 6000);
    const initial = setTimeout(show, 3000);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, []);

  const order = orders[current];

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="bg-white border border-primary/20 rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-[260px]"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground leading-tight">
                {order.name} from {order.city}
              </p>
              <p className="text-xs text-muted-foreground">
                just ordered {order.qty} pack{order.qty > 1 ? "s" : ""} 🎉
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
