import React, { useState, useContext } from "react";
import axios from "../api/client";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./login.css"; // CSS específico para a tela de login
import img from "../assets/img-login.png"
import { demoAccounts } from "../utils/demoAccounts";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState(null);

  const navigate = useNavigate();
  const { login, sessionMessage } = useContext(AuthContext);

  const API_URL = import.meta.env.VITE_API_URL || '/api';
  const demoHelp = demoAccounts(import.meta.env.VITE_DEMO_ACCOUNTS);

  const handleLogin = async (e) => {
    e?.preventDefault();
    const selectedEmail = email;
    const selectedPassword = password;
    setLoading(true);

    if (!selectedEmail || !selectedPassword) {
      setModalMessage("Preencha e-mail e senha.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email: selectedEmail, password: selectedPassword });
      const { token, user } = response.data;

      if (!token || !user) {
        console.error("Token ou usuário não recebidos corretamente:");
        setModalMessage("Erro no login. Verifique o console.");
        setLoading(false);
        return;
      }

      login({ token, user });

      switch (user.role) {
        case "admin":
          navigate("/admin");
          break;
        case "vendedor":
          navigate("/vendedor");
          break;
        case "verificador":
          navigate("/verificador");
          break;
        default:
          setModalMessage("Função de usuário não reconhecida.");
          break;
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro no login:");
      setModalMessage(error.response?.data?.message || "Credenciais inválidas ou erro no servidor.");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-image-container">
        <img src={img} alt="Login" />
      </div>

      <div className="login-form-container">
        <h1>Acessar o portal</h1>
        {sessionMessage && <p role="status">{sessionMessage}</p>}
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="E-mail"
            aria-label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <div className="login-password-field">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            aria-label="Senha"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button type="button" className="login-password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} aria-controls="login-password" disabled={loading} onClick={() => setShowPassword((visible) => !visible)}>
            {showPassword ? <FiEyeOff size={20} aria-hidden="true" /> : <FiEye size={20} aria-hidden="true" />}
          </button>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {modalMessage && <p className="login-error" role="alert">{modalMessage}</p>}
        </form>
        <details className="demo-help">
          <summary>Como experimentar a demonstração</summary>
          <p>{demoHelp.label}</p>
          {demoHelp.emails.length > 0 && <p>Use {demoHelp.emails.join(", ")}.</p>}
          {demoHelp.password && <p>Senha: <code>{demoHelp.password}</code></p>}
          <p>{demoHelp.guidance}</p>
        </details>
      </div>



    </div>
  );
}
