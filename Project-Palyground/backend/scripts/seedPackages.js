import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in environment variables.");
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

export const DEFAULT_PACKAGES = [
  {
    name: "Starter",
    code: "STARTER",
    description: "Free introductory trial for new students. One-time only per student for their entire account lifetime.",
    price: 0,
    validityDays: 5,
    testAttempts: 2,
    badgeText: "Free Trial",
    displayOrder: 1,
    isActive: true,
    isRecommended: false,
    colorTheme: "#4a5568",
    features: [
      "2 Full ECAT CBT Test Attempts",
      "5 Days Access Validity",
      "Full Multi-Subject CBT Simulator",
      "Advanced Predictive Analytics",
      "Full Resources & Past Papers Access",
      "Vector Bot AI Mentor Access",
      "Content Library Access",
      "Historical Attempt Breakdown & Review",
      "One-time account activation"
    ]
  },
  {
    name: "Basic",
    code: "BASIC",
    description: "Ideal short-term practice package for targeted revision and focused preparation.",
    price: 399,
    validityDays: 15,
    testAttempts: 7,
    badgeText: "Recommended",
    displayOrder: 2,
    isActive: true,
    isRecommended: true,
    colorTheme: "#2d6a4f",
    features: [
      "7 Full ECAT CBT Test Attempts",
      "15 Days Access Validity",
      "Selected Academic Subjects Practice",
      "Standard CBT Mode Simulation",
      "Content Library Access",
      "Basic Analytics & Topic Breakdown"
    ]
  },
  {
    name: "Standard",
    code: "STANDARD",
    description: "Comprehensive monthly package covering complete syllabus tests with detailed insights.",
    price: 899,
    validityDays: 30,
    testAttempts: 20,
    badgeText: "Popular",
    displayOrder: 3,
    isActive: true,
    isRecommended: false,
    colorTheme: "#1b4332",
    features: [
      "20 Full ECAT CBT Test Attempts",
      "30 Days Access Validity",
      "Everything in Basic Package",
      "Full Multi-Subject CBT Simulator",
      "Detailed Analytics & Speed Insights",
      "Historical Attempt Breakdown & Review"
    ]
  },
  {
    name: "Premium",
    code: "PREMIUM",
    description: "Ultimate access with maximum attempts, advanced analytics, past papers, and priority assistance.",
    price: 1599,
    validityDays: 60,
    testAttempts: 40,
    badgeText: "Full Access",
    displayOrder: 4,
    isActive: true,
    isRecommended: false,
    colorTheme: "#081c15",
    features: [
      "40 Full ECAT CBT Test Attempts",
      "60 Days Access Validity",
      "Everything in Standard Package",
      "Advanced Predictive Analytics",
      "Full Resources & Past Papers Access",
      "Vector Bot AI Mentor Access",
      "Priority Support Response"
    ]
  },
  {
    name: "Profile / Program Change",
    code: "PROFILE_CHANGE",
    description: "Official administrative fee for changing academic track (e.g. Pre-Engineering to Computer Science) or subjects.",
    price: 299,
    validityDays: 0,
    testAttempts: 0,
    badgeText: "Administrative",
    displayOrder: 5,
    isActive: true, // Internal purpose, active but excluded from student public practice packages
    isRecommended: false,
    colorTheme: "#744210",
    features: [
      "Administrative Academic Track Re-evaluation",
      "Subject Elective Adjustment",
      "Official Academic Record Update"
    ]
  }
];

async function main() {
  console.log("🌱 Seeding Package Catalog...");

  for (const pkg of DEFAULT_PACKAGES) {
    const existing = await prisma.package.findUnique({
      where: { code: pkg.code },
    });

    if (!existing) {
      await prisma.package.create({
        data: pkg,
      });
      console.log(`  + Created package: ${pkg.name} (${pkg.code}) - PKR ${pkg.price}`);
    } else {
      console.log(`  = Package already exists: ${pkg.name} (${pkg.code})`);
    }
  }

  console.log("\n🛡️ Preserving existing students & backfilling entitlements...");
  const students = await prisma.user.findMany({
    where: { role: "student" },
  });

  let backfilledCount = 0;
  for (const student of students) {
    // If student has no remainingTestAttempts or no packageExpiresAt, give them safe defaults so they are not locked out
    const needsAttempts = (student.remainingTestAttempts === 0 && student.testAttemptsLimit > 0);
    const needsExpiry = !student.packageExpiresAt;

    if (needsAttempts || needsExpiry) {
      const remainingAttempts = student.remainingTestAttempts > 0 
        ? student.remainingTestAttempts 
        : Math.max(student.testAttemptsLimit || 0, 20); // default to at least 20 attempts

      const now = new Date();
      const expiresAt = student.packageExpiresAt || new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 days grace period

      await prisma.user.update({
        where: { id: student.id },
        data: {
          remainingTestAttempts: remainingAttempts,
          packageStartedAt: student.packageStartedAt || now,
          packageExpiresAt: expiresAt,
        },
      });
      backfilledCount++;
    }
  }

  console.log(`  ✓ Backfilled ${backfilledCount}/${students.length} existing students with active attempts & expiry.`);
  console.log("✅ Package seeding & student migration safety complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
