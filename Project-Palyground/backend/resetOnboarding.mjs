import prisma from "./src/db.js";

// Reset all users' onboarding so they see the new screen on next login
const result = await prisma.user.updateMany({
  data: { hasCompletedOnboarding: false }
});
console.log(`✅ Reset onboarding for ${result.count} users`);
await prisma.$disconnect();
