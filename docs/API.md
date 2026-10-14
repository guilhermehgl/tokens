# Contrato demonstrativo de tokens

Base local `/api`; o frontend hospedado aponta para `https://tokens-xfrp.onrender.com/api`. O contrato abaixo pertence à branch corrigida, ainda pendente de publicação autorizada. O backend antigo hospedado é incompatível.

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
