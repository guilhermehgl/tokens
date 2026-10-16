import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { validSession, sessionExpiry, sameSessionUser } from "../utils/session";
export const AuthContext = createContext({});
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null),
    [token, setToken] = useState(null),
    [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");
  const navigate = useNavigate();
  const login = useCallback(({ token, user }) => {
    if (
      !validSession(token) ||
      !user ||
      !["admin", "vendedor", "verificador"].includes(user.role)
    )
      return false;
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    setToken(token);
    setSessionMessage("");
    setLoading(false);
    return true;
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setLoading(false);
    navigate("/login", { replace: true });
  }, [navigate]);
  useEffect(() => {
    const controller = new AbortController();
    const stored = localStorage.getItem("token");
    if (!validSession(stored)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoading(false);
      return;
    }
    api
      .post(
        (import.meta.env.VITE_API_URL || "/api") + "/auth/refresh-token",
        {},
        {
          headers: { Authorization: "Bearer " + stored },
          signal: controller.signal,
        },
      )
      .then(({ data }) => {
        if (
          !controller.signal.aborted &&
          localStorage.getItem("token") === stored &&
          !login(data)
        )
          throw new Error("Sessão inválida");
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          localStorage.getItem("token") === stored
        ) {
          setSessionMessage(
            "Não foi possível restaurar a sessão. Entre novamente.",
          );
          logout();
        }
      });
    return () => controller.abort();
  }, [login, logout]);
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(
      () => {
        setSessionMessage("Sessão expirada. Entre novamente.");
        logout();
      },
      Math.max(0, sessionExpiry(token) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [token, logout]);
  useEffect(() => {
    const invalid = () => {
      setSessionMessage("Sessão inválida ou expirada. Entre novamente.");
      logout();
    };
    const sync = (event) => {
      if ((event.key === "token" && !event.newValue) || event.key === null)
        logout();
      else if (event.key === "token") {
        if (validSession(event.newValue) && sameSessionUser(token, event.newValue)) {
          setToken(event.newValue);
          return;
        }
        // Não apaga a sessão que acaba de ser aberta na outra aba.
        setUser(null);
        setToken(null);
        setLoading(false);
        setSessionMessage(
          "A conta foi alterada em outra aba. Entre novamente para continuar nesta aba.",
        );
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("session-invalid", invalid);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("session-invalid", invalid);
      window.removeEventListener("storage", sync);
    };
  }, [logout, navigate, token]);
  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, loading, sessionMessage }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);
