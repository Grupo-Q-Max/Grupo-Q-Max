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
  connectionLimit: 10,
});
const p = new PrismaClient({ adapter });
async function main() {
  const e = await p.events.findFirst({ where: { slug: 'sucesso-odonto' } });
  if (e) { console.log('Exists', e); return; }
  const created = await p.events.create({
    data: { name: 'Sucesso Odonto', slug: 'sucesso-odonto', status: 'ACTIVE', participation_enabled: true }
  });
  console.log('Created', created);
}
main();
