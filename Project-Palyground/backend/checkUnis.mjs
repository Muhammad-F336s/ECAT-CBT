import prisma from "./src/db.js";

const unis = await prisma.university.findMany({ include: { tests: true } });
console.log("Total universities in DB:", unis.length);
unis.forEach(u => console.log(`  ✅ ${u.name} | logo: ${u.logoUrl} | tests: ${u.tests.length}`));
await prisma.$disconnect();
