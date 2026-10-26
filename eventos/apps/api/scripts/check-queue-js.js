const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function check() {
  const stats = await prisma.message_queue.groupBy({
    by: ['status'],
    where: { event_id: 2 },
    _count: { status: true }
  });
  console.log('Queue Stats Event 2:', stats);
  
  const failed = await prisma.message_queue.findMany({
    where: { event_id: 2, status: 'FAILED' },
    take: 5
  });
  if (failed.length > 0) {
    console.log('Sample failed messages:', failed);
  }
}

check().then(() => prisma.$disconnect());
