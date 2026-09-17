import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("🚀 Running Block 1 Database Migration via Neon Serverless...");

  // 1. PackageType enum values
  console.log("1. Updating PackageType enum values...");
  try {
    await sql`ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'STARTER'`;
  } catch (e) {
    console.warn("  (Notice on STARTER enum value):", e.message);
  }
  try {
    await sql`ALTER TYPE "PackageType" ADD VALUE IF NOT EXISTS 'BASIC'`;
  } catch (e) {
    console.warn("  (Notice on BASIC enum value):", e.message);
  }

  // 2. User table columns
  console.log("2. Adding package & entitlement columns to User table...");
  await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageStartedAt" TIMESTAMP(3)`;
  await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "packageExpiresAt" TIMESTAMP(3)`;
  await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "remainingTestAttempts" INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "starterClaimedAt" TIMESTAMP(3)`;

  // 3. Package catalog table
  console.log("3. Creating Package table if not exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS "Package" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "description" TEXT,
      "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "validityDays" INTEGER NOT NULL DEFAULT 30,
      "testAttempts" INTEGER NOT NULL DEFAULT 0,
      "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "badgeText" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isRecommended" BOOLEAN NOT NULL DEFAULT false,
      "colorTheme" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "Package_code_key" ON "Package"("code")`;

  // 4. PaymentOrder table
  console.log("4. Creating PaymentOrder table if not exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS "PaymentOrder" (
      "id" TEXT NOT NULL,
      "referenceCode" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "purpose" TEXT NOT NULL,
      "packageCode" TEXT,
      "packageId" TEXT,
      "expectedAmount" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'PKR',
      "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
      "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "transactionId" TEXT,
      "receiptProof" TEXT,
      "submittedAt" TIMESTAMP(3),
      "verifiedAt" TIMESTAMP(3),
      "verifiedByAdminId" TEXT,
      "verifiedByName" TEXT,
      "rejectionReason" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_referenceCode_key" ON "PaymentOrder"("referenceCode")`;
  await sql`CREATE INDEX IF NOT EXISTS "PaymentOrder_userId_idx" ON "PaymentOrder"("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS "PaymentOrder_status_idx" ON "PaymentOrder"("status")`;

  // Add FKs to PaymentOrder if not existing
  try {
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentOrder_userId_fkey') THEN
          ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentOrder_packageId_fkey') THEN
          ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `;
  } catch (e) {
    console.warn("  Notice on PaymentOrder constraints:", e.message);
  }

  // 5. PaymentAudit table
  console.log("5. Creating PaymentAudit table if not exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS "PaymentAudit" (
      "id" TEXT NOT NULL,
      "paymentOrderId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "oldStatus" TEXT,
      "newStatus" TEXT,
      "note" TEXT,
      "adminId" TEXT,
      "adminName" TEXT,
      "metadata" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS "PaymentAudit_paymentOrderId_idx" ON "PaymentAudit"("paymentOrderId")`;

  try {
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAudit_paymentOrderId_fkey') THEN
          ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `;
  } catch (e) {
    console.warn("  Notice on PaymentAudit constraints:", e.message);
  }

  // 6. ProfileChangeRequest link to PaymentOrder
  console.log("6. Linking ProfileChangeRequest to PaymentOrder...");
  await sql`ALTER TABLE "ProfileChangeRequest" ADD COLUMN IF NOT EXISTS "paymentOrderId" TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "ProfileChangeRequest_paymentOrderId_key" ON "ProfileChangeRequest"("paymentOrderId")`;

  try {
    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfileChangeRequest_paymentOrderId_fkey') THEN
          ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `;
  } catch (e) {
    console.warn("  Notice on ProfileChangeRequest FK:", e.message);
  }

  console.log("✅ Neon schema DDL successfully applied!");
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  });
