import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./auth/AdminAuthContext.js";
import { LoginPage } from "./routes/LoginPage.js";
import { OrderDetailPage } from "./routes/OrderDetailPage.js";
import { OrdersPage } from "./routes/OrdersPage.js";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAdminAuth();
  if (isLoading) return <p>Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
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
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AdminAuthProvider>
      <AppRoutes />
    </AdminAuthProvider>
  );
}
