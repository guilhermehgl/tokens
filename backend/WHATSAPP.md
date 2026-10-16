# Integrações de mensagens — referência técnica e histórico

O código corrigido gera o token na tela. `POST /api/tokens/generate` não chama SMTP ou Vonage, independentemente de `deliveryChannel`. Não há endpoint demonstrativo de envio. A função `deliverToken` e os serviços abaixo foram preservados para referência; configurar credenciais não reativa o fluxo.

Este documento distingue implementação existente, comportamento atual e verificações históricas. A demonstração hospedada está na versão `9360622`, publicada e validada em 16/10/2026, com geração somente na tela; veja [Publicação](../docs/PUBLICACAO.md). As observações históricas de envio abaixo não certificam funcionamento atual dos provedores.

## E-mail: Nodemailer, SMTP e MJML

A função `deliverToken`, em `src/controllers/token.controller.ts`, contém o template MJML, sua conversão para HTML e a chamada a `sendEmail`. `src/utils/email.ts` valida configuração e fornece o transporte Nodemailer/SMTP. O template recebe empresa, NF e o código em memória; o banco guarda somente seu hash.

As variáveis SMTP ficam exclusivamente no backend. Os testes de e-mail utilizam transporte MIME local ou mocks, sem entrega a destinatários. Configuração válida e `transporter.verify()` não comprovam recebimento de uma mensagem.

## WhatsApp: Vonage Messages API

`src/services/whatsapp.service.ts` valida telefone E.164, configuração e respostas. O envio preservado utiliza HTTPS v1, JWT RS256, `jsonwebtoken` e `fetch`, sem SDK adicional.

### Configuração de referência

Execute a partir de `backend`. `VONAGE_APPLICATION_ID`, `VONAGE_PRIVATE_KEY_PATH`, `VONAGE_WHATSAPP_FROM` e `VONAGE_MESSAGES_API_URL` ficam somente no `.env` do backend. O caminho da chave pode ser absoluto ou relativo ao diretório de execução; o exemplo sem segredos está em [.env.example](.env.example).

Chaves em `backend/secrets/`, arquivos `.key`/`.pem` e `.env` são ignorados pelo Git. Não coloque chaves no frontend, em logs ou no PR. Preserve configurações existentes ao editar um ambiente autorizado.

O endpoint Sandbox é `https://messages-sandbox.nexmo.com/v1/messages`; o remetente vem do painel, sem `+`. Não foram implementados webhooks de confirmação de entrega.

### Identificador de destinatário no Sandbox

Um identificador WhatsApp autorizado pode diferir do telefone nacional com nono dígito. O serviço aceita `VONAGE_SANDBOX_RECIPIENT_OVERRIDES` como JSON de origem para destino, ambos sem `+`. Exemplo apenas de formato, com números ilustrativos: `{"5511999999999":"551199999999"}`. O destino real deve corresponder exatamente ao autorizado no painel.

O mapeamento vale somente para `messages-sandbox.nexmo.com` e correspondência exata. Não tenta números alternativos nem remove dígitos automaticamente; no endpoint de produção, é ignorado. JSON inválido recusa a configuração do serviço. **Isso não bloqueia a geração atual na tela**, que não chama o serviço.

### Mensagem com imagem

`WHATSAPP_TOKEN_IMAGE_URL`, quando preenchida, seleciona uma mensagem `message_type: image`, com `image.url` e legenda contendo NF, código e validade. Sem URL, o serviço usa texto. Não existe segundo envio nem fallback silencioso.

O serviço exige HTTPS e rejeita credenciais na URL, endereços locais e IPs literais. A validação sintática não garante acessibilidade da mídia nem ausência de resolução DNS privada; essas verificações pertencem à configuração autorizada da integração.

Um teste histórico utilizou miniatura externa Google/gstatic, sem garantia de estabilidade ou equivalência com o asset local. Uma eventual reativação precisaria de mídia pública estável e autorizada; não é necessário trocar a imagem ou configurar esse serviço para demonstrar o portal.

### Respostas e erros

HTTP 202 significa **aceite pelo provedor, não entrega**. O serviço retorna identificador de mensagem e estado de aceite. Rejeições imediatas de configuração, destinatário, janela, limite ou indisponibilidade recebem tratamento controlado; respostas brutas e segredos não devem ser expostos.

Falhas posteriores ao aceite precisam de consulta ao painel ou futura implementação de webhook. Em timeout, o resultado pode ser incerto; repetir sem verificar pode duplicar mensagens.

## Comportamento histórico de geração e envio

Antes da adaptação, o controller persistia o token e enviava pelo canal escolhido. Uma falha após a gravação mantinha o registro, com `tokenCreated: true`; repetir a requisição podia gerar outro código. A auditoria registrava contexto/canal e aceite, sem código em texto puro. Não havia retry automático, reenvio idempotente ou transação envolvendo o provedor.

**Esse é um registro do fluxo anterior, não o contrato atual.** A geração corrigida persiste o hash e devolve o código na tela com canal `screen`; o helper de envio não persiste tokens nem grava auditoria por conta própria. A API pode continuar indicando `tokenCreated` em falhas posteriores à criação, sem relação com envio externo. [Contrato atual](../docs/API.md).

## Testes e evidências

```powershell
npm --prefix backend run test:delivery
npm --prefix backend run test:email
npm --prefix backend run test:phone
npm --prefix frontend run test:delivery
npm --prefix frontend run test:phone
```

Execute esses comandos na raiz. Os testes atuais usam provedores simulados ou transporte MIME local e não enviam mensagens. Testes HTTP verificam que canais omitido, `screen`, `email` e `whatsapp` não acionam integrações durante a geração.

Registros históricos anteriores relatam um teste WhatsApp aceito (202), com recebimento confirmado pelo responsável, e verificação de conexão/autenticação SMTP sem novo envio de token. Essas observações não foram repetidas nesta etapa e não comprovam entrega atual da aplicação hospedada.

## Referências e limites para eventual reativação

As orientações do Sandbox incluem destinatários autorizados, remetente de teste, janela de conversa, disponibilidade de templates e cotas da conta. Valores de quotas dependem das condições atuais do provedor; consulte o painel e a documentação antes de planejar uso real.

Uma reativação exigiria mudança explícita de código e autorização própria. Para uso fora do Sandbox seriam necessários remetente WhatsApp Business aprovado, consentimento, onboarding, templates, webhooks autenticados e revisão de estados de entrega, idempotência e reenvio. Trocar somente a URL para `https://api.nexmo.com/v1/messages` não conclui esse processo. SMS não foi implementado.

Referências: [Sandbox](https://developer.vonage.com/en/messages/concepts/messages-api-sandbox), [autenticação](https://developer.vonage.com/en/messages/technical-details), [mensagem com imagem](https://developer.vonage.com/en/messages/code-snippets/whatsapp/send-image), [erros](https://developer.vonage.com/en/api-errors/messages).
