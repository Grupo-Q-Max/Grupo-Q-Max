/**
 * Sincroniza o estoque e configuração de prêmios do evento Invictus.
 * Uso: node eventos/apps/api/scripts/seed-invictus-prizes.js
 */
const { PrismaClient } = require('../src/generated/prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.EVENTOS_DATABASE_URL;
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

async function main() {
  const config = getDatabaseConfig();
  const adapter = new PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 5,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    let event = await prisma.events.findFirst({ where: { slug: 'invictus' } });
    if (!event) {
      event = await prisma.events.create({
        data: {
          name: 'Finora Experience - Invictus',
          slug: 'invictus',
          status: 'ACTIVE',
          participation_enabled: true,
          accent_color: '#E5484D',
          accent_ink_color: '#B4232A',
          experience: 'ROLETA',
        },
      });
      console.log('[SEED] Evento Invictus criado com ID:', event.id);
    }

    const normalPrizes = [
      { name: 'Caderno', stock: 183, prob: 15.9825, description: 'Caderno oficial Finora Experience' },
      { name: 'Copo', stock: 203, prob: 17.7293, description: 'Copo exclusivo Finora' },
      { name: 'Garrafa', stock: 62, prob: 5.4148, description: 'Garrafa térmica Finora' },
      { name: 'Espelho', stock: 189, prob: 16.5066, description: 'Espelho de bolso Finora' },
      { name: 'Chaveiro', stock: 194, prob: 16.9432, description: 'Chaveiro metálico Finora' },
      { name: 'Pins', stock: 314, prob: 27.4236, description: 'Pin colecionável Finora' },
    ];

    const vipPrizes = [
      { name: 'Certificado', stock: 100, prob: 20.0000, description: 'Certificado oficial de mentorado' },
      { name: '50% de desconto no 1 honorário', stock: 50, prob: 20.0000, description: '50% de desconto no primeiro honorário Finora' },
      { name: '100% do primeiro honorário', stock: 20, prob: 20.0000, description: '100% de isenção no primeiro honorário Finora' },
      { name: 'Diagnóstico', stock: 100, prob: 20.0000, description: 'Diagnóstico tributário e contábil completo' },
      { name: 'Mentoria CEO - 2horas', stock: 10, prob: 20.0000, description: '2 horas de mentoria executiva direto com o CEO' },
    ];

    const currentPrizes = await prisma.prizes.findMany({ where: { event_id: event.id } });

    for (const p of normalPrizes) {
      const match = currentPrizes.find(
        (cp) => cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() && !cp.is_vip,
      );
      if (match) {
        await prisma.prizes.update({
          where: { id: match.id },
          data: {
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: false,
            active: true,
          },
        });
      } else {
        await prisma.prizes.create({
          data: {
            event_id: event.id,
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: false,
            active: true,
          },
        });
      }
    }

    for (const p of vipPrizes) {
      const match = currentPrizes.find(
        (cp) => cp.name.trim().toLowerCase() === p.name.trim().toLowerCase() && cp.is_vip,
      );
      if (match) {
        await prisma.prizes.update({
          where: { id: match.id },
          data: {
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: true,
            active: true,
          },
        });
      } else {
        await prisma.prizes.create({
          data: {
            event_id: event.id,
            name: p.name,
            description: p.description,
            initial_stock: p.stock,
            available_stock: p.stock,
            probability: p.prob,
            is_vip: true,
            active: true,
          },
        });
      }
    }

    const validNames = [...normalPrizes, ...vipPrizes].map((p) => p.name.toLowerCase());
    for (const cp of currentPrizes) {
      if (!validNames.includes(cp.name.trim().toLowerCase())) {
        await prisma.prizes.update({
          where: { id: cp.id },
          data: { active: false },
        });
      }
    }

    console.log('[SEED] Prêmios do evento Invictus sincronizados com sucesso!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[SEED] Erro ao sincronizar prêmios Invictus:', err.message);
  process.exit(0);
});

