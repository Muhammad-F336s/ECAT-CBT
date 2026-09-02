import crypto from "crypto";
import prisma from "../db.js";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const getEncryptionKey = () => {
  if (!process.env.AI_CONFIG_ENCRYPTION_KEY) return null;
  return crypto.createHash("sha256").update(process.env.AI_CONFIG_ENCRYPTION_KEY).digest();
};

export const encryptAiApiKey = (apiKey) => {
  const key = getEncryptionKey();
  if (!key) throw new Error("AI_CONFIG_ENCRYPTION_KEY is not configured.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
};

const decryptAiApiKey = (encryptedValue) => {
  const key = getEncryptionKey();
  if (!key || !encryptedValue) return null;
  const packed = Buffer.from(encryptedValue, "base64");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

export const getAiRuntimeConfig = async () => {
  const environmentKey = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].find(Boolean) || null;
  // Deployments that have not run the new Prisma migration/client generation
  // must continue using the pre-existing environment key instead of breaking
  // every test generation request.
  if (!prisma.aiProviderConfig) {
    console.warn("[AI Config] Prisma client is not generated for AiProviderConfig; using environment configuration.");
    return { model: DEFAULT_GROQ_MODEL, apiKey: environmentKey };
  }
  let config = null;
  try {
    config = await prisma.aiProviderConfig.findUnique({ where: { id: 1 } });
  } catch (error) {
    // The application must remain operational while a deployment awaits its
    // database migration. The admin panel will become available after deploy.
    console.warn("[AI Config] Configuration table is unavailable; using environment configuration.");
    return { model: DEFAULT_GROQ_MODEL, apiKey: environmentKey };
  }
  const storedKey = config?.apiKeyCiphertext ? decryptAiApiKey(config.apiKeyCiphertext) : null;
  return {
    model: config?.model || DEFAULT_GROQ_MODEL,
    apiKey: storedKey || environmentKey,
  };
};

export const getAiConfigSummary = async () => {
  const config = await prisma.aiProviderConfig.findUnique({ where: { id: 1 } });
  const environmentKey = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2].find(Boolean);
  return {
    provider: "groq",
    model: config?.model || DEFAULT_GROQ_MODEL,
    keyConfigured: Boolean(config?.apiKeyCiphertext || environmentKey),
    keyLastFour: config?.apiKeyLastFour || (environmentKey ? `••••${environmentKey.slice(-4)}` : null),
    keySource: config?.apiKeyCiphertext ? "secure vault" : environmentKey ? "environment" : "not configured",
    updatedByEmail: config?.updatedByEmail || null,
    updatedAt: config?.updatedAt || null,
  };
};
