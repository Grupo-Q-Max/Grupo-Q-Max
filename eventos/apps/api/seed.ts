import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './src/generated/prisma/client';

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
  ssl: { rejectUnauthorized: false },
  connectionLimit: 10,
});
const p = new PrismaClient({ adapter });
async function main() {
  const e = await p.events.findFirst({ where: { slug: 'invictus' } });
  if (e) {
    console.log('Invictus já existe:', e.name, e.slug);
    await p.$disconnect();
    return;
  }
  const created = await p.events.create({
    data: {
      name: 'Finora Experience - Invictus',
      slug: 'invictus',
      status: 'ACTIVE',
      participation_enabled: true,
      accent_color: '#E5484D',
      accent_ink_color: '#B4232A',
      experience: 'ROLETA',
    }
  });
  console.log('Invictus criado com sucesso:', created);
  await p.$disconnect();
}
main();
