# Estado da publicação — 14/10/2026

- Endereço informado inicialmente: https://tokens-mu.vercel.app — `404 DEPLOYMENT_NOT_FOUND`.
- Endereço correto informado pelo autor: https://tokens-theta-dun.vercel.app — aplicação carrega e login dos três perfis e consultas de usuários, empresas, auditoria e pendências confirmados.
- Contas atuais da hospedagem são diferentes do seed local. As três identidades fornecidas pelo autor foram incluídas nas proteções do código corrigido, sem alterar usuários ou credenciais no banco hospedado.
- A interface publicada mostra envio externo desabilitado. Entretanto, ao gerar na tela, a API responde: “Escolha um canal de envio válido: e-mail ou WhatsApp.” Isso comprova incompatibilidade entre as versões do frontend/backend. A geração pública não foi concluída, e nenhum canal externo foi selecionado.
- O admin publicado oferece ações de criação/exclusão e alteração de senha nas contas públicas. As novas proteções foram implementadas e testadas localmente, sem executar mutações administrativas no ambiente remoto.
- Nenhum deploy, acesso Lightsail, alteração de configuração externa ou migração remota foi realizado. Não há evidência de que o servidor hospedado execute o commit corrigido.
- Não anunciar o fluxo público como integralmente funcional antes de alinhar os deploys e repetir geração, consumo, segundo uso e auditoria. Não usar SMTP/Vonage para contornar o erro.

A versão corrigida usa somente geração na tela. O seed exige banco isolado terminado em `_demo`, vazio ou marcado, e não apaga dados. Não publica mudanças ou restaura infraestrutura. Confira [integridade e operação](INTEGRIDADE.md).

A apresentação do repositório pode usar a descrição: “Sistema Full Stack de geração e validação de tokens de retirada, com autenticação JWT, controle de acesso, auditoria e MongoDB.” Topics pertinentes: `react`, `nodejs`, `typescript`, `express`, `mongodb`, `fullstack`, `jwt`, `authentication`, `rest-api`, `portfolio`. Homepage deve apontar para uma demonstração integralmente validada; a geração pública continua pendente.

Descrição e dez topics atualizados no GitHub. A homepage antiga foi removida, pois estava indisponível; o novo endereço permanece documentado com a limitação de geração, sem ser anunciado como fluxo completo validado.
