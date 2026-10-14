# Estado da publicação — 14/10/2026

Esta página separa execução local, evidências históricas e inspeção atual somente leitura. Nenhum merge, deploy manual, mudança de variável externa, migração ou alteração do banco remoto foi realizado nesta etapa.

| Item | Evidência atual | Conclusão |
| --- | --- | --- |
| Frontend | `https://tokens-theta-dun.vercel.app/` responde 200; Vercel indica `master`, commit `eec58ac` | CONFIRMADA a disponibilidade da interface |
| API efetiva | Bundle público `index-qwnw2PeN.js` contém `https://tokens-xfrp.onrender.com/api` | CONFIRMADO o destino compilado de `VITE_API_URL` |
| Proxy | URL absoluta no bundle; `frontend/vercel.json` faz apenas fallback SPA | API chamada diretamente no Render |
| Backend | Render `tokens`, serviço `srv-db76ku49v7es73al9l6g`, branch `master` | Último sucesso `96548feed2adc1a30af2eca625cab16e3dc851e3` |
| Atualização recusada | Deploy `dep-db7o6gui0phs739bultg`, fonte `eec58ac`, build concluído, processo encerrado com status 1 | Log: `JWT_SECRET deve ter pelo menos 32 caracteres.` |
| Disponibilidade API | GET `/api/health` respondeu 502, inclusive sem Origin e com Origin correto | NÃO FOI POSSÍVEL VERIFICAR os fluxos públicos nesta revisão; 502 não comprova falha de CORS |
| CORS | Logs do deploy recusado incluem theta e a origem antiga | Configuração registrada; comportamento hospedado da versão nova ainda não validado |
| Banco remoto | `MONGO_URI` existe no painel, mantida mascarada | Nome, isolamento, duplicidades, formatos e índices NÃO VERIFICADOS |

O endereço antigo `tokens-mu.vercel.app` respondeu 404 e não é recomendado como acesso.

## Causa e limites

O código público do backend `96548fe` exige `deliveryChannel=email|whatsapp`; o frontend solicita `screen`. Essa combinação explica a mensagem “Escolha um canal de envio válido: e-mail ou WhatsApp.” observada na etapa anterior. O novo backend compilou, porém recusou o segredo JWT curto na inicialização. Não reduzir a validação para contornar o problema.

A branch corrigida já gera exclusivamente na tela, sem invocar `deliverToken`; não há rota alternativa que habilite SMTP/Vonage. Isso está validado localmente. **Não significa que o backend antigo hospedado tenha envio externo desativado.** Não forçar canais externos remotamente.

Login dos três perfis e consultas administrativas foram confirmados na etapa anterior. Nesta revisão não foram repetidos com a API em 502. As credenciais públicas foram preservadas; nenhum seed remoto, alteração de senha, exclusão ou mutação administrativa foi executado. A validação pública completa aguarda deploy especificamente autorizado.

## GitHub e automação

O [PR existente](https://github.com/guilhermehgl/tokens/pull/1) permanece aberto. O CI de `42083d7` passou em Node 22 e 24 ([execução](https://github.com/guilhermehgl/tokens/actions/runs/38621039452)). Esse resultado não certifica commits locais posteriores.

O workflow de qualidade não contém deploy, mas **a integração Vercel cria previews ao atualizar a branch/PR**; isso ocorreu na etapa anterior. Portanto, ausência de comando manual não significa ausência de deploy automático. Render também registra Auto-Deploy para `master`.

Nesta etapa os novos commits são preparados localmente, sem push, até autorização para o preview automático. Homepage permanece sem anunciar o fluxo completo. [Plano de publicação, banco e rollback](DEPLOY.md).
