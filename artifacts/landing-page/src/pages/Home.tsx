import { useState, useEffect } from "react";
import { NewTopbar } from "@/components/new/NewTopbar";
import { NewNavbar } from "@/components/new/NewNavbar";
import { NewProductHero } from "@/components/new/NewProductHero";
import { NewFooter } from "@/components/new/NewFooter";
import { OrderModal } from "@/components/new/OrderModal";
import { Reviews } from "@/components/sections/Reviews";
import { LiveOrderPopup } from "@/components/LiveOrderPopup";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    /* Listen for any component firing openOrderModal event */
    const handler = () => setModalOpen(true);
    window.addEventListener("openOrderModal", handler);
    return () => window.removeEventListener("openOrderModal", handler);
  }, []);

  useEffect(() => {
    /* Fetch popup banner URL from admin settings (public endpoint) */
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.popup_banner_url) setBannerUrl(data.popup_banner_url);
      })
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Playpen Sans', cursive",
        overflowX: "hidden",
      }}
    >
      {/* Top announcement bar */}
      <NewTopbar />

      {/* Sticky navbar with mobile sidebar */}
      <NewNavbar />

      <main>
        {/* New Shopify-style product hero section */}
        <NewProductHero />

        {/* Customer reviews — kept from existing design */}
        {/* <Reviews /> */}

        {/* Anchor for old scroll-to links — invisible */}
        <div id="order-form" />
      </main>

      {/* New dark-green footer */}
      <NewFooter />

      {/* Order Modal — opens on any "Order Now" click */}
      <OrderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        bannerUrl={bannerUrl}
      />

      {/* Live order social proof popup — kept intact */}
      <LiveOrderPopup />
    </div>
  );
}
