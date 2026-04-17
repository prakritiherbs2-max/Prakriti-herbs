import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import { isAdminLoggedIn } from "@/lib/adminApi";
import { firePageView, checkAndFirePurchase } from "@/lib/pixel";
import { getAgencySource } from "@/lib/visitorTracking";
import { initAgencyPixelIfNeeded, reinitAgencyPixelForPurchase } from "@/lib/agencyPixel";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/** Fires PageView on every SPA route change (after the initial one in index.html) */
function RoutePageViewTracker() {
  const [location] = useLocation();
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      // Fire server-side page view on initial load (exclude admin routes)
      if (!location.startsWith("/admin")) {
        const sessionId = sessionStorage.getItem("pv_sid") ?? (() => {
          const id = Math.random().toString(36).slice(2);
          sessionStorage.setItem("pv_sid", id);
          return id;
        })();
        fetch("/api/analytics/pageview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: location || "/", sessionId, referrer: document.referrer }),
          keepalive: true,
        }).catch(() => {});
      }
      return;
    }
    // Fire on every subsequent client-side navigation
    firePageView();
  }, [location]);
  return null;
}

/**
 * Checks if user returned from Cashfree after payment and fires Purchase.
 *
 * Awaits agency pixel re-init first so the Purchase event fires to BOTH
 * the main pixel AND the agency pixel (fixes Cashfree under-reporting for
 * agency-sourced visitors who used online payment).
 */
function PurchaseReturnDetector() {
  useEffect(() => {
    const src = getAgencySource();
    if (src) {
      // Re-init the agency pixel (bypasses sessionStorage flag) then fire Purchase
      reinitAgencyPixelForPurchase(src).then(() => {
        checkAndFirePurchase();
      });
    } else {
      checkAndFirePurchase();
    }
  }, []);
  return null;
}

/**
 * Double Pixel Tagging — if the visitor came via an agency link (e.g. ?source=taj),
 * dynamically initialise the agency's Facebook pixel in the browser.
 * After this, ALL fbq('track', ...) calls fire to BOTH Mandeep's main pixel
 * AND the agency pixel simultaneously.
 */
function AgencyPixelInit() {
  useEffect(() => {
    const src = getAgencySource();
    if (src) void initAgencyPixelIfNeeded(src);
  }, []);
  return null;
}

function ProtectedAdmin() {
  if (!isAdminLoggedIn()) {
    return <Redirect to="/admin/login" />;
  }
  return <AdminDashboard />;
}

function Router() {
  return (
    <>
      <RoutePageViewTracker />
      <PurchaseReturnDetector />
      <AgencyPixelInit />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/admin" component={() => <Redirect to="/admin/login" />} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard" component={ProtectedAdmin} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
