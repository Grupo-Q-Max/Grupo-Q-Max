import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL não configurada.');
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

const config = getDatabaseConfig();
const adapter = new PrismaMariaDb({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  connectionLimit: 10,
});
const prisma = new PrismaClient({ adapter });

async function clean() {
  console.log('Buscando duplicatas no banco...');
  const queue = await prisma.message_queue.findMany({
    where: { event_id: 2 },
    orderBy: { created_at: 'asc' }
  });

  const seen = new Set();
  let deletedCount = 0;

  for (const msg of queue) {
    if (seen.has(msg.phone) && msg.status === 'PENDING') {
      await prisma.message_queue.delete({ where: { id: msg.id } });
      deletedCount++;
      console.log('Deletada msg PENDENTE duplicada ID:', msg.id, 'Phone:', msg.phone);
    } else {
      seen.add(msg.phone);
    }
  }

  console.log('Total de duplicatas deletadas da fila PENDING:', deletedCount);
}

clean().finally(() => prisma.$disconnect());
