# Estado da versão pública

O portal possui um único fluxo de login e inicialização (npm start na raiz). As contas públicas estão no README e são preparadas por um seed manual idempotente. Não há APP_MODE, endpoint de configuração pública ou acesso por atalhos.

A geração sempre retorna o token na tela; e-mail e WhatsApp permanecem visíveis e desabilitados. O backend não chama os provedores, independentemente do canal solicitado. Os serviços e o template de mensagens foram preservados para referência e futura reutilização explícita.

Identidade empresarial removida dos arquivos atuais. O histórico Git antigo não foi reescrito; revise-o antes de publicar ou use um novo repositório com apenas a árvore revisada. Não publique .env, chaves, dumps ou dependências.

O banco é configurado por MONGO_URI. O seed recusa dados preexistentes sem o marcador de preparação e não apaga dados. Nada nesta alteração modifica bancos remotos ou constitui deploy.

Os testes verificam login normal, autorização, geração sem mensagens, armazenamento somente do hash, validade, consumo atômico e proteção das contas públicas. Integrações de mensagens são testadas com mocks, sem entrega real.
