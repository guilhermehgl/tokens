import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Login from "../pages/Login";
const DashboardVendedor = lazy(() => import("../pages/VendedorDashboard.jsx"));
const DashboardVerificador = lazy(() => import("../pages/VerificadorDashboard.jsx"));
const DashboardAdmin = lazy(() => import("../pages/AdminDashboard.jsx"));
import { ProtectedRoute } from "../components/ProtectedRoute";

const AppRoutes = () => {
  return (
      <Suspense fallback={<p role="status">Carregando painel...</p>}><Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/vendedor" element={<ProtectedRoute allowedRoles={["vendedor"]}><DashboardVendedor /></ProtectedRoute>} />
        <Route path="/verificador" element={<ProtectedRoute allowedRoles={["verificador"]}><DashboardVerificador /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><DashboardAdmin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes></Suspense>
  );
};

export default AppRoutes;
