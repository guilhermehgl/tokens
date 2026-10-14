# Frontend do Portal de Tokens

React, Vite, React Router e Axios. Os painéis compartilham componentes acessíveis de formulário, tabela e diálogo. As rotas carregam os painéis sob demanda. `src/api/client.js` centraliza timeout e respostas 401; `AuthContext` restaura a sessão pelo backend e acompanha a expiração do JWT.

```powershell
npm ci
npm test
npm run build
npm run dev
```

Configure `VITE_API_URL=/api` no desenvolvimento. O proxy aponta para `http://127.0.0.1:3003`; `API_PROXY_TARGET` permite outro backend local. Em hospedagens separadas, informe a URL pública da API e configure CORS nela. O preview local usa a porta 4173 e o mesmo proxy, sem conflitar com a API.

Consulte [README principal](../README.md), [integridade e operação](../docs/INTEGRIDADE.md) e [estado da publicação](../docs/PUBLICACAO.md). O build não comprova disponibilidade da API publicada.
