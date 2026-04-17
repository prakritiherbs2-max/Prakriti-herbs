import { useEffect, useState } from "react";
import { Clock, Tag } from "lucide-react";

const INITIAL_SECONDS = 14 * 60 + 59;

export function UrgencyBar() {
  const [seconds, setSeconds] = useState(INITIAL_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="bg-red-600 text-white py-2.5 px-4 text-center text-sm font-semibold relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-red-700 via-red-500 to-red-700 opacity-60 animate-pulse"></div>
      <div className="relative z-10 flex items-center justify-center flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" />
          Special Offer: Extra 10% Off &amp; Free Delivery ends in
        </span>
        <span className="flex items-center gap-1.5 font-mono font-bold tracking-wider bg-white/20 px-3 py-0.5 rounded-full">
          <Clock className="w-3.5 h-3.5" />
          {pad(m)}:{pad(s)} minutes!
        </span>
      </div>
    </div>
  );
}
