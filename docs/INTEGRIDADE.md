# Integridade e operação segura

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

Use banco isolado, nome terminado em `_demo`, credenciais próprias e nenhuma informação empresarial. O seed só aceita banco vazio ou com marcador conhecido, não apaga registros nem redefine senhas. Bancos desconhecidos são recusados mesmo quando vazios.

Identidades `isDemo`, com domínio reservado `@demo.local` ou com um dos três e-mails públicos documentados no README são protegidas. O administrador demo consulta usuários e auditoria, mas não cria, altera, exclui nem redefine senhas de usuários. O backend revalida a existência e o perfil do usuário em cada requisição. Empresas fictícias iniciais não são editáveis por contas demo. Criação de empresas, edição e geração compartilham uma cota de 30 escritas/hora por conta demo, independente do IP.

As cotas são em memória, por processo, e reiniciam com a API. Elas limitam crescimento por período, mas não estabelecem um teto permanente de registros. Para operação pública prolongada, monitore armazenamento e crie uma nova base demo isolada para rotação controlada, mantendo a anterior para revisão. Não existe endpoint de limpeza ou restauração destrutiva. O seed não restaura registros alterados por administradores comuns.

## HTTP e autenticação

Limites independentes por IP: geral 100/minuto, login 5/minuto com bloqueio de 15 minutos, verificação 10/minuto com bloqueio de 10 minutos. Retorno 429 inclui `Retry-After`. Entradas inativas expiram; cada limitador aceita até 10.000 chaves e recusa novas chaves quando cheio, sem expulsar bloqueios ativos. Não usa Redis. Para múltiplas instâncias, será necessário armazenamento compartilhado antes de escalar; falha de um Redis futuro não deverá desabilitar a proteção.

`trust proxy` fica desativado. Configure `TRUST_PROXY` somente com IPs/CIDRs reais dos proxies confiáveis e restrinja acesso direto à API na infraestrutura. Nunca use `true` ou confie livremente em `X-Forwarded-For`. A topologia de produção não foi alterada ou certificada.

A API aplica CSP restritiva, `nosniff`, política de referência e headers Helmet. A CSP da API não protege o HTML hospedado separadamente: configure headers do frontend no serviço responsável. HSTS só é ativado com `HTTPS_ENABLED=true` em HTTPS real. JSON limitado a 32 KiB; CORS usa origens exatas e devolve 403 para origem proibida.

JWT continua Bearer em localStorage por compatibilidade. A restauração consulta o backend e a expiração real encerra a sessão; 401 autenticado causa logout, 403 continua sendo erro de autorização. Logout propaga entre abas. Tokens já emitidos não são revogados no servidor pelo logout ou pela troca de senha; expiram em 11 horas. HttpOnly reduziria exposição a XSS, mas exigiria contrato de cookies, CSRF e CORS diferente; essa migração ficou pendente. Não compartilhe contas demo com um banco de dados reais.

CPF/CNPJ são normalizados e validados por tipo, caracteres e comprimento, mantendo os documentos fictícios existentes. Não há verificação de dígitos verificadores nem consulta cadastral oficial. Senhas de usuários exigem oito caracteres, letra, número e símbolo, até 72 bytes para evitar truncamento do bcrypt.

## Licença e histórico

A decisão de licença permanece pendente da confirmação dos direitos sobre o código. O metadado genérico ISC foi substituído por `UNLICENSED`; isso não concede uma licença de reutilização. A licença OFL das fontes é preservada.

O histórico anterior contém nomes e assets da identidade empresarial antiga. Não foi reescrito. A inspeção de cinco commits e padrões de credenciais não confirmou credenciais reais; isso não substitui revisão especializada de todo conteúdo binário e de segredos fora dos padrões. Não reutilize assets empresariais nem reescreva o histórico sem decisão explícita.
