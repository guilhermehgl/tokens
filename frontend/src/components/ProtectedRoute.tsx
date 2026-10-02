import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface Props {
  allowedRoles: string[];
  children: JSX.Element;
}

export const ProtectedRoute = ({ allowedRoles, children }: Props) => {
  const { user, loading } = useAuth();

  if (loading) return <p>Carregando autenticação...</p>;
  if (!user || !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;

  return children;
};
