export function databaseUri(): string {
  if (!process.env.MONGO_URI) throw new Error("Configure MONGO_URI.");
  return process.env.MONGO_URI;
}

export function assertRuntime() {
  databaseUri();
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres.");
}
