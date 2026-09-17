import prisma from "../src/db.js";
const user = await prisma.user.findFirst({ where: { email: "demo@cbt.com" } });
if (!user) { 
  console.log("demo@cbt.com not found - trying any user with packageExpiresAt set...");
  const all = await prisma.user.findMany({ select: { id: true, email: true, isDemoAccount: true, packageExpiresAt: true } });
  console.log("All users:", JSON.stringify(all, null, 2));
  process.exit(0); 
}
console.log("Found:", user.email, "| isDemoAccount:", user.isDemoAccount, "| expiry:", user.packageExpiresAt);
await prisma.user.update({
  where: { id: user.id },
  data: { packageExpiresAt: null, packageStartedAt: null, packageType: "PREMIUM", testAttemptsLimit: -1, remainingTestAttempts: -1, isDemoAccount: true }
});
console.log("Done - expiry cleared, PREMIUM locked.");
await prisma.$disconnect();
