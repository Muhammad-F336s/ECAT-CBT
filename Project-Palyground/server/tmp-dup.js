import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const email = 'collision-duplicate@example.com';
const passwordHash = await bcrypt.hash('AdminPass123!', 10);
const secretHash = await bcrypt.hash('SECRET123', 10);
await prisma.admin.upsert({
  where: { email },
  update: {},
  create: { name: 'Temp Admin', email, password: passwordHash, secretHash },
});
console.log('seeded:' + email);
await prisma.();
