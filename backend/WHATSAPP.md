# WhatsApp — demonstração Vonage Messages API Sandbox

O portal gera o token diretamente na tela; as opções de envio estão desabilitadas. Este documento descreve a integração preservada para referência. O e-mail continua via Nodemailer/MJML/SMTP; WhatsApp utiliza HTTPS v1 com JWT RS256, usando `jsonwebtoken` e `fetch` já disponíveis. Nenhuma dependência adicional foi instalada.

## Configuração local

Executar o backend a partir da pasta `backend`. As variáveis `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY_PATH`, `VONAGE_WHATSAPP_FROM` e `VONAGE_MESSAGES_API_URL` ficam exclusivamente no `.env` do backend. O caminho da chave pode ser absoluto ou relativo ao diretório de execução. O exemplo sem credenciais está em `.env.example`.

A chave fica em `backend/secrets/`, ignorada pelo Git junto com `.env`, arquivos `.key` e `.pem`. Não compartilhar a chave, salvá-la no frontend ou imprimir conteúdo/headers JWT. Remover de Downloads eventuais cópias temporárias da chave após conferir seu armazenamento no backend. Não substituir o arquivo `.env` inteiro ao atualizar configuração.

Para Sandbox: `https://messages-sandbox.nexmo.com/v1/messages`. O remetente é o número de teste fornecido pelo painel, sem `+`. Webhooks não foram configurados; não há endpoint público exposto ou recebimento automatizado de confirmações de entrega.

## Fluxo

`POST /api/tokens/generate` recebe `companyId` e `nfNumber`, retorna o código ao usuário autenticado e não chama os provedores, independentemente de `deliveryChannel`.

A função `deliverToken` preserva o template MJML, SMTP e o fluxo Vonage, mas não é chamada pela geração. O serviço WhatsApp valida telefone E.164 e configuração antes de enviar. Reativar envios exige uma alteração explícita no código.

### Identificador diferente no Sandbox

Em contas brasileiras, o identificador autorizado pode diferir do telefone nacional com nono dígito. Para esse caso, configurar exclusivamente no backend `VONAGE_SANDBOX_RECIPIENT_OVERRIDES` como JSON, com origem e destino sem `+`, por exemplo `{"5531999410646":"553199410646"}`. A origem é o telefone da empresa; o destino deve ser copiado exatamente do destinatário autorizado no painel Vonage.

O mapeamento é aplicado somente no endpoint `messages-sandbox.nexmo.com`, somente para correspondência exata, sem remover dígitos automaticamente ou tentar destinatários alternativos. Números não mapeados seguem inalterados. Em produção o mapeamento é ignorado. O cadastro e o destino de referência na auditoria continuam com o telefone original da empresa. JSON inválido no Sandbox bloqueia a geração antes da gravação. Após modificar o `.env`, reiniciar o backend.

O token é gerado uma vez, hasheado uma vez, salvo uma vez e enviado pelo canal selecionado. A mensagem WhatsApp usa o mesmo código e a mesma NF/empresa daquela geração. A auditoria mantém `GENERATE_TOKEN` e acrescenta canal, destino e identificador/status de aceite; não armazena o código original. A auditoria de verificação também não recebe mais o código em texto puro; a validação/consumo do token permanece igual.

A ordem existente de persistir antes de enviar foi mantida. Se o envio falhar depois da gravação, o registro permanece no banco. A resposta informa `tokenCreated: true`, e a interface avisa que repetir cria outro token. Não há retry automático, fallback para outro canal, reenvio do mesmo token ou idempotência entre requisições. A interface impede duplo clique durante uma requisição, mas isso não substitui idempotência no servidor.

## Status e erros

## Imagem institucional

`WHATSAPP_TOKEN_IMAGE_URL` configura a URL HTTPS pública da mídia. Quando preenchida, o serviço envia uma única mensagem `message_type: image` com `image.url` e `image.caption`; a legenda contém NF, token em texto/negrito e validade, com assinatura Portal de Tokens. Não há segundo envio ou fallback silencioso se a requisição falhar. Sem URL, mantém o modo texto existente. A auditoria e o controller permanecem inalterados.

A URL Google gstatic foi autorizada provisoriamente para o teste e respondeu HTTP 200, image/jpeg, sem login. É uma miniatura externa, sem garantia de estabilidade ou identidade byte a byte com `frontend/src/assets/images.jpeg`. O arquivo local e seus imports não foram alterados. Para produção, substituir por URL estável da imagem original, sem autenticação. O serviço rejeita URLs locais, IPs literais e credenciais; a acessibilidade externa e eventuais resoluções DNS privadas devem ser verificadas na configuração da hospedagem, não são garantidas pela validação sintática. Não usa caminho local do frontend.

Referência: https://developer.vonage.com/en/messages/code-snippets/whatsapp/send-image . HTTP 202 continua significando aceite, não confirmação de download ou entrega da imagem. Sem webhook, o recebimento precisa ser confirmado pelo destinatário.

HTTP 202 da Vonage significa **aceito**, não entregue. A resposta/auditoria registra `deliveryStatus: accepted` e o `message_uuid`. Rejeições imediatas identificáveis (allowlist, janela, configuração, limite, indisponibilidade) viram mensagens amigáveis. Respostas brutas, credenciais e conteúdo do token não são retornados ou logados.

Falhas posteriores ao aceite só podem ser confirmadas no painel Vonage ou por um futuro webhook de status. Não é possível detectar uma rejeição assíncrona apenas pelo POST. Em timeout, confirmar o status no painel antes de repetir.

## Restrições do Sandbox

- O destinatário deve estar na allowlist da mesma API key da aplicação.
- O remetente é um número da Vonage, não um número comercial próprio.
- Mensagens livres exigem janela de 24 horas aberta por mensagem do destinatário.
- Templates não estão habilitados no Sandbox.
- Uso demonstrativo gratuito: limite de 100 mensagens por mês e uma mensagem por segundo.
- O formato cadastrado deve corresponder ao número WhatsApp permitido; não alterar silenciosamente DDD ou dígitos para contornar erros. A identificação do WhatsApp pode diferir do número celular nacional em contas brasileiras antigas.

Referências oficiais: [Sandbox](https://developer.vonage.com/en/messages/concepts/messages-api-sandbox), [autenticação](https://developer.vonage.com/en/messages/technical-details), [erros](https://developer.vonage.com/en/api-errors/messages).

## Verificação

O teste isolado anterior à integração foi aceito (HTTP 202) e o usuário confirmou o recebimento. Os testes automatizados usam banco, SMTP e Vonage simulados e não enviam mensagens reais. Executar `npm run test:delivery` e `npm run test:phone` em `backend`; em `frontend`, executar os mesmos scripts e `npm run build`.

A conexão e autenticação do SMTP Skymail foram verificadas com `transporter.verify()`, sem envio de e-mail. O utilitário `email.ts` permaneceu idêntico. O recebimento de um novo e-mail de token não foi testado nesta etapa.

Para um teste ponta a ponta real, escolher explicitamente uma empresa com telefone autorizado e uma NF de teste; isso cria um token/auditoria reais. Não confundir testes simulados com comprovação de entrega SMTP ou WhatsApp.

## Migração futura para produção

Cadastrar uma conta WhatsApp Business/remetente próprio na Vonage, concluir aprovações e consentimento dos destinatários, vincular o canal à aplicação, configurar webhooks HTTPS de entrada/status com validação de assinatura e implementar templates aprovados para envios fora da janela. Configurar `VONAGE_MESSAGES_API_URL=https://api.nexmo.com/v1/messages` e atualizar remetente/credenciais no backend. Trocar só a URL não conclui o onboarding nem permite mensagens livres fora da janela. Avaliar filas, estados de entrega, idempotência e reenvio seguro antes do uso comercial. SMS não foi implementado.
