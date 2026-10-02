// Mapeamento apenas de apresentação; os registros e filtros mantêm seus valores originais.
const text = value => typeof value === "string" || typeof value === "number" ? String(value) : "";

export function auditSummary(log) {
  const info = log.info || {};
  const company = text(info.razaoSocial) || text(info.companyName);
  const nf = text(info.nfNumber);
  const token = text(info.verifiedToken) || text(info.token);
  const withNf = value => [value, nf && `NF ${nf}`].filter(Boolean).join(" · ");
  switch (log.action) {
    case "CREATE_COMPANY":
    case "EDIT_COMPANY": return company || text(info.documento) || "Empresa não informada";
    case "GENERATE_TOKEN": return withNf(company) || "Token gerado";
    case "VERIFY_TOKEN": return withNf(token || company) || "Token verificado";
    default: return withNf(company || token || text(info.documento) || text(info.message) || text(info.description)) || "Sem resumo disponível";
  }
}

export function auditTone(action = "") {
  if (/DELETE|REMOVE|FAIL|ERROR|DENY/.test(action)) return "danger";
  if (/VERIFY|SUCCESS|APPROVE/.test(action)) return "success";
  if (/EDIT|UPDATE|CHANGE/.test(action)) return "warning";
  if (/CREATE|GENERATE|ADD/.test(action)) return "primary";
  return "neutral";
}

export function auditDate(value, full = false) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return `${date.toLocaleDateString("pt-BR")}${full ? "," : " ·"} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(full ? { second: "2-digit" } : {}) })}`;
}

const labels = {
  _id: "Identificador", __v: "Versão do registro", companyId: "Identificador da empresa",
  companyName: "Empresa", razaoSocial: "Razão social", documento: "CPF / CNPJ",
  tipoDocumento: "Tipo de documento", emailReferencia: "E-mail de referência",
  nfNumber: "NF utilizada", verifiedToken: "Token verificado", token: "Token",
  tokenId: "Identificador do token", expiresAt: "Validade", usedAt: "Data de utilização",
  deliveryChannel: "Canal de envio", deliveryDestination: "Destinatário", deliveryMessageId: "Identificador do envio", deliveryStatus: "Status do envio",
  role: "Perfil", ip: "Endereço IP", createdAt: "Data de criação", updatedAt: "Última atualização",
  targetType: "Tipo de entidade", action: "Código da ação", performedBy: "Dados do usuário",
  nome: "Nome", email: "E-mail", message: "Mensagem", description: "Descrição",
};

export function auditFieldLabel(key) {
  return labels[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}
