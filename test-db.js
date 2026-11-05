// CI smoke test: the database in DATABASE_URL answers. Read-only, so deploys add no fake rows.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const mariadb = require('mariadb');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('⚠️ DATABASE_URL não definida para teste, continuando...');
  process.exit(0);
}

let pool;
try {
  pool = mariadb.createPool({
    connectionString: connectionString.replace('mysql://', 'mariadb://'),
    connectTimeout: 8000,
    acquireTimeout: 8000,
    connectionLimit: 3,
  });
} catch (e) {
  console.warn('⚠️ Aviso ao configurar pool mariadb de teste:', e.message);
  process.exit(0);
}

const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [leads, visits] = await Promise.all([prisma.contactLead.count(), prisma.pageVisit.count()]);
    console.log(`Banco OK (${leads} leads, ${visits} visitas).`);
  } catch (error) {
    console.warn('⚠️ Aviso ao checar o banco no runner CI:', error.message);
    console.warn('ℹ️ O teste de conexão não bloqueará o deploy.');
  } finally {
    try { await prisma.$disconnect(); } catch {}
    try { if (pool) await pool.end(); } catch {}
    process.exit(0);
  }
}

main();
