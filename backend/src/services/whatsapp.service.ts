import { readFileSync } from "fs";
import { resolve } from "path";
import { createPrivateKey, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { isValidE164 } from "../utils/phone";

type FailureReason = "missing_phone" | "invalid_phone" | "configuration" | "sandbox_not_allowed" | "window_closed" | "rate_limit" | "unavailable" | "rejected";

export class WhatsappDeliveryError extends Error {
  constructor(public readonly reason: FailureReason, message: string, public readonly status = 502, public readonly providerStatus?: number) {
    super(message);
    this.name = "WhatsappDeliveryError";
  }
}

export function normalizeWhatsappPhone(phone: unknown): string {
  if (phone === undefined || phone === null || phone === "") {
    throw new WhatsappDeliveryError("missing_phone", "Esta empresa não possui telefone cadastrado para envio via WhatsApp.", 400);
  }
  if (!isValidE164(phone)) {
    throw new WhatsappDeliveryError("invalid_phone", "O telefone cadastrado nesta empresa é inválido para envio via WhatsApp.", 400);
  }
  // Apenas o payload Vonage perde o +; o registro da empresa não é alterado.
  return phone.slice(1);
}

export function validateWhatsappConfiguration() {
  try {
    const applicationId = process.env.VONAGE_APPLICATION_ID;
    const keyPath = process.env.VONAGE_PRIVATE_KEY_PATH;
    const apiUrl = process.env.VONAGE_MESSAGES_API_URL;
    const from = process.env.VONAGE_WHATSAPP_FROM?.replace(/^\+/, "");
    if (!applicationId || !keyPath || !apiUrl || !from || !/^[1-9]\d{7,14}$/.test(from)) throw new Error();
    const endpoint = new URL(apiUrl);
    // Não permite enviar JWT/telefone para endpoints arbitrários ou redirecionamentos.
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash ||
        !["messages-sandbox.nexmo.com", "api.nexmo.com"].includes(endpoint.hostname) || endpoint.pathname !== "/v1/messages") throw new Error();
    const key = createPrivateKey(readFileSync(resolve(keyPath)));
    if (key.asymmetricKeyType !== "rsa") throw new Error();
    const sandbox = endpoint.hostname === "messages-sandbox.nexmo.com";
    const imageUrl = process.env.WHATSAPP_TOKEN_IMAGE_URL?.trim();
    if (imageUrl) {
      const media = new URL(imageUrl);
      // Mídia precisa de HTTPS público; nunca aceitar caminhos locais ou credenciais.
      if (media.protocol !== "https:" || media.username || media.password || media.port || media.hash ||
          media.hostname === "localhost" || media.hostname.endsWith(".localhost") || media.hostname.endsWith(".local") ||
          !media.hostname.includes(".") || /^[\d.]+$/.test(media.hostname) || media.hostname.includes(":")) throw new Error();
    }
    const recipientOverrides = sandbox ? parseSandboxRecipientOverrides(process.env.VONAGE_SANDBOX_RECIPIENT_OVERRIDES) : {};
    return { applicationId, key, apiUrl, from, sandbox, recipientOverrides, imageUrl };
  } catch {
    throw new WhatsappDeliveryError("configuration", "O envio por WhatsApp não está configurado corretamente. Contate o administrador.", 503);
  }
}

export function parseSandboxRecipientOverrides(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const entries: unknown = JSON.parse(raw);
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error();
    const result: Record<string, string> = Object.create(null);
    for (const [source, target] of Object.entries(entries)) {
      // O destino é o identificador literal autorizado no Sandbox, não um telefone nacional reinterpretado.
      if (!/^[1-9]\d{7,14}$/.test(source) || !isValidE164(`+${source}`) ||
          typeof target !== "string" || !/^[1-9]\d{7,14}$/.test(target)) throw new Error();
      result[source] = target;
    }
    return result;
  } catch {
    throw new WhatsappDeliveryError("configuration", "O mapeamento de destinatários do Sandbox está inválido. Contate o administrador.", 503);
  }
}

// Utiliza somente sinais da resposta para classificar; nunca repassa corpo/stack/credenciais.
export function classifyWhatsappFailure(status: number, body: unknown, sandbox: boolean): WhatsappDeliveryError {
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const hint = [data.title, data.detail, data.type].filter(value => typeof value === "string").join(" ").toLowerCase();
  const code = String(data.code ?? (data.error && typeof data.error === "object" ? (data.error as Record<string, unknown>).code : ""));
  if (status === 401 || status === 403 && !/allow.?list|whitelist/.test(hint)) {
    return new WhatsappDeliveryError("configuration", "O envio por WhatsApp não está configurado corretamente. Contate o administrador.", 503, status);
  }
  if (sandbox && /allow.?list|whitelist|not.?authori[sz]ed.*recipient/.test(hint)) {
    return new WhatsappDeliveryError("sandbox_not_allowed", "O destinatário não está autorizado no Sandbox do WhatsApp. Conecte este número no painel da Vonage.", 400, status);
  }
  if (code === "1340" || /24.?hour|24.?hora|window|re.?engagement|#1340/.test(hint)) {
    return new WhatsappDeliveryError("window_closed", "A janela de comunicação do WhatsApp está fechada. O destinatário precisa enviar uma nova mensagem ao número de teste.", 400, status);
  }
  if (status === 429) return new WhatsappDeliveryError("rate_limit", "O limite de envio do WhatsApp foi atingido. Aguarde antes de tentar novamente.", 503, status);
  if (status >= 500) return new WhatsappDeliveryError("unavailable", "O serviço de WhatsApp está indisponível no momento. Tente novamente mais tarde.", 503, status);
  return new WhatsappDeliveryError("rejected", "Não foi possível enviar o token pelo WhatsApp.", 502, status);
}

export function whatsappTokenMessage(companyName: string, nfNumber: string, token: string): string {
  return `Olá!\n\nO pedido da empresa ${companyName} foi faturado.\n\nNF: ${nfNumber}\n\nToken para retirada:\n*${token}*\n\nEste token é válido por 30 dias a partir da geração.\n\nElmaz Caminhões e Ônibus`;
}

export async function sendWhatsappText(phone: unknown, text: string): Promise<{ messageId: string; status: "accepted" }> {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const config = validateWhatsappConfiguration();
  if (config.imageUrl && text.length > 1024) {
    throw new WhatsappDeliveryError("configuration", "O texto excede o limite da legenda da imagem do WhatsApp.", 400);
  }
  const to = config.sandbox ? config.recipientOverrides[normalizedPhone] ?? normalizedPhone : normalizedPhone;
  const authorization = jwt.sign({ application_id: config.applicationId, jti: randomUUID() }, config.key, { algorithm: "RS256", expiresIn: 300 });
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${authorization}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ from: config.from, to, channel: "whatsapp", ...(config.imageUrl
        ? { message_type: "image", image: { url: config.imageUrl, caption: text } }
        : { message_type: "text", text }) }),
    });
    const data = await response.json().catch(() => ({})) as { message_uuid?: unknown };
    if (!response.ok) throw classifyWhatsappFailure(response.status, data, config.sandbox);
    if (typeof data.message_uuid !== "string" || !/^[0-9a-f-]{36}$/i.test(data.message_uuid)) {
      throw new WhatsappDeliveryError("unavailable", "Não foi possível confirmar o envio pelo WhatsApp. Verifique o status antes de gerar outro token.", 503);
    }
    return { messageId: data.message_uuid, status: "accepted" };
  } catch (error) {
    if (error instanceof WhatsappDeliveryError) throw error;
    // Não imprime o erro de fetch: ele pode conter headers e o texto da mensagem.
    throw new WhatsappDeliveryError("unavailable", "Não foi possível confirmar o envio pelo WhatsApp. Verifique o status antes de gerar outro token.", 503);
  }
}
