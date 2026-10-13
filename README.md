# Sistema de Tokens

## Requisito de execução

Use Node.js 24.15 ou superior na linha 24 (ou 22.22.2+ na linha 22).
As dependências atuais de e-mail exigem esse mínimo. Confira com `node --version`
antes de instalar no servidor. Após atualizar o projeto, reinstale as dependências
com `npm ci` na raiz, em `backend` e em `frontend`.

O backend usa `tsx watch` em desenvolvimento, incluindo reinício ao alterar `.env`.
O build `tsc` continua responsável pela checagem de tipos. Não use o servidor de
desenvolvimento em produção.

## Iniciar frontend e backend juntos

Na raiz do projeto, execute:

```powershell
npm start
```

O comando inicia a API e o frontend em desenvolvimento no mesmo terminal.
Os logs aparecem identificados como `BACKEND` e `FRONTEND`.
Pressione `Ctrl+C` para encerrar os dois processos. Se um processo terminar,
o outro será encerrado também.

- Frontend: http://localhost:5173
- Backend: http://localhost:3003/api

Configure a conexão do banco e demais credenciais no `backend/.env` antes de
iniciar. O frontend usa o proxy `/api` definido para desenvolvimento.
O backend pode aguardar a conexão com o MongoDB antes de abrir a porta.

Em uma instalação nova, prepare todas as dependências primeiro:

```powershell
npm run setup
```

Encerre instâncias anteriores do frontend e backend antes de usar `npm start`,
para evitar conflitos nas portas. Este comando é para desenvolvimento;
os serviços continuam sendo publicados separadamente em produção.
