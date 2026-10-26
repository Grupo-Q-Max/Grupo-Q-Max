// CI smoke test: the database in DATABASE_URL answers. Read-only, so deploys add no fake rows.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const mariadb = require('mariadb');

const pool = mariadb.createPool(process.env.DATABASE_URL.replace('mysql://', 'mariadb://'));
const adapter = new PrismaMariaDb(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [leads, visits] = await Promise.all([prisma.contactLead.count(), prisma.pageVisit.count()]);
    console.log(`Banco OK (${leads} leads, ${visits} visitas).`);
  } catch (error) {
    console.error('Falha ao acessar o banco:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
