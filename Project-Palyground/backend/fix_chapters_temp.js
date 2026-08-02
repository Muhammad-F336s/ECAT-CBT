import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/db.js';

async function fix() {
  await prisma.chapter.updateMany({
    where: { name: 'AI_Generated_Mathematics' },
    data: { name: 'Mathematics' }
  });
  console.log('Fixed chapters.');
}

fix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
