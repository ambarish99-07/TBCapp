import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./auth/AdminAuthContext.js";
import { Layout } from "./components/Layout.js";
import { NewOrderAlertBanner } from "./components/NewOrderAlertBanner.js";
import { useNewOrderAlerts } from "./notifications/useNewOrderAlerts.js";
import { BrandsPage } from "./routes/BrandsPage.js";
import { BulkOrdersPage } from "./routes/BulkOrdersPage.js";
import { LoginPage } from "./routes/LoginPage.js";
import { OrderDetailPage } from "./routes/OrderDetailPage.js";
import { OrdersPage } from "./routes/OrdersPage.js";
import { TiffinDeliveriesPage } from "./routes/TiffinDeliveriesPage.js";
import { TiffinMealPricesPage } from "./routes/TiffinMealPricesPage.js";
import { TiffinPlansPage } from "./routes/TiffinPlansPage.js";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAdminAuth();
  if (isLoading) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

/** Polls for new orders and shows the SOS-style alert banner for as long as an admin is logged in, on every page. */
function NewOrderAlerts() {
  const { user } = useAdminAuth();
  const { newOrders, dismiss, dismissAll } = useNewOrderAlerts(!!user);

  if (!user) return null;
  return <NewOrderAlertBanner newOrders={newOrders} onDismiss={dismiss} onDismissAll={dismissAll} />;
}

function AppRoutes() {
  return (
    <>
      <NewOrderAlerts />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/orders"
          element={
            <RequireAdmin>
              <OrdersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAdmin>
              <OrderDetailPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/bulk-orders"
          element={
            <RequireAdmin>
              <BulkOrdersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/brands"
          element={
            <RequireAdmin>
              <BrandsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/tiffin-plans"
          element={
            <RequireAdmin>
              <TiffinPlansPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/tiffin-deliveries"
          element={
            <RequireAdmin>
              <TiffinDeliveriesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/tiffin-meal-prices"
          element={
            <RequireAdmin>
              <TiffinMealPricesPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <AdminAuthProvider>
      <AppRoutes />
    </AdminAuthProvider>
  );
}
