# Integridade e operação segura

## Estado da demonstração — 16/10/2026

O diagnóstico remoto somente leitura e a publicação foram concluídos. Os índices únicos necessários e o marcador demonstrativo estão preparados; o TTL foi preservado, e transações/cotas estão ativas. O responsável confirmou dados fictícios em `test` e dispensou backup. As orientações abaixo continuam aplicáveis a futuras bases e alterações; não representam bloqueios atuais. [Evidências e histórico](PUBLICACAO.md).

## Índices e base existente

`tokens.tokenHash`, `companies.documento` e `users.email` possuem índices únicos. A API aguarda sua criação antes de escutar requisições e recusa a inicialização se identificar duplicidades ou formatos legados incompatíveis. Não remove índices ou registros automaticamente. `autoIndex` está desativado na conexão da aplicação.

Antes de atualizar uma base **conhecida e autorizada**, configure `MONGO_URI` e `INTEGRITY_DB_NAME` com o nome exato do banco e execute na pasta backend:

```powershell
$env:INTEGRITY_DB_NAME="portal_tokens_demo"
npm run check:integrity
```

O diagnóstico usa somente leituras, desabilita criação automática de índices e coleções e imprime contagens e estado dos índices esperados, sem hashes, e-mails ou documentos. Inclui duplicidades de e-mails após normalização, hashes inválidos, documentos não canônicos e índices únicos/TTL ausentes ou incompatíveis. Código de saída 1 indica pendências, recusa ou falha de acesso. Se houver documentos formatados, normalize-os somente após revisão humana: documentos não canônicos bloqueiam a inicialização, evitando ignorar colisões entre formas diferentes. O diagnóstico não modifica o banco, não certifica todos os campos legados e não autoriza migração. Nenhuma migração foi executada em banco remoto. [Plano de publicação e rollback](DEPLOY.md).

Em base existente, faça backup e revise duplicidades e formatos antes de qualquer migração. Não exclua registros para contornar o índice. Caso já exista índice não único com o mesmo nome/especificação, a criação pode falhar; planeje sua substituição explicitamente com o responsável pelo banco. A aplicação falha sem aceitar tráfego enquanto os índices necessários não estiverem disponíveis.

## Códigos e notas fiscais

O formato permanece com seis caracteres, pelo menos um número e geração criptográfica. SHA-256 é o único valor do código persistido. O índice arbitra concorrência; colisões geram até cinco tentativas, seguidas de HTTP 503 controlado. Nenhum registro existente é sobrescrito.

A regra atual permite vários tokens ativos para a mesma empresa/NF. Ela foi preservada porque não existe regra explícita de substituição. Recomendação pendente: decidir se uma reemissão deve revogar códigos anteriores ou representar outra retirada. Essa decisão exige validação de negócio.

Tokens expiram após 30 dias. A condição `expiresAt > agora` na operação atômica é a garantia de validade; a remoção TTL do MongoDB é assíncrona. O índice único protege códigos entre registros retidos; após remoção por TTL, um código pode ser sorteado novamente. Não existe promessa de unicidade eterna.

## Auditoria

Geração, cadastro, edição e consumo usam um helper comum. A consulta administrativa mantém o contrato de array e sanitiza campos sensíveis recursivamente; a gravação também sanitiza os detalhes. IDs, NF, empresa, usuário e horários necessários à investigação são preservados. A sanitização remove campos por nome e não equivale a um detector universal de segredos inseridos em textos livres.

A gravação da auditoria é **best effort**, sem transação ou fila durável. Se falhar após a operação principal, a resposta continua refletindo o sucesso efetivo e o servidor registra `AUDIT_WRITE_FAILED` com ação e tipo de alvo, sem payload ou erro do driver. A verificação usa o snapshot da empresa retornado pelo próprio consumo, eliminando consultas posteriores que poderiam gerar um falso erro. A auditoria pode ficar incompleta em falha de banco/processo; não há garantia de recuperação automática.

## Demonstração compartilhada

Use banco isolado, credenciais próprias e nenhuma informação empresarial. O seed local exige nome terminado em `_demo` e banco vazio ou com marcador conhecido; não apaga registros nem redefine senhas. A exigência de sufixo é uma proteção do seed, não uma regra de nome para a conexão normal ou para o diagnóstico de uma base existente autorizada.

As três identidades públicas e as três contas iniciais do seed são fixas. No ambiente explicitamente ativado, o administrador cria somente vendedor/verificador com e-mail `.test` ou `.example`. O servidor define `isDemo` e `demoManaged`; o cliente não pode definir flags, atividade ou promover a conta a administrador. Apenas usuários com `demoManaged=true` e perfil permitido podem ser editados, excluídos ou receber nova senha. Registros legados não recebem essa marca automaticamente. Fora do ambiente ativado, permanece o bloqueio de mutações para administradores demo. Isso evita habilitar privilégios apenas pelo e-mail ou por `isDemo`.

O backend revalida existência, atividade e perfil a cada requisição. Exclusão do usuário invalida seu acesso e preserva tokens e auditoria; o log contém ID, nome e perfil do alvo, sem senha. Empresas iniciais por documento e empresas legadas sem marca editável são protegidas. Não existe exclusão de empresas.

As cotas globais persistentes são 50 usuários ativos, 50 empresas ativas e 10 emissões por dia civil de São Paulo. Os limitadores auxiliares continuam por processo: 30 escritas/hora por conta demo e 10 edições/exclusões por minuto por IP. Reiniciá-los não altera as cotas MongoDB. Não existe endpoint de limpeza ou restauração destrutiva.

## Ativação explícita e cotas transacionais

`DEMO_ENABLED=true` exige `DEMO_DB_NAME` e `DEMO_DB_HOST` correspondentes à URI e ao banco efetivamente conectado. Além disso, a conexão precisa ser confirmada por leitura do marcador `_id=portal-tokens-demo-v1`, `purpose=public-demo` em `demo_environment`. O seed local o prepara; no Atlas, uma criação precisa ser apresentada e autorizada separadamente. Não há criação automática nem ativação apenas com variáveis copiadas. Nome `test`, domínio do navegador ou flag do cliente não ativam o modo. Divergência recusa acesso autenticado. Na inicialização, a aplicação verifica a identidade e a topologia antes dos índices; conexão tem `autoIndex=false` e `autoCreate=false`. A demonstração exige transações (replica set ou cluster compatível); standalone é recusado, sem fallback de capacidade por contagem solta. A configuração deve ser feita pelo responsável somente após comprovar isolamento; nenhuma configuração consegue provar a natureza fictícia dos dados por si só.

Cada criação e a exclusão permitida de usuário passam por uma transação com leitura snapshot e escrita majority. A escrita no documento `_id=capacity` de `demoquotas` serializa as operações. Contagem real de ativos (`active != false`) e criação/exclusão ocorrem na mesma transação. Registros legados sem `active` contam como ativos. Bases acima de 50 são preservadas e recusam novas criações; editar e consultar não ocupam vagas. Não há contador de vagas inicializado artificialmente em zero nem decremento sujeito a ficar negativo.

Emissões usam documento diário `tokens:AAAA-MM-DD` na mesma transação do token. A primeira emissão considera os tokens já existentes naquele dia. O instante de emissão é capturado após adquirir o controle, também usado em `createdAt`; a data e a próxima meia-noite são calculadas com Intl/`America/Sao_Paulo`, sem depender do fuso do host. O contador diário não possui TTL e não é devolvido por consumo, remoção TTL ou falha secundária de auditoria.

Se a transação falha antes do commit, token e consumo de capacidade são descartados juntos. Colisão de hash aborta a transação e permite nova tentativa inteira, até cinco. O driver trata falhas transitórias e resultado incerto de commit; não existe compensação manual que devolva uma cota cujo token possa ter sido persistido. Auditoria fica fora da transação e mantém o comportamento best effort. Contador inválido ou datas legadas desconhecidas recusam a emissão e exigem revisão.

Todos os caminhos HTTP de criação passam pelo mesmo controle, inclusive contas antigas e usuários criados. Operações administrativas diretas no banco e versões antigas simultâneas são externas à garantia: o corte de versão deve impedir outros escritores. Antes da primeira inicialização diária, revisar histórico do dia; se tokens anteriores tiverem sido apagados ou metadados não forem confiáveis, preparar bootstrap conservador aprovado ou iniciar a nova versão no próximo dia de São Paulo com escritores antigos bloqueados. Não zerar o contador manualmente.

`GET /api/demo/limits` exige autenticação e fornece somente contagens, máximos, restante e próxima liberação. Não cria coleções ou contadores. Pode haver atualização entre a consulta e o clique; a transação sempre decide. Usuários/empresas esgotados retornam 409 (`demo_users_limit`, `demo_companies_limit`); tokens retornam 429 (`demo_tokens_daily_limit`) com `Retry-After`. Os painéis atualizam cotas após operações, a cada 30 segundos, ao voltar à aba e pelo botão de atualização. Falha de consulta mantém consultas disponíveis e impede iniciar novas criações pela interface.

O diagnóstico somente leitura inclui topologia, capacidade, datas legadas e contador diário; não autoriza sua correção. `demoquotas` utiliza somente o índice padrão `_id`, sem novo índice personalizado/TTL. Na publicação de 16/10/2026, as operações demonstrativas autorizadas já efetuaram suas primeiras escritas. Em uma nova base, a criação e as escritas iniciais ocorrem dentro dessas transações; o diagnóstico permanece somente leitura.

Referência: [transações do driver MongoDB](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

## HTTP e autenticação

Limites independentes por IP: geral 100/minuto, login 5/minuto com bloqueio de 15 minutos, verificação 10/minuto com bloqueio de 10 minutos. Retorno 429 inclui `Retry-After`. Entradas inativas expiram; cada limitador aceita até 10.000 chaves e recusa novas chaves quando cheio, sem expulsar bloqueios ativos. Não usa Redis. Para múltiplas instâncias, será necessário armazenamento compartilhado antes de escalar; falha de um Redis futuro não deverá desabilitar a proteção.

`trust proxy` fica desativado. Configure `TRUST_PROXY` somente com IPs/CIDRs reais dos proxies confiáveis e restrinja acesso direto à API na infraestrutura. Nunca use `true` ou confie livremente em `X-Forwarded-For`. A topologia de produção não foi alterada ou certificada.

A API aplica CSP restritiva, `nosniff`, política de referência e headers Helmet. A CSP da API não protege o HTML hospedado separadamente: configure headers do frontend no serviço responsável. HSTS só é ativado com `HTTPS_ENABLED=true` em HTTPS real. JSON limitado a 32 KiB; CORS usa origens exatas e devolve 403 para origem proibida.

JWT continua Bearer em localStorage por compatibilidade. A restauração consulta o backend e a expiração real encerra a sessão; 401 autenticado causa logout, 403 continua sendo erro de autorização. Logout propaga entre abas. Tokens já emitidos não são revogados no servidor pelo logout ou pela troca de senha; expiram em 11 horas. HttpOnly reduziria exposição a XSS, mas exigiria contrato de cookies, CSRF e CORS diferente; essa migração ficou pendente. Não compartilhe contas demo com um banco de dados reais.

CPF/CNPJ são normalizados e validados por tipo, caracteres e comprimento, mantendo os documentos fictícios existentes. Não há verificação de dígitos verificadores nem consulta cadastral oficial. Senhas de usuários exigem oito caracteres, letra, número e símbolo, até 72 bytes para evitar truncamento do bcrypt.

## Licença e histórico

O autor confirmou que possui autorização para publicar e reutilizar o código. A licença a conceder a terceiros ainda não foi escolhida. O metadado `UNLICENSED` não concede uma licença permissiva; a licença OFL das fontes é preservada.

O histórico anterior contém nomes e assets da identidade empresarial original, preservados com autorização do autor. Não há necessidade de reescrever o histórico ou remover referências pela origem. A inspeção histórica de cinco commits e padrões de credenciais não confirmou credenciais reais; isso não certifica todo o histórico ou conteúdo binário. Segredos privados continuam excluídos da autorização de publicação.
