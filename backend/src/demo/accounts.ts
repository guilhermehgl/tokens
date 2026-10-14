// Credenciais intencionalmente públicas. Nunca utilizadas em produção.
export const demoAccounts = [
  { nome: "Administrador Demo", email: "admin@demo.local", role: "admin" as const },
  { nome: "Vendedor Demo", email: "vendedor@demo.local", role: "vendedor" as const },
  { nome: "Verificador Demo", email: "verificador@demo.local", role: "verificador" as const },
];
export const demoPassword = "DemoTokens!2026";
export const isDemoIdentity = (user: { email?: string; isDemo?: boolean }) => Boolean(user.isDemo || user.email?.toLowerCase().endsWith("@demo.local"));
