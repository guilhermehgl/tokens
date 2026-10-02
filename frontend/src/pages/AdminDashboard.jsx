// src/pages/AdminDashboard.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { FiLogOut, FiPlus, FiEye, FiEyeOff, FiTrash2, FiEdit2 } from "react-icons/fi";
import { AuthContext } from "../context/AuthContext";
import AuditDetails from "../components/AuditDetails";
import InternationalPhoneField from "../components/InternationalPhoneField";
import { phoneE164 } from "../utils/phone";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { auditSummary, auditTone, auditDate } from "../utils/auditPresentation";
import { Button, Badge, Card, Field, SearchInput, DataTable, StateMessage, PageHeader, AdminTabs, HeaderActions, Dialog, roleLabels, auditActionLabels } from "../components/AdminUI";

export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("vendedor");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createError, setCreateError] = useState("");
  const createRequestRef = useRef(false);
  const createTriggerRef = useRef(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [view, setView] = useState("users");
  const [editingUserId, setEditingUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const passwordRequestRef = useRef(false);
  const passwordTriggerRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modal, setModal] = useState({ visible: false, title: "", message: "" });
  const [confirmModal, setConfirmModal] = useState({ visible: false, userId: null, userRole: "" });
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [editingCompanyData, setEditingCompanyData] = useState({});
  const [companyEditError, setCompanyEditError] = useState("");
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const companyRequestRef = useRef(false);
  const companyTriggerRef = useRef(null);

  // novo estado para modal de logout
  const [confirmLogoutModal, setConfirmLogoutModal] = useState(false);

  // filtros da auditoria
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");
  const [logPageSize, setLogPageSize] = useState(25);
  const [logPage, setLogPage] = useState(1);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const auditDetailTriggerRef = useRef(null);

  const [darkMode, setDarkMode] = useState(() => {
  // Tenta carregar a preferência salva no localStorage
  return localStorage.getItem("darkMode") === "true" || false;
});


  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("token");
  const currentUserEmail = user?.email;

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      setModal({ visible: true, title: "Erro", message: "Falha ao carregar usuários." });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(response.data);
    } catch (error) {
      console.error("Erro ao buscar auditoria:", error);
      setModal({ visible: true, title: "Erro", message: "Falha ao carregar logs de auditoria." });
    } finally {
      setLoadingLogs(false);
    }
  };

  const filteredCompanies = companies.filter((company) => {
  const term = searchTerm.toLowerCase();
  return (
    (company.razaoSocial || "").toLowerCase().includes(term) ||
    ((company.documento || "").replace(/\D/g, "").includes(term))
  );
});



  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, []);

  useEffect(() => {
  fetchCompanies();
}, [token]);



  const isPasswordValid = (password) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    return regex.test(password);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (createRequestRef.current) return;
    setCreateError("");
    if (!nome || !email || !password) {
      setCreateError("Preencha todos os campos!");
      return;
    }

    // validação de email já existente no frontend
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setCreateError("Este email já está cadastrado.");
      return;
    }

    if (!isPasswordValid(password)) {
      setCreateError("Senha inválida! A senha deve ter no mínimo 8 caracteres, pelo menos 1 letra, 1 número e 1 símbolo especial.");
      return;
    }

    createRequestRef.current = true;
    setIsCreatingUser(true);
    try {
      await axios.post(
        `${API_URL}/auth/create`,
        { nome, email, password, role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCreateUserOpen(false);
      setModal({ visible: true, title: "Sucesso", message: "Usuário criado com sucesso!" });
      setNome("");
      setEmail("");
      setPassword("");
      setShowCreatePassword(false);
      setRole("vendedor");
      fetchUsers();
    } catch (error) {
      console.error("Erro ao criar usuário:", error.response || error.message);
      if (error.response?.data?.message?.includes("email")) {
        setCreateError("Este email já está cadastrado.");
      } else {
        setCreateError("Erro ao criar usuário.");
      }
    } finally {
      createRequestRef.current = false;
      setIsCreatingUser(false);
    }
  };

  const confirmDeleteUser = (userId, userRole) => {
    if (userRole === "admin") {
      setModal({ visible: true, title: "Aviso", message: "Não é permitido excluir administradores." });
      return;
    }
    setConfirmModal({ visible: true, userId, userRole });
  };

  const handleDeleteUser = async () => {
    const { userId } = confirmModal;
    try {
      await axios.delete(`${API_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setModal({ visible: true, title: "Sucesso", message: "Usuário excluído com sucesso!" });
      fetchUsers();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error.response || error.message);
      setModal({ visible: true, title: "Erro", message: "Erro ao excluir usuário." });
    } finally {
      setConfirmModal({ visible: false, userId: null, userRole: "" });
    }
  };

// Formata CPF
const formatCPF = (value = "") => {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (v.length > 3) return v.replace(/(\d{3})(\d{0,3})/, "$1.$2");
  return v;
};

// Formata CNPJ
const formatCNPJ = (value = "") => {
  const v = value.replace(/\D/g, "").slice(0, 14);
  if (v.length > 12) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
  if (v.length > 8) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, "$1.$2.$3/$4");
  if (v.length > 5) return v.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, "$1.$2.$3");
  if (v.length > 2) return v.replace(/^(\d{2})(\d{0,3}).*/, "$1.$2");
  return v;
};

// Formata documento de acordo com o tipo
const formatDocumento = (value = "", tipo = "CNPJ") => {
  if (tipo === "CNPJ") return formatCNPJ(value);
  if (tipo === "CPF") return formatCPF(value);
  return value;
};


  const handleChangePassword = async (userId) => {
    if (passwordRequestRef.current) return;
    setPasswordError("");
    if (!newPassword) {
      setPasswordError("Digite a nova senha!");
      return;
    }
    if (!isPasswordValid(newPassword)) {
      setPasswordError("Senha inválida! A senha deve ter no mínimo 8 caracteres, pelo menos 1 letra, 1 número e 1 símbolo especial.");
      return;
    }

    passwordRequestRef.current = true;
    setIsChangingPassword(true);
    try {
      await axios.put(
        `${API_URL}/users/${userId}/reset-password`,
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setModal({ visible: true, title: "Sucesso", message: "Senha alterada com sucesso!" });
      setEditingUserId(null);
      setNewPassword("");
    } catch (error) {
      console.error("Erro ao alterar senha:", error.response || error.message);
      setPasswordError("Erro ao alterar senha.");
    } finally {
      passwordRequestRef.current = false;
      setIsChangingPassword(false);
    }
  };

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
    setModal({ visible: true, title: "Erro", message: "Erro ao carregar empresas." });
  } finally {
    setLoadingCompanies(false);
  }
};

const startEditing = (company) => {
  const phone = company.telefone ? parsePhoneNumberFromString(company.telefone) : null;
  setCompanyEditError("");
  setEditingCompanyId(company._id);
  setEditingCompanyData({
  razaoSocial: company.razaoSocial || "",
  cnpj: company.documento || "",
  email: company.emailReferencia || "",
  tipoDocumento: company.tipoDocumento || "CNPJ",
  phoneCountry: phone?.country || "BR",
  telephone: phone?.country ? phone.nationalNumber : company.telefone || "",
  hadTelephone: Boolean(company.telefone),
});
};

const cancelEditing = () => {
  setEditingCompanyId(null);
  setEditingCompanyData({});
};


const saveEditing = async (companyId) => {
  if (companyRequestRef.current) return;
  setCompanyEditError("");
  const cnpjCpfClean = (editingCompanyData.cnpj || "").replace(/\D/g, "");

  // validação
  if (
    (editingCompanyData.tipoDocumento === "CNPJ" && cnpjCpfClean.length !== 14) ||
    (editingCompanyData.tipoDocumento === "CPF" && cnpjCpfClean.length !== 11)
  ) {
    setCompanyEditError(`${editingCompanyData.tipoDocumento} incompleto!`);
    return;
  }

  if (!isValidEmail(editingCompanyData.email)) {
    setCompanyEditError("Digite um e-mail válido.");
    return;
  }

  const telephone = editingCompanyData.telephone
    ? phoneE164(editingCompanyData.telephone, editingCompanyData.phoneCountry) : null;
  if ((editingCompanyData.telephone || editingCompanyData.hadTelephone) && !telephone) {
    setCompanyEditError("Informe um telefone válido com o código de área e o país correto.");
    return;
  }

  companyRequestRef.current = true;
  setIsSavingCompany(true);
  try {
    await axios.put(
  `${API_URL}/companies/${companyId}`,
      {
        razaoSocial: editingCompanyData.razaoSocial,
        documento: cnpjCpfClean, // aqui é "documento", não "cnpj"
        emailReferencia: editingCompanyData.email, // aqui o nome que o backend espera
        tipoDocumento: editingCompanyData.tipoDocumento,
        ...(telephone ? { telefone: telephone } : {}),
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setModal({ visible: true, title: "Sucesso", message: "Empresa atualizada com sucesso!" });
    cancelEditing();
    fetchCompanies();
  } catch (err) {
    console.error("Erro ao atualizar empresa:", err);
    setCompanyEditError(err.response?.data?.message || "Erro ao atualizar empresa.");
  } finally {
    companyRequestRef.current = false;
    setIsSavingCompany(false);
  }
};


  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  const isValidEmail = (email) => {
  return /\S+@\S+\.\S+/.test(email); // precisa ter "@" e pelo menos um "."
};

  // Função para converter data do log para string "YYYY-MM-DD" local
  const formatLogDate = (dateStr) => {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // filtros da auditoria + paginação
  const filteredLogs = logs.filter((log) => {
    if (logSearchTerm && !(log.performedBy?.nome || "").toLowerCase().includes(logSearchTerm.toLowerCase())) {
      return false;
    }
    if (logActionFilter && log.action !== logActionFilter) {
      return false;
    }
    if (logDateFilter) {
      const logDayString = formatLogDate(log.createdAt);
      if (logDayString !== logDateFilter) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLogs.length / logPageSize);
  const paginatedLogs = filteredLogs.slice((logPage - 1) * logPageSize, logPage * logPageSize);

  const toggleDarkMode = () => {
  setDarkMode((prev) => {
    const newMode = !prev;
    localStorage.setItem("darkMode", newMode); // salva preferência
    return newMode;
  });
};


useEffect(() => {
  if (darkMode) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}, [darkMode]);



  return (
    <div className="dashboard-page">
      {!user || user.role !== "admin" ? (
        <StateMessage>Você precisa estar logado como admin para acessar este painel.</StateMessage>
      ) : (
        <>
          <HeaderActions><Button variant="ghost" onClick={() => setConfirmLogoutModal(true)}><FiLogOut size={16} aria-hidden="true" />Sair</Button></HeaderActions>
          <PageHeader title="Painel Administrativo" description="Gerencie usuários, empresas e atividades do sistema." />
          <AdminTabs view={view} onChange={setView} />

          {view === "users" && (
            <div className="admin-stack">
              <Card title="Lista de usuários" toolbar={<div className="users-list-toolbar">
                <SearchInput label="Pesquisar usuários por nome ou e-mail" placeholder="Pesquisar nome ou e-mail" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <Button variant="primary" ref={createTriggerRef} onClick={() => { setCreateError(""); setShowCreatePassword(false); setCreateUserOpen(true); }}><FiPlus size={18} aria-hidden="true" />Criar usuário</Button>
              </div>}>
                {loadingUsers ? <StateMessage loading>Carregando usuários...</StateMessage> : filteredUsers.length > 0 ? (
                  <DataTable label="Usuários cadastrados" columns={["Usuário", "E-mail", "Perfil", "Ações"]}>
                    {filteredUsers.map((userItem) => (
                      <tr key={userItem._id}>
                        <td><strong>{userItem.nome}</strong></td>
                        <td className="admin-secondary">{userItem.email}</td>
                        <td><Badge tone={userItem.role === "admin" ? "primary" : "neutral"}>{roleLabels[userItem.role] || userItem.role}</Badge></td>
                        <td><div className="admin-row-actions">
                          {userItem.role !== "admin" && currentUserEmail !== userItem.email && (
                            <Button onClick={(e) => { passwordTriggerRef.current = e.currentTarget; setPasswordError(""); setNewPassword(""); setShowNewPassword(false); setEditingUserId(userItem._id); }}>Alterar senha</Button>
                          )}
                          {userItem.role !== "admin" && <Button variant="danger" className="user-delete-icon" aria-label={`Excluir usuário ${userItem.nome}`} title="Excluir usuário" onClick={() => confirmDeleteUser(userItem._id, userItem.role)}><FiTrash2 size={18} aria-hidden="true" /></Button>}
                          {userItem.role === "admin" && <span className="admin-muted">Acesso administrativo</span>}
                        </div></td>
                      </tr>
                    ))}
                  </DataTable>
                ) : <StateMessage>Nenhum usuário encontrado.</StateMessage>}
              </Card>
            </div>
          )}

          {view === "companies" && (
            <Card title="Empresas" toolbar={<SearchInput label="Pesquisar empresas por nome ou documento" placeholder="Pesquisar nome ou CPF/CNPJ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />}>
              {loadingCompanies ? <StateMessage loading>Carregando empresas...</StateMessage> : filteredCompanies.length > 0 ? (
                <DataTable label="Empresas cadastradas" columns={["Empresa", "CPF / CNPJ", "E-mail", "Ações"]}>
                  {filteredCompanies.map((company) => (
                    <tr key={company._id}>
                      <td><strong>{company.razaoSocial}</strong></td>
                      <td><span className="admin-document">{formatDocumento(company.documento, company.tipoDocumento || "CNPJ")}</span></td>
                      <td><span className="admin-secondary">{company.emailReferencia}</span></td>
                      <td><div className="admin-row-actions"><Button className="company-edit-icon" aria-label={`Editar empresa ${company.razaoSocial}`} title="Editar empresa" onClick={(e) => { companyTriggerRef.current = e.currentTarget; startEditing(company); }}><FiEdit2 size={18} aria-hidden="true" /></Button></div></td>
                    </tr>
                  ))}
                </DataTable>
              ) : <StateMessage>Nenhuma empresa encontrada.</StateMessage>}
            </Card>
          )}

          {view === "audit" && (
            <Card title="Auditoria" description="Consulte o histórico de atividades realizadas no sistema.">
              <div className="admin-filter-toolbar">
                <div className="audit-search-field"><span id="audit-user-filter-label">Usuário</span><SearchInput label="Pesquisar auditoria por usuário" aria-labelledby="audit-user-filter-label" placeholder="Pesquisar usuário" value={logSearchTerm} onChange={(e) => setLogSearchTerm(e.target.value)} /></div>
                <Field label="Ação"><select value={logActionFilter} onChange={(e) => setLogActionFilter(e.target.value)}>
                  <option value="">Todas as ações</option>
                  {[...new Set(logs.map((l) => l.action))].map((action) => <option key={action} value={action}>{auditActionLabels[action] || action}</option>)}
                </select></Field>
                <Field label="Data"><input type="date" value={logDateFilter} onChange={(e) => setLogDateFilter(e.target.value)} /></Field>
                <Field label="Por página"><select value={logPageSize} onChange={(e) => { setLogPageSize(Number(e.target.value)); setLogPage(1); }}>
                  <option value={25}>25 registros</option><option value={100}>100 registros</option><option value={500}>500 registros</option>
                </select></Field>
              </div>
              {(logSearchTerm || logActionFilter || logDateFilter || logPageSize !== 25) && <div className="audit-clear-filters"><Button variant="ghost" onClick={() => { setLogSearchTerm(""); setLogActionFilter(""); setLogDateFilter(""); setLogPageSize(25); setLogPage(1); }}>Limpar filtros</Button></div>}
              {loadingLogs ? <StateMessage loading>Carregando auditoria...</StateMessage> : paginatedLogs.length > 0 ? (
                <>
                  <div className="audit-compact-table"><DataTable label="Registros de auditoria" columns={["Ação", "Usuário", "Data e hora", "Resumo", "Detalhes"]}>
                    {paginatedLogs.map((log) => (
                      <tr key={log._id}>
                        <td><Badge tone={auditTone(log.action)}>{auditActionLabels[log.action] || log.action}</Badge></td>
                        <td><strong>{log.performedBy?.nome || "Usuário desconhecido"}</strong></td>
                        <td className="admin-date">{auditDate(log.createdAt)}</td>
                        <td><span className="audit-event-summary" title={auditSummary(log)}>{auditSummary(log)}</span></td>
                        <td><Button variant="ghost" aria-label={`Ver detalhes de ${auditActionLabels[log.action] || log.action}, ${auditDate(log.createdAt)}`} onClick={(e) => { auditDetailTriggerRef.current = e.currentTarget; setSelectedAuditLog(log); }}>Ver detalhes</Button></td>
                      </tr>
                    ))}
                  </DataTable></div>
                  <div className="admin-pagination">
                    <span>Mostrando {(logPage - 1) * logPageSize + 1}–{Math.min(logPage * logPageSize, filteredLogs.length)} de {filteredLogs.length}</span>
                    <div className="admin-pagination-controls">
                      <Button disabled={logPage === 1} onClick={() => setLogPage((prev) => prev - 1)}>‹ Anterior</Button>
                      <span>Página {logPage} de {totalPages}</span>
                      <Button disabled={logPage === totalPages} onClick={() => setLogPage((prev) => prev + 1)}>Próxima ›</Button>
                    </div>
                  </div>
                </>
              ) : <StateMessage>Nenhum registro de auditoria encontrado.</StateMessage>}
            </Card>
          )}

          {selectedAuditLog && (
            <Dialog title="Detalhes da auditoria" className="audit-drawer" onClose={() => setSelectedAuditLog(null)} closeOnBackdrop returnFocusRef={auditDetailTriggerRef}>
              <AuditDetails log={selectedAuditLog} formatDocumento={formatDocumento} />
            </Dialog>
          )}
          {createUserOpen && (
            <Dialog title="Criar usuário" className="create-user-dialog" onClose={() => { if (!createRequestRef.current) setCreateUserOpen(false); }} closeDisabled={isCreatingUser} closeOnBackdrop={!nome && !email && !password && role === "vendedor"} returnFocusRef={createTriggerRef}>
              <form className="create-user-form" onSubmit={handleCreateUser} aria-busy={isCreatingUser}>
                <fieldset disabled={isCreatingUser}>
                  <Field label="Nome"><input type="text" placeholder="Nome completo" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
                  <Field label="E-mail"><input type="email" placeholder="usuario@empresa.com" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                  <div><div className="ui-field"><label htmlFor="create-user-password">Senha</label><div className="password-visibility-field">
                    <input id="create-user-password" type={showCreatePassword ? "text" : "password"} placeholder="Defina uma senha" autoComplete="new-password" aria-describedby="password-hint" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Button variant="ghost" className="password-visibility-toggle" aria-label={showCreatePassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showCreatePassword} aria-controls="create-user-password" disabled={isCreatingUser} onClick={() => setShowCreatePassword((visible) => !visible)}>{showCreatePassword ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}</Button>
                  </div></div>
                    <p id="password-hint" className="create-password-hint">A senha deve conter pelo menos 8 caracteres, uma letra, um número e um símbolo.</p>
                  </div>
                  <div className="create-profile-picker" role="group" aria-labelledby="create-profile-label">
                    <span id="create-profile-label">Perfil</span>
                    <div className="create-profile-options">
                      <label><input type="checkbox" checked={role === "vendedor"} onChange={() => setRole("vendedor")} />Vendedor</label>
                      <label><input type="checkbox" checked={role === "verificador"} onChange={() => setRole("verificador")} />Verificador</label>
                    </div>
                  </div>
                </fieldset>
                {createError && <p className="create-user-error" role="alert">{createError}</p>}
                <div className="admin-modal-actions"><Button disabled={isCreatingUser} onClick={() => setCreateUserOpen(false)}>Cancelar</Button><Button variant="primary" type="submit" disabled={isCreatingUser}>{isCreatingUser ? "Criando..." : "Criar usuário"}</Button></div>
              </form>
            </Dialog>
          )}
          {editingUserId && (
            <Dialog title="Alterar senha" className="change-password-dialog" description={users.find((item) => item._id === editingUserId)?.nome} highlightDescription onClose={() => { if (!passwordRequestRef.current) { setEditingUserId(null); setNewPassword(""); } }} closeDisabled={isChangingPassword} returnFocusRef={passwordTriggerRef}>
              <form className="change-password-form" aria-busy={isChangingPassword} onSubmit={(e) => { e.preventDefault(); handleChangePassword(editingUserId); }}>
                <div className="ui-field"><label htmlFor="change-user-password">Nova senha</label><div className="password-visibility-field">
                  <input id="change-user-password" type={showNewPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite a nova senha" value={newPassword} disabled={isChangingPassword} aria-describedby="change-password-hint" onChange={(e) => setNewPassword(e.target.value)} />
                  <Button variant="ghost" className="password-visibility-toggle" aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showNewPassword} aria-controls="change-user-password" disabled={isChangingPassword} onClick={() => setShowNewPassword((visible) => !visible)}>{showNewPassword ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}</Button>
                </div></div>
                <p id="change-password-hint">A senha deve conter pelo menos 8 caracteres, uma letra, um número e um símbolo.</p>
                {passwordError && <p className="password-change-error" role="alert">{passwordError}</p>}
                <div className="admin-modal-actions"><Button disabled={isChangingPassword} onClick={() => { setEditingUserId(null); setNewPassword(""); }}>Cancelar</Button><Button variant="primary" type="submit" disabled={isChangingPassword}>{isChangingPassword ? "Salvando..." : "Salvar senha"}</Button></div>
              </form>
            </Dialog>
          )}
          {editingCompanyId && (
            <Dialog title="Editar empresa" description={editingCompanyData.razaoSocial} highlightDescription onClose={() => { if (!companyRequestRef.current) cancelEditing(); }} closeDisabled={isSavingCompany} returnFocusRef={companyTriggerRef}>
              <form className="company-edit-form" onSubmit={(e) => { e.preventDefault(); saveEditing(editingCompanyId); }} aria-busy={isSavingCompany}>
                <Field label={editingCompanyData.tipoDocumento}><input type="text" disabled={isSavingCompany} value={formatDocumento(editingCompanyData.cnpj, editingCompanyData.tipoDocumento)} onChange={(e) => {
                  const onlyNumbers = e.target.value.replace(/\D/g, "").slice(0, editingCompanyData.tipoDocumento === "CNPJ" ? 14 : 11);
                  setEditingCompanyData({ ...editingCompanyData, cnpj: onlyNumbers });
                }} placeholder={editingCompanyData.tipoDocumento === "CNPJ" ? "00.000.000/0000-00" : "000.000.000-00"} /></Field>
                <Field label="E-mail"><input type="email" disabled={isSavingCompany} value={editingCompanyData.email} onChange={(e) => setEditingCompanyData({ ...editingCompanyData, email: e.target.value })} /></Field>
                <InternationalPhoneField country={editingCompanyData.phoneCountry} telephone={editingCompanyData.telephone} disabled={isSavingCompany} required={editingCompanyData.hadTelephone}
                  onCountryChange={phoneCountry => setEditingCompanyData(previous => ({ ...previous, phoneCountry, telephone: "" }))}
                  onTelephoneChange={telephone => setEditingCompanyData(previous => ({ ...previous, telephone }))} />
                {companyEditError && <p className="company-edit-error" role="alert">{companyEditError}</p>}
                <div className="admin-modal-actions"><Button disabled={isSavingCompany} onClick={cancelEditing}>Cancelar</Button><Button variant="primary" type="submit" disabled={isSavingCompany}>{isSavingCompany ? "Salvando..." : "Salvar"}</Button></div>
              </form>
            </Dialog>
          )}
          {modal.visible && !createUserOpen && !editingUserId && !editingCompanyId && (
            <Dialog title={modal.title} returnFocusRef={companyTriggerRef.current ? companyTriggerRef : passwordTriggerRef.current ? passwordTriggerRef : createTriggerRef}>
              <p>{modal.message}</p>
              <div className="admin-modal-actions"><Button variant="primary" onClick={() => setModal({ ...modal, visible: false })}>Fechar</Button></div>
            </Dialog>
          )}
          {confirmModal.visible && (
            <Dialog title="Excluir usuário">
              <p>Tem certeza que deseja excluir este usuário?</p>
              <div className="admin-modal-actions"><Button onClick={() => setConfirmModal({ visible: false, userId: null, userRole: "" })}>Cancelar</Button><Button variant="danger" onClick={handleDeleteUser}>Confirmar</Button></div>
            </Dialog>
          )}
          {confirmLogoutModal && (
            <Dialog title="Sair do sistema">
              <p>Deseja realmente sair do sistema?</p>
              <div className="admin-modal-actions"><Button onClick={() => setConfirmLogoutModal(false)}>Cancelar</Button><Button variant="primary" onClick={logout}>Confirmar</Button></div>
            </Dialog>
          )}
        </>
      )}
    </div>
  );
}
