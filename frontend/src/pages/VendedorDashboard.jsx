// src/pages/VendedorDashboard.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { FiLogOut, FiPlus, FiKey } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import { HeaderActions, Button, PageHeader, Card, Field, SearchInput, DataTable, StateMessage, Dialog } from "../components/AdminUI";

import { phoneCountries, phoneE164 } from "../utils/phone";
import InternationalPhoneField from "../components/InternationalPhoneField";
import TokenDeliveryOptions from "../components/TokenDeliveryOptions";

export default function VendedorDashboard() {
  const { user, token, loading: authLoading, logout } = useContext(AuthContext);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [country, setCountry] = useState("BR");
  const [telephone, setTelephone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const submitting = useRef(false);
  const createButtonRef = useRef(null);
  const countryName = phoneCountries.find(item => item.code === country)?.name;
  const validateTelephone = () => {
    const value = phoneE164(telephone, country);
    setPhoneError(value ? "" : telephone ? `Telefone inválido para ${countryName}.` : "Informe o telefone com o código de área.");
    return value;
  };
  const closeCreate = () => { if (!submitting.current) setCreateOpen(false); };
  const [docType, setDocType] = useState("CNPJ");
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState({
    razaoSocial: "",
    documento: "",
    emailReferencia: "",
  });
  const [tokenCompany, setTokenCompany] = useState(null);
  const [tokenError, setTokenError] = useState("");
  const tokenTriggerRef = useRef(null);
  const [nfNumbers, setNfNumbers] = useState({});
  const [deliveryChannels, setDeliveryChannels] = useState({});
  const [sendingTokens, setSendingTokens] = useState({});
  const tokenRequests = useRef(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para modais
  const [modalMessage, setModalMessage] = useState(null);
  const [modalConfirm, setModalConfirm] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL;

  // -------------------------
  // FETCH COMPANIES
  // -------------------------
  const fetchCompanies = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        setCompanies(response.data);
      } else if (response.data.companies) {
        setCompanies(response.data.companies);
      } else {
        setCompanies([]);
      }
    } catch (err) {
      console.error("Erro ao carregar empresas:", err);
      setModalMessage("Erro ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [token]);

  // -------------------------
  // VALIDAR EMAIL
  // -------------------------
  const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

  // -------------------------
  // FORMATAR DOCUMENTOS PARA EXIBIÇÃO
  // -------------------------
  const formatCPF = (value) => {
    if (!value) return "";
    let cpf = value.replace(/\D/g, "").substring(0, 11);
    if (cpf.length > 9) cpf = cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})$/, "$1.$2.$3-$4");
    else if (cpf.length > 6) cpf = cpf.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
    else if (cpf.length > 3) cpf = cpf.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
    return cpf;
  };

  const formatCNPJ = (value) => {
    if (!value) return "";
    let cnpj = value.replace(/\D/g, "").substring(0, 14);
    if (cnpj.length > 12) cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    else if (cnpj.length > 8) cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, "$1.$2.$3/$4");
    else if (cnpj.length > 5) cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{0,3})$/, "$1.$2.$3");
    else if (cnpj.length > 2) cnpj = cnpj.replace(/^(\d{2})(\d{0,3})$/, "$1.$2");
    return cnpj;
  };

  // -------------------------
  // CADASTRAR EMPRESA
  // -------------------------
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    setRegistrationError("");
    const { razaoSocial, documento, emailReferencia } = newCompany;

    if (!razaoSocial || !documento || !emailReferencia) {
      setRegistrationError("Preencha todos os campos da empresa!");
      return;
    }

    if (!isValidEmail(emailReferencia)) {
      setRegistrationError("Digite um e-mail válido (ex: usuario@dominio.com).");
      return;
    }

    const numericDoc = (documento || "").replace(/\D/g, "");

    if (docType === "CNPJ" && numericDoc.length !== 14) {
      setRegistrationError("CNPJ incompleto! Digite todos os 14 dígitos.");
      return;
    }

    if (docType === "CPF" && numericDoc.length !== 11) {
      setRegistrationError("CPF incompleto! Digite todos os 11 dígitos.");
      return;
    }

    // Verifica duplicidade de documento
    const docExistente = companies.some((c) => (c.documento || "").replace(/\D/g, "") === numericDoc);
    if (docExistente) {
      setRegistrationError(`Já existe uma empresa cadastrada com este ${docType}.`);
      return;
    }

    // Verifica duplicidade de email
    const emailNormalized = emailReferencia.trim().toLowerCase();
    const emailExistente = companies.some(
      (c) => (c.emailReferencia || "").trim().toLowerCase() === emailNormalized
    );
    if (emailExistente) {
      setRegistrationError("Já existe uma empresa cadastrada com este e-mail de referência.");
      return;
    }

    const telefone = validateTelephone();
    if (!telefone) return;
    submitting.current = true;
    setCreating(true);
    try {
      await axios.post(
        `${API_URL}/companies`,
        {
          razaoSocial,
          documento: numericDoc,
          tipoDocumento: docType,
          emailReferencia,
          telefone,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCreateOpen(false);
      setModalMessage("Empresa cadastrada com sucesso!");
      setTelephone("");
      setCountry("BR");
      setPhoneError("");
      setDocType("CNPJ");
      setNewCompany({ razaoSocial: "", documento: "", emailReferencia: "" });
      fetchCompanies();
    } catch (err) {
      console.error("Erro ao cadastrar empresa:", err);
      setRegistrationError(err.response?.data?.message || "Erro ao cadastrar empresa. Tente novamente.");
    } finally {
      submitting.current = false;
      setCreating(false);
    }
  };

  // -------------------------
  // FILTRAR EMPRESAS
  // -------------------------
  const filteredCompanies = companies.filter((company) => {
    const term = searchTerm.toLowerCase();
    return (
      company.razaoSocial.toLowerCase().includes(term) ||
      (company.documento || "").replace(/\D/g, "").includes(term)
    );
  });


  // -------------------------
  // GERACAO DE TOKENS
  // -------------------------
   const handleGenerateToken = async (companyId) => {
    if (tokenRequests.current.has(companyId)) return;
    const nfNumber = nfNumbers[companyId];

    if (!nfNumber) {
      setTokenError("Digite o número da NF antes de gerar o token.");
      return;
    }

    if (nfNumber.length !== 9) {
      setTokenError("O número da NF deve ter exatamente 9 dígitos.");
      return;
    }

    setTokenError("");
    tokenRequests.current.add(companyId);
    setSendingTokens(previous => ({ ...previous, [companyId]: true }));
    const deliveryChannel = deliveryChannels[companyId] || "email";
    try {
      const response = await axios.post(
        `${API_URL}/tokens/generate`,
        { companyId, nfNumber, deliveryChannel },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setModalMessage(response.data.message || (deliveryChannel === "whatsapp" ? "Token gerado. O envio foi aceito pela Vonage; a entrega ainda não foi confirmada." : "Token gerado e enviado por e-mail."));
      setTokenCompany(null);
      setNfNumbers(previous => ({ ...previous, [companyId]: "" }));
    } catch (err) {
      const message = err.response?.data?.message || "Não foi possível confirmar o envio. Verifique o status antes de gerar outro token.";
      setTokenError(`${message}${err.response?.data?.tokenCreated ? " O token já foi gerado. Uma nova tentativa criará outro token." : ""}`);
    } finally {
      tokenRequests.current.delete(companyId);
      setSendingTokens(previous => ({ ...previous, [companyId]: false }));
    }
  };



  // -------------------------
  // JSX
  // -------------------------
  return (
    <div className="dashboard-page">
      {authLoading ? (
        <StateMessage loading>Carregando autenticação...</StateMessage>
      ) : !user || user.role !== "vendedor" ? (
        <StateMessage>Acesso negado. Você precisa estar logado como vendedor.</StateMessage>
      ) : (
        <>
          <HeaderActions>
            <Button variant="ghost" onClick={() => setModalConfirm({ message: "Tem certeza que deseja sair?", onConfirm: logout, onCancel: () => {} })}><FiLogOut size={16} aria-hidden="true" />Sair</Button>
          </HeaderActions>
          <PageHeader title="Painel do Vendedor" />
          <div className="admin-stack">
            <Card title="Empresas cadastradas" toolbar={<div className="users-list-toolbar seller-companies-toolbar">
              <SearchInput label="Pesquisar empresas por nome ou CPF/CNPJ" placeholder="Pesquisar nome ou CPF/CNPJ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <Button ref={createButtonRef} variant="primary" onClick={() => { setRegistrationError(""); setPhoneError(""); setCreateOpen(true); }}><FiPlus size={16} aria-hidden="true" />Cadastrar empresa</Button>
            </div>}>
              {loading ? <StateMessage loading>Carregando empresas...</StateMessage> : filteredCompanies.length > 0 ? (
                <DataTable label="Empresas e geração de tokens" columns={["Empresa", "CPF / CNPJ", "E-mail", "Ações"]}>
                  {filteredCompanies.map((company) => (
                    <tr key={company._id}>
                      <td><strong>{company.razaoSocial}</strong></td>
                      <td><span className="admin-document">{company.tipoDocumento === "CNPJ" ? formatCNPJ(company.documento) : formatCPF(company.documento)}</span></td>
                      <td className="admin-secondary">{company.emailReferencia}</td>
                      <td>
                        <div className="admin-row-actions"><Button variant="primary" className="seller-generate-token" onClick={event => {
                          tokenTriggerRef.current = event.currentTarget;
                          setTokenError("");
                          setNfNumbers(previous => ({ ...previous, [company._id]: "" }));
                          setDeliveryChannels(previous => ({ ...previous, [company._id]: "email" }));
                          setTokenCompany(company);
                        }}><FiKey size={17} aria-hidden="true" />Gerar token</Button></div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              ) : <StateMessage>Nenhuma empresa encontrada.</StateMessage>}
            </Card>
          </div>
        </>
      )}
      {tokenCompany && user?.role === "vendedor" && (
        <Dialog title="Gerar token" description={tokenCompany.razaoSocial} highlightDescription className="generate-token-dialog"
          onClose={() => { if (!tokenRequests.current.has(tokenCompany._id)) setTokenCompany(null); }}
          closeDisabled={Boolean(sendingTokens[tokenCompany._id])} returnFocusRef={tokenTriggerRef}>
          <form className="generate-token-form" noValidate aria-busy={Boolean(sendingTokens[tokenCompany._id])} onSubmit={event => { event.preventDefault(); handleGenerateToken(tokenCompany._id); }}>
            <Field label="Número da NF"><input type="text" inputMode="numeric" required maxLength={9} disabled={Boolean(sendingTokens[tokenCompany._id])} placeholder="Digite os 9 dígitos da NF" value={nfNumbers[tokenCompany._id] || ""}
              onChange={event => { const value = event.target.value.replace(/\D/g, "").slice(0, 9); setNfNumbers(previous => ({ ...previous, [tokenCompany._id]: value })); setTokenError(""); }} /></Field>
            <TokenDeliveryOptions company={tokenCompany} channel={deliveryChannels[tokenCompany._id] || "email"} disabled={Boolean(sendingTokens[tokenCompany._id])} onChange={channel => { setDeliveryChannels(previous => ({ ...previous, [tokenCompany._id]: channel })); setTokenError(""); }} />
            {tokenError && <p className="company-form-error" role="alert">{tokenError}</p>}
            <div className="admin-modal-actions">
              <Button disabled={Boolean(sendingTokens[tokenCompany._id])} onClick={() => { if (!tokenRequests.current.has(tokenCompany._id)) setTokenCompany(null); }}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={Boolean(sendingTokens[tokenCompany._id])}>{sendingTokens[tokenCompany._id] ? "Enviando..." : "Gerar e enviar"}</Button>
            </div>
          </form>
        </Dialog>
      )}
      {createOpen && user?.role === "vendedor" && (
        <Dialog title="Cadastrar empresa" description="Adicione uma nova empresa ao sistema." className="create-company-dialog" onClose={closeCreate} closeDisabled={creating} returnFocusRef={createButtonRef}>
          <form className="create-company-form" onSubmit={handleCreateCompany} noValidate aria-busy={creating}>
            <fieldset disabled={creating}>
              <Field label="Razão social"><input type="text" autoComplete="organization" required placeholder="Nome ou razão social" value={newCompany.razaoSocial} onChange={(e) => setNewCompany({ ...newCompany, razaoSocial: e.target.value })} /></Field>
              <fieldset className="document-type">
                <legend>Tipo de documento</legend>
                <div className="document-type-options">
                  {["CNPJ", "CPF"].map(type => <label key={type}><input type="radio" name="document-type" value={type} checked={docType === type} onChange={() => {
                    setDocType(type);
                    setNewCompany({ ...newCompany, documento: type === "CNPJ" ? formatCNPJ(newCompany.documento) : formatCPF(newCompany.documento) });
                  }} />{type}</label>)}
                </div>
              </fieldset>
              <Field label={docType}><input type="text" inputMode="numeric" required placeholder={docType === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"} value={newCompany.documento} onChange={(e) => setNewCompany({ ...newCompany, documento: docType === "CNPJ" ? formatCNPJ(e.target.value) : formatCPF(e.target.value) })} /></Field>
              <Field label="E-mail de referência"><input type="email" autoComplete="email" required placeholder="contato@empresa.com" value={newCompany.emailReferencia} onChange={(e) => setNewCompany({ ...newCompany, emailReferencia: e.target.value })} /></Field>
              <InternationalPhoneField country={country} telephone={telephone} error={phoneError} disabled={creating}
                onCountryChange={value => { setCountry(value); setTelephone(""); setPhoneError(""); }}
                onTelephoneChange={value => { setTelephone(value); setPhoneError(""); }} onBlur={validateTelephone} />
            </fieldset>
            {registrationError && <p className="company-form-error" role="alert">{registrationError}</p>}
            <div className="admin-modal-actions">
              <Button disabled={creating} onClick={closeCreate}>Cancelar</Button>
              <Button variant="primary" type="submit" disabled={creating}>{creating ? "Cadastrando..." : "Cadastrar empresa"}</Button>
            </div>
          </form>
        </Dialog>
      )}
      {!createOpen && !tokenCompany && modalMessage && (
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
