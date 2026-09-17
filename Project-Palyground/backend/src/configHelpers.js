import prisma from "./db.js";

// Default fallback values — used if DB row doesn't exist or query fails.
// These mirror the Prisma schema defaults so the app still runs even before
// the first PlatformConfig row is created.
const FALLBACK_CONFIG = {
  defaultTimePerQ: 60,
  negativeMarking: false,
  maintenanceMode: false,
  vectorBotEnabled: true,
  supportEmail: "support@ecat-cbt.com",
  defaultTestSize: 40,
  maxPracticeQuestions: 100,
  defaultPackage: "STARTER",
  registrationMode: "Open",
  emailVerificationRequired: false,
  autoApproveStudents: true,
  freezeThreshold: 3,
};

/**
 * Load the single PlatformConfig row. If it doesn't exist yet, seed it.
 * Falls back to hardcoded defaults on any DB error so the app never crashes
 * just because settings couldn't be fetched.
 */
export async function getConfig() {
  try {
    let config = await prisma.platformConfig.findFirst();
    if (!config) {
      config = await prisma.platformConfig.create({ data: FALLBACK_CONFIG });
    }
    return config;
  } catch (error) {
    console.error("[getConfig] Failed to load PlatformConfig, using defaults:", error.message);
    return { ...FALLBACK_CONFIG, id: 1 };
  }
}
