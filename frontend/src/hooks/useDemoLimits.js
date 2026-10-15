import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
export function useDemoLimits(token, enabled) {
  const [limits, setLimits] = useState(null), [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!token || !enabled) return;
    try {
      const { data } = await api.get(`${import.meta.env.VITE_API_URL || '/api'}/demo/limits`, { headers: { Authorization: `Bearer ${token}` } });
      if (!data.enabled) throw new Error();
      setLimits(data); setError("");
    } catch { setError("Não foi possível consultar os limites. As consultas continuam disponíveis; tente atualizar as cotas."); }
  }, [token, enabled]);
  useEffect(() => {
    if (!enabled) { setLimits(null); setError(""); return; }
    refresh(); const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [enabled, refresh]);
  return { limits, error, refresh };
}
