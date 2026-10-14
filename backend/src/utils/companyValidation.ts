import { validEmail, validName } from "./validation";
import { isValidE164 } from "./phone";
export function companyInput(body: Record<string, unknown>, partial = false) {
  const data: Record<string, string> = {};
  for (const field of [
    "razaoSocial",
    "documento",
    "tipoDocumento",
    "emailReferencia",
    "telefone",
  ]) {
    const value = body[field];
    if (partial && value === undefined) continue;
    if (typeof value !== "string") throw new Error("Campo inválido.");
    data[field] = value.trim();
  }
  if ("razaoSocial" in data && !validName(data.razaoSocial))
    throw new Error("Informe uma razão social válida.");
  if ("emailReferencia" in data) {
    if (!validEmail(data.emailReferencia))
      throw new Error("Informe um e-mail válido.");
    data.emailReferencia = data.emailReferencia.toLowerCase();
  }
  if ("telefone" in data && !isValidE164(data.telefone))
    throw new Error("Informe um telefone válido com o código do país.");
  if ("tipoDocumento" in data && !["CPF", "CNPJ"].includes(data.tipoDocumento))
    throw new Error("Tipo de documento inválido.");
  if ("documento" in data) {
    if (!/^[\d.\s/-]+$/.test(data.documento))
      throw new Error("Documento inválido.");
    data.documento = data.documento.replace(/\D/g, "");
    if (!/^\d{11}$|^\d{14}$/.test(data.documento))
      throw new Error("Informe CPF com 11 ou CNPJ com 14 dígitos.");
  }
  if (
    data.documento &&
    data.tipoDocumento &&
    data.documento.length !== (data.tipoDocumento === "CPF" ? 11 : 14)
  )
    throw new Error("Documento incompatível com o tipo.");
  return data;
}
