import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { OrdersProvider } from "@/contexts/OrdersContext";

// Client pages
import Index from "./pages/Index";
import OrderPage from "./pages/OrderPage";
import CheckoutPage from "./pages/CheckoutPage";
import ContactPage from "./pages/ContactPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import OrderConfirmationPage from "./pages/OrderConfirmationPage";
import PaymentCancelledPage from "./pages/PaymentCancelledPage";
import MentionsLegalesPage from "./pages/MentionsLegalesPage";
import ConfidentialitePage from "./pages/ConfidentialitePage";
import CGVPage from "./pages/CGVPage";
import NotFound from "./pages/NotFound";

// Admin routes are lazy-loaded so public visitors do not download admin pages upfront.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminRouteGuard = lazy(() => import("./components/admin/AdminRouteGuard"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminOrdersBoard = lazy(() => import("./pages/admin/AdminOrdersBoard"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminBeverages = lazy(() => import("./pages/admin/AdminBeverages"));
const AdminSchedule = lazy(() => import("./pages/admin/AdminSchedule"));
const AdminDelivery = lazy(() => import("./pages/admin/AdminDelivery"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <OrdersProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<div className="container py-20 text-center text-muted-foreground">Chargement…</div>}>
              <Routes>
              {/* Client */}
              <Route path="/" element={<Index />} />
              <Route path="/commander" element={<OrderPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/commande-confirmee" element={<OrderConfirmationPage />} />
              <Route path="/suivi/:token" element={<OrderTrackingPage />} />
              <Route path="/paiement-annule" element={<PaymentCancelledPage />} />
              <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
              <Route path="/confidentialite" element={<ConfidentialitePage />} />
              <Route path="/cgv" element={<CGVPage />} />

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLogin />} />

              <Route path="/admin" element={<AdminRouteGuard />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="commandes" element={<AdminOrders />} />
                  <Route path="commandes/vue" element={<AdminOrdersBoard />} />
                  <Route path="commandes/:id" element={<AdminOrderDetail />} />
                  <Route path="produits" element={<AdminProducts />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="boissons" element={<AdminBeverages />} />
                  <Route path="horaires" element={<AdminSchedule />} />
                  <Route path="livraison" element={<AdminDelivery />} />
                  <Route path="parametres" element={<AdminSettings />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </OrdersProvider>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
