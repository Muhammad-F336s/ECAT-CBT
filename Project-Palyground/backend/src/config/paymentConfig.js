import "dotenv/config";
import prisma from "../db.js";

// Cached config in memory for ultra-fast sync access
let cachedConfig = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Owner-controlled bank transfer and manual payment configuration.
 * Dynamically queries PlatformConfig with fallback to environment variables.
 */
export const getDynamicPaymentConfig = async () => {
  const now = Date.now();
  if (cachedConfig && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const platform = await prisma.platformConfig.findFirst();
    cachedConfig = {
      bankName: platform?.bankName || process.env.PAYMENT_BANK_NAME || "Meezan Bank Limited",
      accountTitle: platform?.accountTitle || process.env.PAYMENT_ACCOUNT_TITLE || "Entrace.pk Education Portal",
      iban: platform?.iban || process.env.PAYMENT_IBAN || "PK42MEZN0001234567890123",
      raastId: platform?.raastId || process.env.PAYMENT_RAAST_ID || "03001234567",
      supportContact: platform?.supportContact || process.env.PAYMENT_SUPPORT_CONTACT || "support@entrace.pk",
      challanExpiryHours: 24,
      currency: "PKR",
    };
    lastFetchedAt = now;
    return cachedConfig;
  } catch (err) {
    console.warn("[PaymentConfig] DB fetch failed, using fallback:", err.message);
    return getPaymentConfig();
  }
};

/**
 * Invalidate in-memory cache when settings are updated
 */
export const invalidatePaymentConfigCache = () => {
  cachedConfig = null;
  lastFetchedAt = 0;
};

/**
 * Synchronous fallback (uses memory cache or env vars).
 */
export const getPaymentConfig = () => {
  if (cachedConfig) return cachedConfig;
  return {
    bankName: process.env.PAYMENT_BANK_NAME || "Meezan Bank Limited",
    accountTitle: process.env.PAYMENT_ACCOUNT_TITLE || "Entrace.pk Education Portal",
    iban: process.env.PAYMENT_IBAN || "PK42MEZN0001234567890123",
    raastId: process.env.PAYMENT_RAAST_ID || "03001234567",
    supportContact: process.env.PAYMENT_SUPPORT_CONTACT || "support@entrace.pk",
    challanExpiryHours: 24,
    currency: "PKR",
  };
};

/**
 * Safe public payment details suitable for authenticated student UI display.
 */
export const getPublicPaymentDetails = async () => {
  const config = await getDynamicPaymentConfig();
  return {
    bankName: config.bankName,
    accountTitle: config.accountTitle,
    iban: config.iban,
    raastId: config.raastId,
    supportContact: config.supportContact,
    currency: config.currency,
    challanExpiryHours: config.challanExpiryHours,
    instructions: [
      "Transfer the exact amount to the stated IBAN or Raast ID.",
      "Use your unique Challan Reference ID as the payment reference/remarks.",
      "Take a clear screenshot or save the bank transfer receipt PDF.",
      "Log in and click 'I Have Paid' on the Packages page to submit your receipt.",
      "Your package will be verified and activated by our team.",
    ],
  };
};
