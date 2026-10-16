// Credenciais intencionalmente públicas. Nunca utilizadas em produção.
export const demoAccounts = [
  { nome: "Administrador Demo", email: "admin@demo.local", role: "admin" as const },
  { nome: "Vendedor Demo", email: "vendedor@demo.local", role: "vendedor" as const },
  { nome: "Verificador Demo", email: "verificador@demo.local", role: "verificador" as const },
];
export const demoPassword = "DemoTokens!2026";
// Contas públicas já existentes na hospedagem, além das contas do seed local.
export const publishedDemoEmails = ["admin@admin.com", "vendedor@vendedor.com", "verificador@verificador.com"];
export const isProtectedDemoAccount = (user: { email?: string }) => {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && (publishedDemoEmails.includes(email) || demoAccounts.some(account => account.email === email)));
};
export const isDemoIdentity = (user: { email?: string; isDemo?: boolean }) => {
  const email = user.email?.trim().toLowerCase();
  return Boolean(user.isDemo || email?.endsWith("@demo.local") || (email && publishedDemoEmails.includes(email)));
};
export const demoCompanyDocuments = ["00000000000001", "00000000000002", "00000000000003", "01010101010101", "02020202020202", "03030303030", "04040404040404"];
export const isDemoCompany = (company: { documento: string }) => demoCompanyDocuments.includes(company.documento);
