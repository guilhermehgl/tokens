# Portal de Tokens

Aplicação full stack para controlar a retirada de pedidos por códigos de uso único. Adaptada de um cenário empresarial para apresentação pública, com identidade neutra e dados fictícios.

## Funcionalidades

| Perfil | Acesso |
| --- | --- |
| Administrador | Usuários, empresas e auditoria |
| Vendedor | Cadastro de empresas e geração de tokens vinculados à NF |
| Verificador | Validação de tokens, retiradas e pendências |

Existe uma única aplicação, com login normal por e-mail e senha. Não há seleção de modo nem atalhos de acesso na tela. JWT, bcrypt e permissões por perfil permanecem ativos.

## Acessos para demonstração

| Perfil | Login | Senha |
| --- | --- | --- |
| Administrador | admin@demo.local | DemoTokens!2026 |
| Vendedor | vendedor@demo.local | DemoTokens!2026 |
| Verificador | verificador@demo.local | DemoTokens!2026 |

As contas acima são criadas pelo seed de preparação, descrito abaixo. Não existe autenticação especial: digite as credenciais no formulário de login. As contas compartilhadas são protegidas contra alteração e exclusão para manter o acesso disponível.

## Executar localmente

Requisitos: Node.js 24.15+ (linha 24) ou 22.22.2+, npm e MongoDB disponível.

Na primeira instalação:

```powershell
npm run setup
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Não sobrescreva arquivos .env existentes. No backend/.env configure MONGO_URI para seu banco e JWT_SECRET com o segredo gerado (mínimo 32 caracteres). O exemplo usa MongoDB local em mongodb://127.0.0.1:27017/portal_tokens_demo. No frontend/.env use VITE_API_URL=/api para o proxy local.

Para preparar as contas e empresas fictícias, execute uma vez:

```powershell
npm --prefix backend run seed
```

O seed é idempotente, não apaga dados nem redefine senhas existentes. Ele aceita um banco vazio ou já identificado pelo seu marcador; recusa bases preexistentes com dados sem esse marcador. Essa preparação não é outra forma de iniciar o aplicativo.

Sempre inicie o projeto pela pasta raiz com:

```powershell
npm start
```

Frontend: http://localhost:5173. API: http://localhost:3003/api. Não existe comando separado de inicialização da demonstração ou variável APP_MODE.

## Experimentar o fluxo

1. Faça login como vendedor com as credenciais acima.
2. Escolha uma empresa fictícia, clique em Gerar token e informe uma NF de nove dígitos, como 000000101.
3. E-mail e WhatsApp aparecem desabilitados. Gere o código e copie-o diretamente do modal.
4. Saia e entre como verificador; informe o código para liberar a retirada.
5. Uma segunda utilização será recusada. Consulte as retiradas e a auditoria conforme o perfil.

A API sempre retorna o código ao gerador autorizado e nunca envia mensagens, mesmo se uma requisição informar e-mail ou WhatsApp como canal. O código aparece somente no resultado da geração, sem gravação no navegador ou em URLs. O banco armazena apenas seu SHA-256, validade de 30 dias e estado de uso. A verificação usa operação atômica no MongoDB para impedir duas liberações concorrentes. Respostas de geração usam Cache-Control: no-store.

## Arquitetura e integrações preservadas

- Frontend: React, Vite, React Router e Axios.
- Backend: Express, TypeScript e Mongoose.
- MongoDB: usuários, empresas, tokens e auditoria.
- JWT e bcrypt: autenticação e senhas com hash.
- E-mail: Nodemailer, SMTP e template MJML, preservados em backend/src/utils/email.ts e na função deliverToken de backend/src/controllers/token.controller.ts.
- WhatsApp: Vonage Messages API, JWT RS256, validações e tratamento de erros preservados em backend/src/services/whatsapp.service.ts. Documentação: [WHATSAPP.md](backend/WHATSAPP.md).

As integrações fazem parte da implementação original e permanecem no código, mas a geração não as chama. Credenciais SMTP/Vonage não são necessárias para usar o portal; preenchê-las não habilita envios. Uma futura reativação exige alterar explicitamente o fluxo no código. Aceite da Vonage não representa confirmação de entrega.

## Build e hospedagem

Backend: diretório backend, build npm ci --include=dev && npm run build, start npm start. Configure MONGO_URI, JWT_SECRET e CORS_ORIGINS. Health check: GET /api/health.

Frontend: diretório frontend, preset Vite, build npm run build, saída dist. Para API separada use VITE_API_URL=https://api.example.com/api e inclua o domínio exato do frontend em CORS_ORIGINS. Mudanças em variáveis Vite exigem novo build. frontend/vercel.json mantém as rotas React acessíveis diretamente.

## Verificação

```powershell
npm --prefix backend test
npm --prefix frontend run test:delivery
npm --prefix frontend run test:phone
npm --prefix frontend run build
```

Os testes HTTP utilizam MongoDB temporário isolado; testes de SMTP/Vonage utilizam mocks e transportes locais, sem envio real. O MongoDB temporário serve somente aos testes e não é outro modo de iniciar o aplicativo.

Use dados fictícios: os cadastros são compartilhados entre visitantes conforme o perfil. Arquivos .env, chaves, dumps e histórico empresarial não devem acompanhar uma publicação. A preparação local não publica alterações no GitHub ou em servidores.
