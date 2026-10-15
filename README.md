# Portal de Tokens

Sistema Full Stack para geração e validação de códigos de retirada de pedidos, desenvolvido com React, Node.js, TypeScript e MongoDB.

A aplicação organiza o trabalho de vendedores, verificadores e administradores, com controle de acesso, códigos de uso único e rastreabilidade das operações. Desenvolvida a partir de uma necessidade empresarial real e adaptada para demonstração pública e portfólio.

![Painel do vendedor com token gerado, botão de cópia e confirmação de que nenhuma mensagem externa foi enviada](docs/images/generation.jpg)

*Captura real da versão local corrigida, com dados fictícios. Não comprova o funcionamento do ambiente hospedado.*

## Funcionalidades

| Perfil | O que permite fazer |
| --- | --- |
| Administrador | Consultar usuários, empresas e auditoria; gerenciar usuários quando autorizado. Contas demonstrativas possuem acesso de consulta aos usuários. |
| Vendedor | Cadastrar empresas e gerar códigos de retirada vinculados a notas fiscais. Visualizar e copiar o token gerado. |
| Verificador | Validar códigos e confirmar retiradas; consultar pendências e tokens utilizados no dia. |

O fluxo central é **cadastrar empresa → gerar token para uma NF → copiar código → verificar retirada**. Um código vencido ou já utilizado não libera uma segunda retirada. As operações relevantes geram registros de auditoria; os dados de entrada são validados pela API.

<details>
<summary>Mais telas da aplicação</summary>

| Login | Administração |
| --- | --- |
| ![Formulário de acesso ao Portal de Tokens](docs/images/login.jpg) | ![Painel administrativo com consulta de usuários](docs/images/admin.jpg) |

| Verificação | Auditoria |
| --- | --- |
| ![Painel do verificador com consulta de retiradas](docs/images/verification.jpg) | ![Consulta administrativa dos registros de auditoria](docs/images/audit.jpg) |

[Ver o modal em celular](docs/images/mobile.jpg). As capturas utilizam banco temporário e dados fictícios. A captura de login registra a versão anterior às orientações de acesso por ambiente.

</details>

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, JavaScript, Vite 7, React Router, Axios e CSS |
| API | Node.js, Express 5 e TypeScript em modo estrito |
| Persistência e acesso | MongoDB, Mongoose, JWT, bcrypt e Helmet |
| Qualidade | Runner de testes do Node.js, MongoDB temporário e GitHub Actions |
| Integrações preservadas | Nodemailer/SMTP, MJML e Vonage Messages API |

## Arquitetura e decisões técnicas

```mermaid
flowchart LR
  A[Frontend React] -->|HTTP + Bearer JWT| B[API Express]
  B --> C[Autenticação e autorização]
  C --> D[Controllers e serviço de tokens]
  D --> E[(MongoDB)]
  D --> F[Auditoria sanitizada]
  F --> E
```

As rotas verificam sessão, perfil e limites de requisições. Controllers validam os contratos HTTP, o serviço de tokens trata colisões e os modelos definem estrutura e índices. O frontend compartilha formulários, tabelas e diálogos, com painéis carregados sob demanda.

- **Códigos e armazenamento:** seis caracteres, pelo menos um número e geração com `crypto.randomInt`. Somente o SHA-256 é persistido. O código aparece no resultado autorizado, sem ser salvo em URL ou localStorage. Colisões são tratadas com índice único e até cinco tentativas.
- **Retirada única:** `findOneAndUpdate` condiciona o consumo ao hash, ao estado não utilizado e à validade futura. Entre retiradas concorrentes com o mesmo código, apenas uma vence.
- **Expiração:** validade de 30 dias verificada na operação; o índice TTL remove registros vencidos de forma assíncrona. A unicidade cobre os registros ainda retidos.
- **Autenticação e autorização:** JWT, senhas com bcrypt e permissões verificadas no backend. A existência e o perfil atual do usuário são revalidados. Contas compartilhadas de demonstração possuem restrições próprias.
- **Auditoria:** registros sanitizados na escrita e na leitura. A gravação é best effort: uma falha secundária não transforma uma retirada efetivada em falso erro, mas pode deixar o histórico incompleto.
- **Proteções HTTP e validação:** limites por IP e conta demonstrativa, CORS explícito, Helmet, JSON limitado e validação de cadastros. CPF/CNPJ são verificados por tipo e formato, sem consulta oficial ou dígitos verificadores.

Os limites conhecidos — incluindo JWT em localStorage, cotas por processo, auditoria não transacional e demonstração compartilhada — estão em [Integridade e segurança](docs/INTEGRIDADE.md).

## Demonstração e acessos

[Visualizar a interface hospedada](https://tokens-theta-dun.vercel.app/).

**O fluxo completo ainda depende da atualização do backend hospedado.** A versão corrigida foi validada localmente; não trate o link como demonstração ponta a ponta aprovada. A execução local abaixo é a alternativa para experimentar o fluxo. [Estado das verificações e publicação](docs/PUBLICACAO.md).

As contas são públicas intencionalmente. Use apenas informações fictícias; não reutilize essas senhas em contas reais.

| Perfil | Ambiente hospedado | Seed local |
| --- | --- | --- |
| Administrador | admin@admin.com | admin@demo.local |
| Vendedor | vendedor@vendedor.com | vendedor@demo.local |
| Verificador | verificador@verificador.com | verificador@demo.local |
| Senha compartilhada | `123$qwer` | `DemoTokens!2026` |

As contas hospedadas dependem da disponibilidade da API. As contas locais são criadas pelo seed; não substituem as hospedadas. Previews da Vercel também precisam de uma API compatível.

Para experimentar a versão corrigida: entre como vendedor, escolha uma empresa fictícia, gere um token para uma NF de nove dígitos (ex.: `000000101`) e copie o código. Saia, entre como verificador e confirme a retirada. Repita a verificação para conferir a recusa de reutilização; consulte a auditoria como administrador.

## Executar localmente

Requisitos: Node.js 24.15+ na linha 24 ou 22.22.2+ na linha 22, npm e MongoDB local e isolado. O CI cobre Node 22 e 24. Não utilize banco empresarial nos exemplos ou no seed.

```powershell
npm run setup
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Se os arquivos `.env` já existirem, preserve-os. Configure no backend `MONGO_URI=mongodb://127.0.0.1:27017/portal_tokens_demo` e `JWT_SECRET` com o valor aleatório gerado (mínimo 32 caracteres). No frontend, use `VITE_API_URL=/api` e `VITE_DEMO_ACCOUNTS=local`. Não são necessárias credenciais SMTP/Vonage.

```powershell
npm --prefix backend run seed
npm start
```

O seed aceita banco vazio ou com marcador conhecido e nome terminado em `_demo`. É idempotente: não apaga dados nem redefine senhas existentes. Frontend em `http://localhost:5173`, API em `http://localhost:3003/api` e health check em `/api/health`.

`VITE_DEMO_ACCOUNTS` é uma configuração pública de apresentação: `local` mostra as contas do seed; `public`, as contas hospedadas com aviso de disponibilidade. Ausente ou desconhecida, não mostra credenciais. Não altera autenticação. Para previews sem API compatível, deixe-a vazia. Alterações de build hospedado dependem de autorização; nenhuma variável externa foi alterada nesta etapa.

Para bancos existentes, consulte o [diagnóstico somente leitura e cuidados com índices](docs/INTEGRIDADE.md) antes de iniciar o servidor. A inicialização pode criar índices; não é um diagnóstico remoto seguro.

## Testes e CI

```powershell
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix backend audit
npm --prefix frontend audit
```

O teste backend inclui a compilação TypeScript. Os testes de integração HTTP usam MongoDB temporário e cobrem autenticação, autorização, proteção das contas demo, colisões, consumo concorrente, expiração, validação e auditoria. SMTP/Vonage usam mocks ou transporte MIME local, sem envio real. A primeira execução pode baixar o binário MongoDB do fornecedor.

Os testes frontend verificam utilitários de sessão, cópia, telefone, entrega na tela e orientações de acesso por ambiente. Não substituem validação visual e de interação no navegador.

O [workflow de qualidade](.github/workflows/ci.yml) executa testes, builds e auditorias de dependências de produção em Node 22 e 24. O resultado do commit deve ser conferido no [PR #1](https://github.com/guilhermehgl/tokens/pull/1) ou no [GitHub Actions](https://github.com/guilhermehgl/tokens/actions). O workflow não contém deploy; as integrações das hospedagens possuem automações próprias.

## Integrações implementadas

Nodemailer/SMTP e templates MJML implementam e-mail; Vonage Messages API implementa WhatsApp com autenticação JWT RS256, validações e tratamento de respostas e erros.

Essas implementações estão preservadas para referência técnica, **desconectadas da geração na versão corrigida**. O token é exibido na tela e as opções de envio permanecem desabilitadas. Informar `email` ou `whatsapp` na requisição não ativa os provedores. Os testes não comprovam entrega real; o backend antigo hospedado ainda precisa ser atualizado antes de afirmar esse comportamento publicamente.

[Detalhes das integrações e histórico dos testes](backend/WHATSAPP.md).

## Documentação adicional

| Documento | Conteúdo |
| --- | --- |
| [API](docs/API.md) | Contratos, respostas e exemplos dos principais endpoints |
| [Integridade](docs/INTEGRIDADE.md) | Índices, concorrência, segurança e limitações |
| [Deploy](docs/DEPLOY.md) | Publicação, backup, rollback e integração segura à master |
| [Publicação](docs/PUBLICACAO.md) | Evidências datadas e limites da validação hospedada |
| [Frontend](frontend/README.md) | Desenvolvimento e configuração pública da interface |

## Autor e reutilização

[Guilherme Lima](https://github.com/guilhermehgl) — informações e contato profissional no perfil GitHub.

O autor confirmou autorização para publicar e reutilizar o código. A licença a conceder a terceiros ainda não foi definida; nenhuma licença permissiva foi adicionada. A licença OFL das fontes permanece preservada, assim como o histórico e os assets da identidade original.
