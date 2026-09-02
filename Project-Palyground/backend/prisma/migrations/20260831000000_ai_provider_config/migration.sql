-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'groq',
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-oss-120b',
    "apiKeyCiphertext" TEXT,
    "apiKeyLastFour" TEXT,
    "updatedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);
