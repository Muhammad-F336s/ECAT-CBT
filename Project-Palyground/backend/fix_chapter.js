
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  await prisma.chapter.updateMany({
    where: { name: 'AI_Generated_Mathematics' },
    data: { name: 'Mathematics' }
  });
  console.log('Fixed chapters.');
}

fix()
  .catch(console.error)
  .finally(() => prisma.());

