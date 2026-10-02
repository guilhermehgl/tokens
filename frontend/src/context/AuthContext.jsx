// src/context/AuthContext.jsx
import { createContext, useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const inactivityTimeout = useRef(null);
  const INACTIVITY_LIMIT = 11 * 60 * 60 * 1000; // 11h em ms

  // ----------------------------
  // LOGIN
  // ----------------------------
  const login = ({ token, user }) => {
    if (!token || !user) return;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    setToken(token);

    startInactivityTimer();
    setLoading(false);
  };

  // ----------------------------
  // LOGOUT
  // ----------------------------
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    clearTimeout(inactivityTimeout.current);
    navigate("/login");
  };

  // ----------------------------
  // TIMER DE INATIVIDADE
  // ----------------------------
  const startInactivityTimer = () => {
    clearTimeout(inactivityTimeout.current);
    inactivityTimeout.current = setTimeout(() => {
      logout();
      alert("Sessão expirada por inatividade. Faça login novamente.");
    }, INACTIVITY_LIMIT);
  };

  const resetInactivityTimer = () => {
    if (localStorage.getItem("token")) startInactivityTimer();
  };

  // ----------------------------
  // RENOVAÇÃO DE TOKEN (opcional)
  // ----------------------------
  const refreshToken = async () => {
    if (!token) return logout();

    try {
      const res = await axios.post(
        `${API_URL}/auth/refresh-token`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newToken = res.data.token;
      localStorage.setItem("token", newToken);
      setToken(newToken);
    } catch (err) {
      console.error("Erro ao renovar token:", err);
      logout();
    }
  };

  // ----------------------------
  // EFEITOS
  // ----------------------------
  useEffect(() => {
    // Restaurar sessão do localStorage
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        startInactivityTimer();
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }

    setLoading(false);

    // Resetar timer a cada atividade do usuário
    const events = ["click", "keydown", "mousemove"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));

    return () => {
      events.forEach((e) =>
        window.removeEventListener(e, resetInactivityTimer)
      );
      clearTimeout(inactivityTimeout.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
