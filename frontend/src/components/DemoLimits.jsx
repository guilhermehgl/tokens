import React from "react";
import { Button } from "./AdminUI";
export default function DemoLimits({ limits, error, refresh, admin = false }) {
  return <section aria-label="Limites compartilhados da demonstração" className="demo-help">
    <p>Limites compartilhados por todos os visitantes.</p>
    {limits ? <p role="status">{admin && <>Usuários: {limits.users.used}/{limits.users.maximum} · </>}Empresas: {limits.companies.used}/{limits.companies.maximum} · Tokens: {limits.tokens.used}/{limits.tokens.maximum} hoje (São Paulo)</p> : !error && <p role="status">Consultando limites…</p>}
    {limits?.tokens.remaining === 0 && <p role="status">Limite diário atingido. Novas gerações após a meia-noite de São Paulo; a verificação continua disponível.</p>}
    {admin && limits?.users.remaining === 0 && <p role="status">Capacidade de usuários atingida. Consultas e alterações permitidas continuam disponíveis; excluir um usuário editável libera uma vaga.</p>}
    {limits?.companies.remaining === 0 && <p role="status">Capacidade de empresas atingida. Não é possível cadastrar outra empresa; consultas e edições permitidas continuam disponíveis.</p>}
    {error && <p role="alert">{error}</p>}
    <Button onClick={refresh}>Atualizar cotas</Button>
  </section>;
}
