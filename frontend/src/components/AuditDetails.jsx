import { Badge, auditActionLabels, roleLabels } from "./AdminUI";
import { auditDate, auditFieldLabel, auditTone } from "../utils/auditPresentation";

function MetadataValue({ value, field, formatDocumento, info }) {
  if (value === null || value === undefined || value === "") return <span className="admin-secondary">Não informado</span>;
  if (Array.isArray(value)) return value.length ? <ol className="audit-value-list">{value.map((item, index) => <li key={index}><MetadataValue value={item} formatDocumento={formatDocumento} info={info} /></li>)}</ol> : <span>Nenhum item</span>;
  if (typeof value === "object") return <Metadata entries={value} formatDocumento={formatDocumento} info={info} />;
  if (field === "documento" && info?.tipoDocumento) return formatDocumento(String(value), info.tipoDocumento);
  if (["createdAt", "updatedAt", "usedAt", "expiresAt"].includes(field)) return auditDate(value, true);
  if (field === "role") return roleLabels[value] || String(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function Metadata({ entries, formatDocumento, info }) {
  return <dl className="audit-detail-fields">{Object.entries(entries).map(([key, value]) => <div key={key}><dt>{key === "documento" && info?.tipoDocumento ? info.tipoDocumento : auditFieldLabel(key)}</dt><dd><MetadataValue field={key} value={value} formatDocumento={formatDocumento} info={info} /></dd></div>)}</dl>;
}

export default function AuditDetails({ log, formatDocumento }) {
  const { info, ...record } = log;
  return <div className="audit-detail-content">
    <dl className="audit-detail-fields audit-detail-overview">
      <div><dt>Ação</dt><dd><Badge tone={auditTone(log.action)}>{auditActionLabels[log.action] || log.action}</Badge></dd></div>
      <div><dt>Usuário</dt><dd>{log.performedBy?.nome || "Usuário desconhecido"}</dd></div>
      <div><dt>Data e hora</dt><dd>{auditDate(log.createdAt, true)}</dd></div>
    </dl>
    <section aria-label="Informações do evento"><h4>Informações</h4>{info && Object.keys(info).length ? <Metadata entries={info} formatDocumento={formatDocumento} info={info} /> : <p>Sem informações adicionais.</p>}</section>
    <section aria-label="Metadados do registro"><h4>Registro original</h4><Metadata entries={record} formatDocumento={formatDocumento} info={info} /></section>
  </div>;
}
