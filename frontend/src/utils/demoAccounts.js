// Configuração pública de apresentação; não altera autenticação nem acesso à API.
export function demoAccounts(environment) {
  if (environment === 'local') return {
    label: 'Contas do seed local',
    emails: ['admin@demo.local', 'vendedor@demo.local', 'verificador@demo.local'],
    password: 'DemoTokens!2026',
    guidance: 'Prepare o banco local com o seed. Gere um token como vendedor e valide como verificador. Use somente dados fictícios; a versão corrigida não envia mensagens externas.',
  };
  if (environment === 'public') return {
    label: 'Contas públicas da demonstração hospedada',
    emails: ['admin@admin.com', 'vendedor@vendedor.com', 'verificador@verificador.com'],
    password: '123$qwer',
    guidance: 'A demonstração pública permite gerar e verificar códigos na tela, sem envio de mensagens. Estas contas não garantem acesso em previews; confira se a API conectada é compatível. Use somente dados fictícios.',
  };
  return {
    label: 'Acessos de demonstração',
    emails: [],
    guidance: 'Os acessos não foram definidos para este build. Consulte o README do projeto para distinguir contas locais e hospedadas. A disponibilidade do fluxo depende da API conectada.',
  };
}
