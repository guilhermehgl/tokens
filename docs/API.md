# Contrato demonstrativo de tokens

Base local `/api`; o frontend hospedado aponta para `https://tokens-xfrp.onrender.com/api`. O contrato abaixo está publicado na demonstração em `9360622`, integrado à master pelo merge `8cadd15`. Estado confirmado em 16/10/2026; veja [Publicação](PUBLICACAO.md).

## Geração

`POST /api/tokens/generate`, Bearer JWT, perfil vendedor ou administrador:

```json
{"companyId":"<ObjectId existente>","nfNumber":"000000101","deliveryChannel":"screen"}
```

A NF é string com nove dígitos, preservando zeros iniciais. `deliveryChannel` é ignorado: omitido, `screen`, `email` e `whatsapp` produzem exclusivamente exibição na tela. Não existe parâmetro ou variável que reative envio nessa rota.

HTTP 200 com `Cache-Control: no-store`:

```json
{"success":true,"token":"ABC123","tokenId":"<ObjectId>","expiresAt":"<ISO-8601>","deliveryChannel":"screen","message":"Token gerado. Copie o código exibido na tela."}
```

O código do exemplo é ilustrativo. O código real tem seis caracteres e validade de 30 dias. Só SHA-256 é persistido; o código aparece apenas na resposta autorizada. Auditoria registra contexto e canal `screen`, sem código/hash. O frontend exibe modal e permite copiar, sem persistência em URL/localStorage.

Erros: 400 dados inválidos, 401 sessão inválida, 403 perfil sem permissão, 404 empresa ausente, 429 limite excedido, 503 esgotamento das tentativas de colisão e 500 falha interna.

## Verificação

`POST /api/tokens/verify`, Bearer JWT, perfil verificador ou administrador:

```json
{"token":"ABC123"}
```

Consumo atômico exige hash correspondente, `used=false` e validade futura. HTTP 200 confirma liberação. HTTP 400 com `code=used_token` impede repetição; `expired_token` informa vencimento enquanto o registro existir; `invalid_token` cobre formato incorreto ou código ausente. Após TTL, código vencido pode ser informado como não encontrado.

`GET /api/tokens/unverified` e `GET /api/tokens/verified-today` não devolvem código/hash. `GET /api/audit` exige administrador e sanitiza registros antigos. Falhas secundárias de auditoria não revertem retirada consumida; auditoria não é transacional.

## Integrações preservadas

`deliverToken`, SMTP/Nodemailer/MJML e Vonage permanecem implementados, sem ligação com as rotas demonstrativas de geração. Os serviços têm testes com mocks/transportes locais. O teste HTTP bloqueia conexões externas e criação de transporte SMTP durante geração, inclusive com canais forçados.

## Administração demonstrativa e cotas

Com `DEMO_ENABLED=true` e identidade de banco/host confirmada no servidor:

- `POST /api/auth/create`: admin cria vendedor/verificador com `{nome,email,password,role}`. E-mail deve terminar em `.test` ou `.example`; flags internas são recusadas. Resposta 201 mantém o contrato existente. O usuário recebe `demoManaged=true` no servidor.
- `PUT /api/users/:id`: admin altera `{name,email,role,password?}` somente de usuário criado na demonstração. Não permite administrador, e-mail reservado ou flags de proteção/atividade.
- `PUT /api/users/:id/reset-password`: `{newPassword}`; mesmas restrições de alvo.
- `DELETE /api/users/:id`: exclui somente usuário permitido, invalidando suas próximas requisições. Preserva tokens e auditoria.
- `GET /api/users`: mantém o array e acrescenta `canManage` para apresentação das ações. Campos de senha/recuperação não são retornados.
- `GET /api/companies`: acrescenta `canEdit`; criação/edição mantêm validações. Não há exclusão de empresa.
- `GET /api/demo/limits`: qualquer sessão autenticada consulta máximos, utilizados, restantes e próxima liberação. Sem modo explicitamente ativado retorna `{enabled:false}`. Não cria contadores.

Todas as contas conectadas ao banco demo, inclusive legadas e criadas, compartilham 50 usuários ativos, 50 empresas ativas e 10 emissões por dia de São Paulo. Capacidade esgotada não impede login, consulta, edição autorizada, exclusão permitida ou verificação de códigos existentes.

Capacidade de usuários/empresas: HTTP 409, códigos `demo_users_limit` e `demo_companies_limit`. Emissões: HTTP 429, código `demo_tokens_daily_limit`, `Retry-After` e `limit.nextReset`. Cada resposta inclui `message` e `limit:{type,maximum,used,remaining,nextReset?}`. Configuração de ambiente divergente retorna 503 `demo_environment_unavailable`; falha na consulta das cotas retorna 503 `demo_limits_unavailable`.

Exemplo apenas de formato (valores reais vêm do banco):

```json
{"enabled":true,"users":{"maximum":50,"used":3,"remaining":47},"companies":{"maximum":50,"used":2,"remaining":48},"tokens":{"maximum":10,"used":0,"remaining":10,"nextReset":"2026-10-16T03:00:00.000Z","timeZone":"America/Sao_Paulo"}}
```

Auditoria acrescenta `CREATE_USER`, `EDIT_USER`, `RESET_USER_PASSWORD` e `DELETE_USER`, com ID/nome/perfil do alvo e sem senha. Sua gravação continua best effort; o consumo de cota e o registro principal são transacionais, a auditoria não é.
