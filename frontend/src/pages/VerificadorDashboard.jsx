// src/pages/VerificadorDashboard.jsx
import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { FiLogOut } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import { HeaderActions, Button, PageHeader, Card, Field, DataTable, StateMessage, Dialog, AdminTabs, Badge } from "../components/AdminUI";

export default function VerificadorDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [verifiedTokens, setVerifiedTokens] = useState([]);
  const [unverifiedTokens, setUnverifiedTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingUnverified, setLoadingUnverified] = useState(true);
  const [activeTab, setActiveTab] = useState("verify"); // verify | unverified | verifiedToday

  const { user, token, loading: authLoading, logout } = useContext(AuthContext);
  const API_URL = import.meta.env.VITE_API_URL;

  // Modais
  const [modalMessage, setModalMessage] = useState(null); // mensagens gerais
  const [modalConfirm, setModalConfirm] = useState(null); // confirmações (ex: logout)

  const isAuthorized = !authLoading && user && token && user.role === "verificador";

  // Buscar tokens já verificados hoje
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchVerifiedTokens = async () => {
      try {
        const response = await axios.get(`${API_URL}/tokens/verified-today`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (Array.isArray(response.data.tokens)) {
          const tokens = response.data.tokens.map((t) => ({
            token: t.token || "Não informado",
            companyName: t.companyName || "Empresa não encontrada",
            nfNumber: t.nfNumber || "Não informada",
            verifiedAt: t.usedAt ? new Date(t.usedAt) : new Date(),
          }));
          setVerifiedTokens(tokens);
        } else {
          setVerifiedTokens([]);
        }
      } catch (err) {
        console.error("Erro ao buscar tokens verificados:", err);
        setVerifiedTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    fetchVerifiedTokens();
  }, [isAuthorized, API_URL, token]);

  // Buscar tokens ainda não verificados
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchUnverifiedTokens = async () => {
      try {
        const response = await axios.get(`${API_URL}/tokens/unverified`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (Array.isArray(response.data.tokens)) {
          // Agrupar por empresa + NF
          const grouped = response.data.tokens.reduce((acc, t) => {
            const key = `${t.companyName}-${t.nfNumber}`;
            if (!acc[key]) {
              acc[key] = {
                companyName: t.companyName || "Empresa não encontrada",
                nfNumber: t.nfNumber || "Não informada",
                count: 0,
              };
            }
            acc[key].count++;
            return acc;
          }, {});

          setUnverifiedTokens(Object.values(grouped));
        } else {
          setUnverifiedTokens([]);
        }
      } catch (err) {
        console.error("Erro ao buscar tokens não verificados:", err);
        setUnverifiedTokens([]);
      } finally {
        setLoadingUnverified(false);
      }
    };

    fetchUnverifiedTokens();
  }, [isAuthorized, API_URL, token]);

  return (
    <div className="dashboard-page">
      {authLoading && <StateMessage loading>Carregando autenticação...</StateMessage>}
      {!authLoading && !isAuthorized && <StateMessage>Acesso negado. Você precisa estar logado como verificador.</StateMessage>}
      {isAuthorized && (
        <>
          <HeaderActions>
            <Button variant="ghost" onClick={() => setModalConfirm({ message: "Tem certeza que deseja sair?", onConfirm: logout, onCancel: () => {} })}><FiLogOut size={16} aria-hidden="true" />Sair</Button>
          </HeaderActions>
          <PageHeader title="Painel do Verificador" />
          <AdminTabs view={activeTab} onChange={setActiveTab} label="Navegação do verificador" tabs={[["verify", "Verificar token"], ["unverified", "Tokens pendentes"], ["verifiedToday", "Verificados hoje"]]} />
          {activeTab === "verify" && (
            <Card title="Verificar token">
              <form className="verifier-form" onSubmit={async (e) => {
                  e.preventDefault();
                  if (!tokenInput) {
                    return setModalMessage("Digite o token para verificar.");
                  }

                  if (!tokenInput || tokenInput.length !== 6) {
                    return setModalMessage("O token deve ter exatamente 6 caracteres.");
                  }

                  try {
                    const response = await axios.post(
                      `${API_URL}/tokens/verify`,
                      { token: tokenInput },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setModalMessage(
                      response.data.message || "Token verificado com sucesso!"
                    );
                    if (response.data.tokenData) {
                      setVerifiedTokens((prev) => [
                        { ...response.data.tokenData, verifiedAt: new Date() },
                        ...prev,
                      ]);
                    }
                    setTokenInput("");
                  } catch (err) {
                    console.error(err);
                    setModalMessage(
                      err.response?.data?.message || "Erro ao verificar token."
                    );
                  }
                }}>
                <Field label="Token de retirada">
                  <input type="text" placeholder="Digite o token" value={tokenInput} maxLength={6} onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    if (/^[A-Z0-9]*$/.test(value)) setTokenInput(value);
                  }} required />
                </Field>
                <Button variant="primary" type="submit">Verificar</Button>
              </form>
            </Card>
          )}
          {activeTab === "unverified" && (
            <Card title="Tokens pendentes">
              {loadingUnverified ? <StateMessage loading>Carregando...</StateMessage> : unverifiedTokens.length > 0 ? (
                <DataTable label="Tokens aguardando verificação" columns={["Empresa", "Nota fiscal", "Tokens pendentes"]}>
                  {unverifiedTokens.map((t, i) => (
                    <tr key={i}><td><strong>{t.companyName}</strong></td><td className="admin-document">{t.nfNumber}</td><td><Badge tone="primary">{t.count} {t.count === 1 ? "token" : "tokens"}</Badge></td></tr>
                  ))}
                </DataTable>
              ) : <StateMessage>Nenhum token pendente.</StateMessage>}
            </Card>
          )}
          {activeTab === "verifiedToday" && (
            <Card title="Tokens verificados hoje">
              {loadingTokens ? <StateMessage loading>Carregando...</StateMessage> : verifiedTokens.length > 0 ? (
                <DataTable label="Tokens verificados hoje" columns={["Empresa", "Nota fiscal", "Horário"]}>
                  {verifiedTokens.map((t, index) => (
                    <tr key={index}><td><strong>{t.companyName}</strong></td><td className="admin-document">{t.nfNumber}</td><td className="admin-date">{new Date(t.verifiedAt).toLocaleTimeString()}</td></tr>
                  ))}
                </DataTable>
              ) : <StateMessage>Nenhum token verificado hoje.</StateMessage>}
            </Card>
          )}
        </>
      )}
      {modalMessage && (
        <Dialog title="Mensagem"><p>{modalMessage}</p><div className="admin-modal-actions"><Button variant="primary" onClick={() => setModalMessage(null)}>OK</Button></div></Dialog>
      )}
      {modalConfirm && (
        <Dialog title="Confirmação"><p>{modalConfirm.message}</p><div className="admin-modal-actions">
          <Button onClick={() => { modalConfirm.onCancel?.(); setModalConfirm(null); }}>Não</Button>
          <Button variant="primary" onClick={() => { modalConfirm.onConfirm(); setModalConfirm(null); }}>Sim</Button>
        </div></Dialog>
      )}
    </div>
  );
}
