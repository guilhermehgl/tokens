# Estado e histórico da publicação

## Estado atual — 16/10/2026

A [demonstração oficial](https://tokens-theta-dun.vercel.app/) está publicada: frontend Vercel e backend Render em `93606221e8afc6a2ce6b08541065986026770222`. O [PR #1](https://github.com/guilhermehgl/tokens/pull/1) foi integrado à `master` em `8cadd15b98b09a3e0771db2057acb9ab9af3cdf4`, com a mesma árvore de arquivos. O [CI do merge](https://github.com/guilhermehgl/tokens/actions/runs/38955282059) passou em Node 22 e 24 (70 testes backend e 16 frontend).

A publicação incluiu o marcador demonstrativo e os índices únicos de `tokens.tokenHash` e `companies.documento`; o índice único de e-mail e o TTL de `tokens.expiresAt` foram preservados. O diagnóstico somente leitura confirmou compatibilidade dos formatos consultados, ausência de duplicidades e suporte a transações. O responsável confirmou dados exclusivamente fictícios em `test` e dispensou expressamente o backup. Não houve seed remoto nem substituição das três contas públicas.

Na validação da publicação, passaram login dos três perfis, criação/edição/redefinição de senha/exclusão de usuário demonstrativo permitido, cadastro/edição de empresa fictícia, consulta de auditoria, geração/cópia na tela, consumo único, recusa de reutilização e atualização das consultas. Os serviços SMTP/Vonage estão preservados, sem chamada no fluxo de geração. Isso não certifica entrega externa em produção.

Após o merge e novamente nesta revisão documental, os três logins e `GET /api/demo/limits` responderam 200, com ambiente demonstrativo ativo e cotas de 50 usuários, 50 empresas e 10 tokens/dia de São Paulo. O endereço oficial também respondeu 200. Esta revisão não criou usuários, empresas ou tokens, não alterou registros e não realizou deploy ou mudanças de infraestrutura. A instância gratuita pode demorar ao despertar; disponibilidade futura não é garantida por essa verificação.

Os deploys automáticos da `master` foram controlados antes do merge: Render com Auto-Deploy desativado e Vercel com bloqueio de build automático dessa branch. O merge não disparou outra publicação; o SHA publicado permanece `9360622`, equivalente ao conteúdo integrado. Novos PRs podem gerar previews pela integração existente; preview não comprova disponibilidade da API nem altera a produção por si só.

## Histórico de preparação — 14 e 15/10/2026

**Todos os registros abaixo descrevem o estado na data da investigação.** Menções a PR aberto, backend antigo, JWT curto, índices ausentes, diagnóstico ou publicação pendentes foram superadas pela publicação de 16/10 descrita acima. São preservadas como evidência histórica, não como bloqueios atuais.

## CRUD e cotas globais — preparação de 15/10/2026

Esta revisão parte de `acad74e` na mesma branch e PR #1. Implementa CRUD de usuários demonstrativos marcados pelo servidor, proteção das seis identidades iniciais, edição apenas de empresas permitidas e cotas globais persistentes de 50 usuários ativos, 50 empresas ativas e 10 emissões por dia de São Paulo. O ambiente exige identidade de banco/host, marcador demonstrativo confirmado e suporte a transações. Não foi criado marcador remoto.

Validação local: 70 testes backend (incluindo transações reais em replica set temporário) e 16 frontend aprovados; TypeScript e build Vite aprovados; auditorias de dependências de produção sem vulnerabilidades apontadas. Os 66 testes anteriores foram preservados. Concorrência, rollback, falha secundária de auditoria, TTL sem reposição de cota, reinício e mudança de dia foram testados em banco temporário.

Navegador local: três perfis, criação e edição de usuário, proteção visual das contas fixas, consulta e atualização da auditoria, edição de empresa permitida, cadastro de empresa, erro de NF, geração na tela, confirmação de cópia, consumo e recusa de reutilização, consultas e viewport 390 × 844 do verificador. Redefinição de senha e exclusão foram comprovadas pelos testes HTTP automatizados; não foram submetidas pelo navegador. Corrigida atualização das listas do verificador após consumo. A fixture bloqueia provedores externos.

Render: a leitura do painel nesta etapa ainda mostrou último sucesso `96548fe` e tentativa `eec58ac` falha, branch `master`. Detalhes de runtime/CORS e produção Vercel da inspeção anterior permanecem históricos até nova confirmação. A versão pública não foi certificada pelo teste local.

O responsável confirmou que `test` contém exclusivamente dados demonstrativos e informou que ainda não existe credencial somente leitura. Portanto, diagnóstico remoto, correspondência exata do cluster, duplicidades, formatos, índices e compatibilidade transacional permanecem pendentes. Não utilizar a credencial de escrita da aplicação para esse diagnóstico. Não houve seed, inicialização do backend contra Atlas, mudanças de variáveis, índices, deploy backend ou merge nesta etapa.

Publicação desta revisão, CI Node 22/24 e preview do novo SHA devem ser confirmados após push; os resultados anteriores abaixo não certificam esta revisão. O [plano de deploy](DEPLOY.md) exige backup com restauração testada, avaliação do TTL e dos dados legados, controle dos escritores antigos e aprovações específicas antes de qualquer alteração externa. Demonstração pública e integração na master continuam pendentes.

## Atualização de 15/10/2026

O [PR #1](https://github.com/guilhermehgl/tokens/pull/1) foi confirmado aberto, com sete commits e HEAD `eaf1131862b2058669dabf2e11d430d2479e1af2`, antes da finalização de apresentação. A `master` permanece em `eec58ac`. O CI de `eaf1131` passou em Node 22/24 nas execuções de [PR](https://github.com/guilhermehgl/tokens/actions/runs/38748769134) e [push](https://github.com/guilhermehgl/tokens/actions/runs/38748762900): 51 testes backend e 12 frontend. Esses resultados não certificam commits posteriores.

O preview de `eaf1131` foi observado como Ready na etapa anterior, com a tela de login carregada. Isso não valida login remoto, geração, retirada ou compatibilidade da API. O fluxo hospedado completo continua pendente da atualização autorizada do backend. Não foram repetidos testes que gravem dados ou enviem mensagens.

A inspeção somente leitura do Render confirmou o último sucesso em `96548fe` e a tentativa `eec58ac` recusada por segredo JWT abaixo do mínimo. A URI Atlas não especifica nome de banco; código/driver sem override selecionam `test`. O responsável confirmou que o banco e as quatro coleções da demonstração não contêm dados empresariais reais. A correspondência do cluster, credencial somente leitura e integridade remota ainda não foram verificadas pelo diagnóstico. Não houve conexão remota para essa verificação.

A etapa de portfólio autoriza commits na branch existente, atualização do PR e preview automático da Vercel. Não autoriza merge, deploy de produção, mudanças de variáveis, Render ou MongoDB. O login agora aceita configuração pública de apresentação e, sem ela, não sugere credenciais; não foi alterada configuração externa. [Procedimento para integração segura](DEPLOY.md#integrar-o-portfólio-sem-publicar-o-backend).

## Registro histórico — 14/10/2026

As observações abaixo registram aquela inspeção, não representam uma nova medição de disponibilidade.

Esta página separa execução local, evidências históricas e inspeção atual somente leitura. Nenhum merge, deploy manual, mudança de variável externa, migração ou alteração do banco remoto foi realizado nesta etapa.

| Item | Evidência registrada em 14/10 | Conclusão naquela inspeção |
| --- | --- | --- |
| Frontend | `https://tokens-theta-dun.vercel.app/` responde 200; Vercel indica `master`, commit `eec58ac` | CONFIRMADA a disponibilidade da interface |
| API efetiva | Bundle público `index-qwnw2PeN.js` contém `https://tokens-xfrp.onrender.com/api` | CONFIRMADO o destino compilado de `VITE_API_URL` |
| Proxy | URL absoluta no bundle; `frontend/vercel.json` faz apenas fallback SPA | API chamada diretamente no Render |
| Backend | Render `tokens`, serviço `srv-db76ku49v7es73al9l6g`, branch `master` | Último sucesso `96548feed2adc1a30af2eca625cab16e3dc851e3` |
| Atualização recusada | Deploy `dep-db7o6gui0phs739bultg`, fonte `eec58ac`, build concluído, processo encerrado com status 1 | Log: `JWT_SECRET deve ter pelo menos 32 caracteres.` |
| Disponibilidade API | GET `/api/health` respondeu 502, inclusive sem Origin e com Origin correto | NÃO FOI POSSÍVEL VERIFICAR os fluxos públicos nesta revisão; 502 não comprova falha de CORS |
| CORS | Logs do deploy recusado incluem theta e a origem antiga | Configuração registrada; comportamento hospedado da versão nova ainda não validado |
| Banco remoto | `MONGO_URI` existe no painel, mantida mascarada | Nome, isolamento, duplicidades, formatos e índices NÃO VERIFICADOS |

O endereço antigo `tokens-mu.vercel.app` respondeu 404 e não é recomendado como acesso.

## Causa e limites

O código público do backend `96548fe` exige `deliveryChannel=email|whatsapp`; o frontend solicita `screen`. Essa combinação explica a mensagem “Escolha um canal de envio válido: e-mail ou WhatsApp.” observada na etapa anterior. O novo backend compilou, porém recusou o segredo JWT curto na inicialização. Não reduzir a validação para contornar o problema.

A branch corrigida já gera exclusivamente na tela, sem invocar `deliverToken`; não há rota alternativa que habilite SMTP/Vonage. Isso está validado localmente. **Não significa que o backend antigo hospedado tenha envio externo desativado.** Não forçar canais externos remotamente.

Login dos três perfis e consultas administrativas foram confirmados na etapa anterior. Nesta revisão não foram repetidos com a API em 502. As credenciais públicas foram preservadas; nenhum seed remoto, alteração de senha, exclusão ou mutação administrativa foi executado. A validação pública completa aguarda deploy especificamente autorizado.

## GitHub e automação

O [PR existente](https://github.com/guilhermehgl/tokens/pull/1) permanece aberto. O CI de `42083d7` passou em Node 22 e 24 ([execução](https://github.com/guilhermehgl/tokens/actions/runs/38621039452)). Esse resultado não certifica commits locais posteriores.

O workflow de qualidade não contém deploy, mas **a integração Vercel cria previews ao atualizar a branch/PR**; isso ocorreu na etapa anterior. Portanto, ausência de comando manual não significa ausência de deploy automático. Render também registra Auto-Deploy para `master`.

Naquela etapa os novos commits aguardavam autorização de push/preview; essa autorização foi concedida posteriormente, conforme atualização acima. A homepage não anuncia um fluxo completo aprovado. [Plano de publicação, banco e rollback](DEPLOY.md).
