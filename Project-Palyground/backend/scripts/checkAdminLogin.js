import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'muhammad.f336s@gmail.com';
  const password = 'ICONEX335';
  const secret = 'INSHALLAH';
  const normalizedSecret = secret.trim().toUpperCase();

  const admin = await prisma.admin.findUnique({ where: { email } });
  const passwordOk = admin ? await bcrypt.compare(password, admin.password) : false;
  const secretOk = admin ? await bcrypt.compare(normalizedSecret, admin.secretHash) : false;
  console.log(JSON.stringify({ found: !!admin, email: admin?.email, name: admin?.name, passwordOk, secretOk, passwordHash: admin?.password, secretHash: admin?.secretHash }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
