import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import "./DashboardUI.css";

export const roleLabels = { admin: "Administrador", vendedor: "Vendedor", verificador: "Verificador" };
export const auditActionLabels = {
  CREATE_COMPANY: "Empresa criada", EDIT_COMPANY: "Empresa editada",
  GENERATE_TOKEN: "Token gerado", VERIFY_TOKEN: "Token verificado",
};

export function Button({ variant = "secondary", className = "", children, ...props }) {
  return <button type="button" className={`ui-button ui-button--${variant} ${className}`} {...props}>{children}</button>;
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function PageHeader({ title, description }) {
  return <div className="ui-page-heading"><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}

export function Card({ title, description, toolbar, children }) {
  return <section className="ui-card" aria-label={title}>
    <div className="ui-card-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{toolbar}</div>
    {children}
  </section>;
}

export function Field({ label, children }) {
  return <label className="ui-field"><span>{label}</span>{children}</label>;
}

export function SearchInput({ label, ...props }) {
  return <label className="ui-search"><span className="ui-sr-only">{label}</span>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
    <input type="search" {...props}/>
  </label>;
}

export function DataTable({ label, columns, children }) {
  return <div className="ui-table-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="ui-table"><caption className="ui-sr-only">{label}</caption><thead><tr>{columns.map(column => <th key={column} scope="col" className={column === "Ações" ? "ui-actions-column" : undefined}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table>
  </div>;
}

export function StateMessage({ loading = false, children }) {
  return <div className="ui-state" role="status" aria-live="polite" aria-busy={loading}>{loading && <span className="ui-status-dot"/>}<p>{children}</p></div>;
}

export function AdminTabs({ view, onChange, tabs = [["users", "Usuários"], ["companies", "Empresas"], ["audit", "Auditoria"]], label = "Navegação administrativa" }) {
  return <nav className="ui-tabs" aria-label={label}>{tabs.map(([value, label]) =>
    <button key={value} type="button" aria-current={view === value ? "page" : undefined} className={view === value ? "is-active" : ""} onClick={() => onChange(value)}>{label}</button>
  )}</nav>;
}

// Mantém a confirmação de saída do painel, apenas apresentando o botão no header.
export function HeaderActions({ children }) {
  const [target, setTarget] = useState(null);
  useEffect(() => { setTarget(document.getElementById("header-actions")); }, []);
  return target ? createPortal(children, target) : null;
}

export function Dialog({ title, description, highlightDescription = false, className = "", children, onClose, closeDisabled = false, closeOnBackdrop = false, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  closeRef.current = closeDisabled ? null : onClose;
  const returnFocus = useRef(returnFocusRef);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Bloqueia foco e cliques em todo conteúdo que está atrás da modal.
    const inertElements = [];
    let current = dialog.parentElement;
    while (current && current !== document.body) {
      for (const sibling of current.parentElement.children) {
        if (sibling !== current) { inertElements.push([sibling, sibling.inert]); sibling.inert = true; }
      }
      current = current.parentElement;
    }
    const focusables = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(element => !element.matches(":disabled"));
    (dialog.querySelector("input:not(:disabled)") || focusables()[0] || dialog).focus();
    const containFocus = (event) => {
      if (event.key === "Escape" && closeRef.current) { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", containFocus);
    return () => {
      dialog.removeEventListener("keydown", containFocus);
      document.body.style.overflow = previousOverflow;
      inertElements.forEach(([element, wasInert]) => { element.inert = wasInert; });
      const target = previousFocus?.isConnected ? previousFocus : returnFocus.current?.current;
      target?.focus();
    };
  }, []);
  return <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget && closeOnBackdrop) closeRef.current?.(); }}>
    <div className={`admin-modal ${className}`} ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-dialog-heading"><h3>{title}</h3>{onClose && <Button variant="ghost" className="ui-dialog-close" aria-label="Fechar modal" disabled={closeDisabled} onClick={onClose}><FiX size={18} aria-hidden="true" /></Button>}</div>
      {description && <p className={`ui-dialog-description${highlightDescription ? " ui-dialog-entity" : ""}`}>{description}</p>}
      {children}
    </div>
  </div>;
}
