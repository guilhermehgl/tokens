# Publicação segura da demonstração

Plano preparado em 14/10/2026, com orientações de integração ao portfólio atualizadas em 15/10/2026. Não autoriza deploy, merge, mudança de ambiente, índice, migração ou escrita remota. Não acessar Lightsail nem o sistema empresarial original.

## Integrar o portfólio sem publicar o backend

A preparação do PR e os previews da Vercel estão autorizados. Merge, alterações no Render, variáveis externas e operações MongoDB continuam fora desta etapa.

Antes de um merge futuro, com autorização específica:

1. No Render, abrir `tokens` → Settings → Build & Deploy → Auto-Deploy → Edit. Selecionar **Off**, salvar e confirmar o estado desativado antes do merge. Isso é uma alteração externa e não foi executada. Registrar o commit Live para comparar depois.
2. Verificar outras automações associadas à `master`, incluindo deploy hooks e Vercel. O workflow de qualidade deste repositório não publica serviços. Um merge pode publicar o frontend de produção pela integração Vercel; se o objetivo for somente GitHub, essa automação também precisa de bloqueio autorizado antes do merge. O preview de PR autorizado não equivale a autorização de produção.
3. Revisar o HEAD final do PR, seus testes/CI e obter autorização de merge. Integrar o PR #1 sem force push.
4. Confirmar que a `master` contém o merge e que o Render permanece no commit Live anterior, sem novo evento de deploy. Não reativar auto-deploy até haver autorização para publicar o backend e seus efeitos no banco.

Não usar merge como mecanismo implícito de publicação. Para publicar uma revisão específica posteriormente, o painel Render oferece **Manual Deploy → Deploy a specific commit**, com o SHA completo do repositório vinculado, sem exigir merge. Esse caminho pelo painel desativa auto-deploy; confirmar o estado resultante. Para corrigir JWT sem disparar uma revisão indesejada, usar **Save only** e só depois o deploy explicitamente autorizado. A inicialização pode criar índices e executar TTL, portanto depende de diagnóstico, backup e aprovação próprios.

Referências: [deploys e commit específico](https://render.com/docs/deploys), [variáveis e Save only](https://render.com/docs/configure-environment-variables).

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
- Novas regras demonstrativas: `DEMO_ENABLED=true`, `DEMO_DB_NAME=test` e `DEMO_DB_HOST=<host exato do cluster verificado>`, somente após aprovação. A URI Atlas sem caminho seleciona `test`; as configurações precisam corresponder à URI e ao banco conectado. Exige também marcador demonstrativo autorizado em `demo_environment`; sem ele, a ativação falha. Não deduzir isolamento pelo nome. Standalone não atende às transações; confirmar replica set/cluster e permissões antes da publicação. Ausência de ativação preserva o comportamento anterior de admin demo somente leitura, sem liberar CRUD aberto em outra base.

## Backup e corte para as cotas

Nenhum backup ou diagnóstico remoto foi executado nesta implementação. Antes de publicar:

1. Conferir cluster, banco `test`, credencial somente leitura e regras de rede, sem imprimir URI. Executar o diagnóstico revisado com `INTEGRITY_DB_NAME=test`; registrar duplicidades, índices, datas de criação, capacidade e suporte a transações. Nunca iniciar a API como diagnóstico.
2. Identificar o plano Atlas e backups já disponíveis. Em M0, preparar `mongodump`; em planos com snapshots, selecionar uma estratégia consistente compatível. Ferramentas locais existem, mas isso não comprova backup ou restauração. Obter autorização para cópia e local protegido fora do Git, sem senha na linha de comando.
3. Após autorização, impedir escritores antigos durante o corte. Realizar backup consistente de dados/metadados e validar restauração em cópia isolada, inicialmente sem restaurar índices TTL. Registrar verificação de contagens e capacidade de recuperar os dados. O plano Free do Render não oferece o modo Maintenance pago; não presumir essa opção disponível.
4. Revisar duplicidades e formatos, sem exclusão ou normalização automática. Coleções acima de 50 permanecem; apenas novas criações são bloqueadas. Registros antigos sem `demoManaged` não serão liberados para edição automaticamente. Qualquer classificação/migração requer lista e aprovação próprias.
5. Revisar emissões anteriores no dia de São Paulo. A primeira gravação diária considera tokens existentes; o contador fica independente do TTL depois disso. Se houver exclusões anteriores ou datas não confiáveis, preparar bootstrap conservador aprovado ou iniciar no próximo dia com escritores antigos bloqueados. Não inicializar uma contagem fictícia em zero.
6. Conferir o marcador demonstrativo pelo diagnóstico. Se ausente, apresentar e obter autorização para inserir somente `_id=portal-tokens-demo-v1`, `purpose=public-demo` em `demo_environment`, após backup, sem seed nem mudanças nas contas. Autorizar separadamente índices existentes esperados e efeito TTL. A nova coleção `demoquotas` usa `_id` padrão, sem índice personalizado; primeira operação cria mutex/contador dentro da transação. Incluir essas escritas na aprovação do ambiente demonstrativo. A inicialização cria os índices únicos/TTL anteriores; isso continua exigindo aprovação antes do deploy.
7. Só depois aprovar JWT, configuração demonstrativa, runtime Node validado e deploy de um SHA identificado. Usar `Save only` para preparar variáveis sem publicar por acidente; publicar o SHA aprovado explicitamente. A entrada de um novo segredo deve ocorrer no ambiente seguro do responsável, sem chat, logs ou Git.

Rollback não deve apontar para backend que ignore cotas ou habilite mensagens. Preparar versão compatível que preserve os contadores, bloqueie escritas e mantenha consultas, ou manter serviço indisponível até correção autorizada. Restaurar dados/índices e reativar auto-deploy são operações separadas, nunca compensações automáticas.

Referências: [backups Atlas](https://www.mongodb.com/docs/atlas/backup-restore-cluster/), [transações](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

Gerar JWT no ambiente seguro do responsável. Rotação invalida sessões, sem mudar senhas. Não publicar segredo em docs, PR ou logs. Corrigir `JWT_SECRET` é alteração externa sujeita à autorização.

## Banco: bloqueio anterior à publicação

Na inspeção de 15/10, a URI Atlas não especificava banco; o código sem override utiliza o padrão `test`. O responsável confirmou no Atlas que `test` e suas coleções `users`, `companies`, `tokens` e `auditlogs` pertencem exclusivamente à demonstração, sem dados empresariais reais. Isso é confirmação do responsável, não diagnóstico automatizado. A correspondência exata do cluster e as permissões de uma credencial somente leitura ainda precisam ser verificadas; nenhum diagnóstico remoto foi executado. Essa investigação não faz parte da finalização do portfólio.

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

1. Revisar o diff e publicar apenas os commits de portfólio na branch existente, com preview autorizado. Executar CI Node 22/24 no novo HEAD; resultado de uma revisão anterior não certifica o novo commit.
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
