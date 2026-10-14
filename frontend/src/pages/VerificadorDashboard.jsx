// src/pages/VerificadorDashboard.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "../api/client";
import { FiLogOut, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import { HeaderActions, Button, PageHeader, Card, Field, SearchInput, DataTable, StateMessage, Dialog, AdminTabs } from "../components/AdminUI";

export default function VerificadorDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verifyRequest = useRef(false);
  const verifyButtonRef = useRef(null);
  const [verifiedTokens, setVerifiedTokens] = useState([]);
  const [unverifiedTokens, setUnverifiedTokens] = useState([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [verifiedSearch, setVerifiedSearch] = useState("");
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingUnverified, setLoadingUnverified] = useState(true);
  const [activeTab, setActiveTab] = useState("verify"); // verify | unverified | verifiedToday

  const { user, token, loading: authLoading, logout } = useContext(AuthContext);
  const API_URL = import.meta.env.VITE_API_URL || '/api';

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
        console.error("Erro ao buscar tokens verificados:");
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
          setUnverifiedTokens(response.data.tokens
            .filter(t => new Date(t.expiresAt).getTime() > Date.now())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        } else {
          setUnverifiedTokens([]);
        }
      } catch (err) {
        console.error("Erro ao buscar tokens não verificados:");
        setUnverifiedTokens([]);
      } finally {
        setLoadingUnverified(false);
      }
    };

    fetchUnverifiedTokens();
  }, [isAuthorized, API_URL, token]);

  const normalizeSearch = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const matchesSearch = (item, search) => {
    const term = normalizeSearch(search);
    return normalizeSearch(item.companyName).includes(term) || normalizeSearch(item.nfNumber).includes(term);
  };
  const filteredPending = unverifiedTokens.filter(item => matchesSearch(item, pendingSearch));
  const filteredVerified = verifiedTokens.filter(item => matchesSearch(item, verifiedSearch));

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
              <form className="verifier-form" noValidate aria-busy={verifying} onSubmit={async (e) => {
                  e.preventDefault();
                  if (verifyRequest.current) return;
                  if (!tokenInput) {
                    return setModalMessage({ title: "Informe o token", message: "Digite o código de retirada para fazer a verificação.", success: false });
                  }

                  if (!tokenInput || tokenInput.length !== 6) {
                    return setModalMessage({ title: "Token incompleto", message: "O token deve ter exatamente 6 caracteres. Confira o código recebido.", success: false, token: tokenInput });
                  }

                  const submittedToken = tokenInput;
                  verifyRequest.current = true;
                  setVerifying(true);
                  try {
                    const response = await axios.post(
                      `${API_URL}/tokens/verify`,
                      { token: tokenInput },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setModalMessage({ title: "Token validado com sucesso", message: "Retirada liberada. O token foi validado e marcado como utilizado.", success: true, token: submittedToken, data: response.data.tokenData });
                    if (response.data.tokenData) {
                      setVerifiedTokens((prev) => [
                        { ...response.data.tokenData, verifiedAt: new Date() },
                        ...prev,
                      ]);
                    }
                    setTokenInput("");
                  } catch (err) {
                    const code = err.response?.data?.code;
                    const titles = { expired_token: "Token vencido", used_token: "Token já utilizado", invalid_token: "Token inválido" };
                    setModalMessage({ title: titles[code] || "Não foi possível verificar", message: err.response?.data?.message || "Não foi possível confirmar a verificação. Confira a conexão e o status do token antes de tentar novamente.", success: false, token: submittedToken });
                  } finally {
                    verifyRequest.current = false;
                    setVerifying(false);
                  }
                }}>
                <Field label="Token de retirada">
                  <input type="text" disabled={verifying} placeholder="Digite o token" value={tokenInput} maxLength={6} onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    if (/^[A-Z0-9]*$/.test(value)) setTokenInput(value);
                  }} required />
                </Field>
                <Button ref={verifyButtonRef} variant="primary" type="submit" disabled={verifying}>{verifying ? "Verificando..." : "Verificar"}</Button>
              </form>
            </Card>
          )}
          {activeTab === "unverified" && (
            <Card title="Tokens pendentes" toolbar={<SearchInput label="Pesquisar pendentes por empresa ou nota fiscal" placeholder="Pesquisar empresa ou NF" value={pendingSearch} onChange={event => setPendingSearch(event.target.value)} />}>
              {loadingUnverified ? <StateMessage loading>Carregando...</StateMessage> : filteredPending.length > 0 ? (
                <DataTable label="Tokens aguardando verificação" columns={["Empresa", "Nota fiscal", "Válido até"]}>
                  {filteredPending.map((t, i) => (
                    <tr key={t._id || i}><td><strong>{t.companyName}</strong></td><td className="admin-document">{t.nfNumber}</td><td className="admin-date">{new Date(t.expiresAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td></tr>
                  ))}
                </DataTable>
              ) : <StateMessage>{pendingSearch.trim() ? "Nenhum token pendente encontrado para essa pesquisa." : "Nenhum token pendente."}</StateMessage>}
            </Card>
          )}
          {activeTab === "verifiedToday" && (
            <Card title="Tokens verificados hoje" toolbar={<SearchInput label="Pesquisar verificados hoje por empresa ou nota fiscal" placeholder="Pesquisar empresa ou NF" value={verifiedSearch} onChange={event => setVerifiedSearch(event.target.value)} />}>
              {loadingTokens ? <StateMessage loading>Carregando...</StateMessage> : filteredVerified.length > 0 ? (
                <DataTable label="Tokens verificados hoje" columns={["Empresa", "Nota fiscal", "Horário"]}>
                  {filteredVerified.map((t, index) => (
                    <tr key={index}><td><strong>{t.companyName}</strong></td><td className="admin-document">{t.nfNumber}</td><td className="admin-date">{new Date(t.verifiedAt).toLocaleTimeString()}</td></tr>
                  ))}
                </DataTable>
              ) : <StateMessage>{verifiedSearch.trim() ? "Nenhum token verificado encontrado para essa pesquisa." : "Nenhum token verificado hoje."}</StateMessage>}
            </Card>
          )}
        </>
      )}
      {modalMessage && (
        <Dialog title={modalMessage.title || "Mensagem"} className={`verification-result-dialog ${modalMessage.success ? "verification-result--success" : "verification-result--error"}`} onClose={() => setModalMessage(null)} returnFocusRef={verifyButtonRef}>
          <div className="verification-result-banner" role="status">
            {modalMessage.success ? <FiCheckCircle size={30} aria-hidden="true" /> : <FiAlertCircle size={30} aria-hidden="true" />}
            <p>{modalMessage.message || modalMessage}</p>
          </div>
          {modalMessage.token && <dl className="verification-result-details">
            <div><dt>Token informado</dt><dd className="verification-result-token">{modalMessage.token}</dd></div>
            {modalMessage.success && <>
              <div><dt>Cliente / empresa</dt><dd>{modalMessage.data?.companyName || "Não informado"}</dd></div>
              <div><dt>Nota fiscal</dt><dd>{modalMessage.data?.nfNumber || "Não informada"}</dd></div>
              {modalMessage.data?.usedAt && <div><dt>Verificado em</dt><dd>{new Date(modalMessage.data.usedAt).toLocaleString("pt-BR")}</dd></div>}
            </>}
          </dl>}
          <div className="admin-modal-actions"><Button variant="primary" onClick={() => setModalMessage(null)}>{modalMessage.success ? "Concluir" : "Entendi"}</Button></div>
        </Dialog>
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
