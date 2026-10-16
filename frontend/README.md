# Frontend do Portal de Tokens

React, Vite, React Router e Axios. Os painéis compartilham componentes acessíveis de formulário, tabela e diálogo. As rotas carregam os painéis sob demanda. `src/api/client.js` centraliza timeout e respostas 401; `AuthContext` restaura a sessão pelo backend e acompanha a expiração do JWT.

```powershell
npm ci
npm test
npm run build
npm run dev
```

Configure `VITE_API_URL=/api` no desenvolvimento. O proxy aponta para `http://127.0.0.1:3003`; `API_PROXY_TARGET` permite outro backend local. Em hospedagens separadas, informe a URL pública da API e configure CORS nela. O preview local usa a porta 4173 e o mesmo proxy, sem conflitar com a API.

`VITE_DEMO_ACCOUNTS` controla somente as instruções do login. Use `local` para contas `@demo.local` criadas pelo seed ou `public` para as contas hospedadas documentadas no README. Sem valor ou com valor desconhecido, nenhuma credencial é sugerida. A configuração é pública e incorporada pelo Vite; não muda a API, o login real ou as permissões. `.env.example` contém `local` para a instalação local.

Em previews sem API compatível, deixe o valor vazio. Com `public`, a interface apresenta os acessos da demonstração e explica que previews não têm funcionamento garantido; o endereço oficial usa o backend compatível publicado. Não deduzimos o ambiente pelo hostname ou pelo modo de produção do Vite. Nenhuma variável externa precisa ser alterada para publicar o código com o comportamento seguro sem configuração.

Consulte [README principal](../README.md), [integridade e operação](../docs/INTEGRIDADE.md) e [estado da publicação](../docs/PUBLICACAO.md). O build não comprova disponibilidade da API publicada.
