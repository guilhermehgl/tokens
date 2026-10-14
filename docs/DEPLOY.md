# Publicação segura da demonstração

Plano preparado em 14/10/2026. Não autoriza deploy, merge, mudança de ambiente, índice, migração ou escrita remota. Não acessar Lightsail nem o sistema empresarial original.

## Infraestrutura observada, somente leitura

| Componente | Configuração confirmada |
| --- | --- |
| Frontend Vercel | Projeto `tokens`, produção `master`, commit `eec58ac`, raiz `frontend` |
| Frontend público | `https://tokens-theta-dun.vercel.app/` |
| API compilada no frontend | `https://tokens-xfrp.onrender.com/api` |
| Backend Render | Serviço `tokens`, ID `srv-db76ku49v7es73al9l6g`, Node, Free, Oregon |
| Repositório backend | `guilhermehgl/tokens`, `master`, raiz `backend/` |
| Build backend | `npm ci --include=dev && npm run build` |
| Start backend | `npm run start` → `node dist/src/app.js` |
| Último sucesso backend | `96548feed2adc1a30af2eca625cab16e3dc851e3` |
| Última tentativa | `eec58ac`, build passou, inicialização recusou `JWT_SECRET` curto |
| Health check Render | Campo vazio na inspeção; planejar `/api/health` |

O último build Render escolheu Node 26.11.1 pelo range de engines. O projeto admite essa linha, porém o CI existente cobre 22/24. Planejar Node 24 validado; não apresentar 26 como certificado pelo CI. A instância Free pode dormir e atrasar requisições por mais de 50 segundos; isso não comprova contrato funcional nem explica sozinho o 502 observado.

Vercel cria previews da branch de melhorias; Render registrou Auto-Deploy para `master`. **Push pode gerar preview; merge pode iniciar produção.** Não executar sem aprovação que cubra o efeito automático. Nenhuma configuração foi alterada para contornar essa exigência.

## Ambiente necessário

- Frontend: `VITE_API_URL=https://tokens-xfrp.onrender.com/api` no build. Nova variável só vale em novo build. Rewrites Vercel atendem SPA, sem proxy para Render.
- Backend: `MONGO_URI` do banco demonstrativo confirmado, `JWT_SECRET` aleatório com pelo menos 32 caracteres e `CORS_ORIGINS=https://tokens-theta-dun.vercel.app`. Adicionar origem de preview só com aprovação; sem wildcard.
- `PORT` fornecida pela hospedagem ou padrão local. `TRUST_PROXY` desativado até determinar cadeia/IPs confiáveis; não definir `true` indiscriminadamente. `HTTPS_ENABLED` somente após confirmar HTTPS/proxy.
- SMTP/Vonage não são necessários. Seus nomes existem no Render, mas os valores não foram revelados nem alterados; sua presença não deve habilitar envio na versão corrigida.

Gerar JWT no ambiente seguro do responsável. Rotação invalida sessões, sem mudar senhas. Não publicar segredo em docs, PR ou logs. Corrigir `JWT_SECRET` é alteração externa sujeita à autorização.

## Banco: bloqueio anterior à publicação

`MONGO_URI` permanece mascarada; **nome exato e isolamento do banco remoto não foram confirmados**. Não houve conexão ao banco hospedado. O responsável deve identificar cluster e nome exato e confirmar que contém apenas a demonstração, sem dados empresariais.

Após essa confirmação, usar credencial somente leitura, sem divulgar URI. Configurar `MONGO_URI` com segurança no processo autorizado, sem mudar a configuração externa. No checkout revisado:

```powershell
$env:INTEGRITY_DB_NAME="<nome-exato-confirmado>"
npm --prefix backend run check:integrity
```

O script executa TypeScript via `tsx`, consultas/aggregations e `listIndexes`, com `autoIndex=false` e `autoCreate=false`. Não usa seed, modelos, criação/remoção de índices ou atualização de documentos. Exige correspondência exata do nome após conectar. O nome informado não prova isolamento; essa confirmação continua humana.

Esperado: zero duplicidades de `tokenHash`, documentos e e-mails normalizados; zero hashes inválidos e documentos fora do formato; índices `ready`: únicos em `tokens.tokenHash`, `companies.documento`, `users.email`, TTL `tokens.expiresAt` com zero segundos. Índices parciais, sparse ou com collation incompatível não são considerados prontos. Saída 1 indica pendências, recusa ou indisponibilidade. O diagnóstico não certifica todos os campos nem a veracidade dos dados.

**Não iniciar o servidor como diagnóstico remoto**: a inicialização corrigida verifica integridade e cria índices. TTL pode remover registros vencidos; índice único pode falhar com duplicatas. Esse passo afeta dados e exige aprovação.

Se houver pendências:

1. Fazer backup protegido e testar restauração em cópia isolada, registrando contagens e índices.
2. Preparar relatório de conflitos e decisão explícita sobre cada formato/duplicata. Não deduplicar ou apagar automaticamente.
3. Testar migração revisável na cópia; guardar mapeamento, métricas e procedimento inverso quando aplicável.
4. Obter aprovação específica para mudanças e índices/TTL na demonstração.
5. Repetir diagnóstico e validar a cópia com backend corrigido antes de alterar o ambiente público.

Seed exige sufixo `_demo` e banco vazio ou marcador conhecido. Não substituir contas públicas por `@demo.local`. Não executar seed remoto; o reconhecimento das identidades públicas no código protege-as sem trocar senhas/flags no banco.

## Sequência após aprovações específicas

1. Revisar commits locais e autorizar push/preview. Executar CI Node 22/24 no novo HEAD; resultado de `42083d7` não certifica o HEAD novo.
2. Confirmar isolamento/nome do banco, diagnóstico, backup, migração se necessária e autorização dos índices.
3. Validar backend/frontend em cópia isolada, sem provedores externos. Preview não deve apontar inadvertidamente para dados empresariais.
4. Aprovar correção JWT e configurações necessárias; escolher o commit a publicar. Merge e deploy são aprovações distintas do push do PR.
5. Publicar backend corrigido primeiro; conferir logs, health, revisão, CORS e contas protegidas. Não divulgar geração enquanto houver backend antigo.
6. Publicar frontend compatível com URL correta, sem reutilizar build com variável antiga.
7. Com autorização para dados fictícios, testar três logins, cadastro, geração/cópia, logout, consumo, recusa de repetição, pendências e auditoria. Validar mobile/erros e ausência de SMTP/Vonage, também com canais HTTP forçados.
8. Só então anunciar demonstração completa e atualizar README/homepage. `Ready` e build não substituem fluxo real.

## Rollback

Registrar revisão, configuração segura e backup antes da mudança. Em falha, não enfraquecer JWT ou integridade. Interromper geração e corrigir isoladamente. Backend antigo `96548fe` contém envio externo: **não é rollback seguro para demonstração sem bloqueio da geração**. Preparar previamente artefato revisado com envio desativado e compatível com os dados.

Rollback frontend somente para revisão compatível com API escolhida. Não apagar índices, restaurar banco, sobrescrever senhas ou rodar seed automaticamente. Banco exige plano/aprovação próprios; restauração pode perder escritas posteriores ao backup. Preservar logs sanitizados. Toda operação externa de rollback exige autorização.
