import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import DashboardVendedor from "../pages/VendedorDashboard.jsx";
import DashboardVerificador from "../pages/VerificadorDashboard.jsx";
import DashboardAdmin from "../pages/AdminDashboard.jsx";
import { ProtectedRoute } from "../components/ProtectedRoute";

const AppRoutes = () => {
  return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/vendedor" element={<ProtectedRoute allowedRoles={["vendedor"]}><DashboardVendedor /></ProtectedRoute>} />
        <Route path="/verificador" element={<ProtectedRoute allowedRoles={["verificador"]}><DashboardVerificador /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><DashboardAdmin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
  );
};

export default AppRoutes;
