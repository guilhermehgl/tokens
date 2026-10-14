import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { roleLabels } from "./AdminUI";

export default function Header() {
  const { user } = useContext(AuthContext);
  return (
    <header className="app-header">
      <div className="header-inner">
      <div className="header-left">
        <span className="portal-brand">Portal de Tokens</span>
      </div>
      {user && <div className="header-user">
        <span className="header-avatar" aria-hidden="true">{(user.nome || user.email || "U").charAt(0).toUpperCase()}</span>
        <div className="header-user-info"><span className="header-user-name">{user.nome || user.email}</span><span className="header-user-role">{roleLabels[user.role] || user.role}</span></div>
        <div id="header-actions" />
      </div>}
      </div>
    </header>
  );
}
