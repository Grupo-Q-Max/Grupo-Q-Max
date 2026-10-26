/**
 * restagger-queue.ts
 * 
 * Re-escalonador de fila — Rodar UMA VEZ após recuperação de ban.
 * 
 * O que faz:
 *   - Pega todas as mensagens PENDING/FAILED do event_id informado
 *   - Distribui os `next_attempt_at` com intervalo aleatório de 3-6 min entre cada
 *   - Começa no próximo horário comercial disponível (9h-20h BRT)
 *   - Nunca agenda mensagens fora do horário comercial
 * 
 * Uso:
 *   npx ts-node scripts/restagger-queue.ts
 *   ou: node scripts/restagger-queue.js
 */
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
  connectionLimit: 5,
});
const prisma = new PrismaClient({ adapter });

// ─── Configurações ────────────────────────────────────────────────────────────
const EVENT_ID = 2; // Clinicorp
const MIN_DELAY_MIN = 3;   // mínimo 3 minutos entre mensagens
const MAX_DELAY_MIN = 6;   // máximo 6 minutos entre mensagens
const BUSINESS_START_H = 9;  // 9h BRT
const BUSINESS_END_H   = 20; // 20h BRT
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna delay aleatório em ms entre MIN e MAX minutos */
function randomDelayMs(): number {
  const min = MIN_DELAY_MIN * 60 * 1000;
  const max = MAX_DELAY_MIN * 60 * 1000;
  return min + Math.floor(Math.random() * (max - min));
}

/** Converte Date para hora de Brasília (UTC-3) */
function toBrasiliaHour(date: Date): number {
  return (date.getUTCHours() - 3 + 24) % 24;
}

/**
 * Avança `cursor` até o próximo slot dentro do horário comercial BRT.
 * Se estiver fora do horário, pula para as 9h do próximo dia.
 */
function nextBusinessSlot(cursor: Date): Date {
  const result = new Date(cursor);
  const h = toBrasiliaHour(result);

  if (h < BUSINESS_START_H) {
    // Ainda não abriu hoje — avança para 9h hoje
    const diffHours = BUSINESS_START_H - h;
    result.setTime(result.getTime() + diffHours * 60 * 60 * 1000);
  } else if (h >= BUSINESS_END_H) {
    // Já fechou — avança para 9h do dia seguinte
    const hoursUntilTomorrow = (24 - h) + BUSINESS_START_H;
    result.setTime(result.getTime() + hoursUntilTomorrow * 60 * 60 * 1000);
    result.setUTCMinutes(0, 0, 0);
  }

  return result;
}

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  Re-Stagger Anti-Ban — Fila do Evento #' + EVENT_ID);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');

  const messages = await prisma.message_queue.findMany({
    where: {
      event_id: EVENT_ID,
      status: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
    },
    orderBy: { id: 'asc' },
    select: { id: true, phone: true, status: true },
  });

  if (messages.length === 0) {
    console.log('✅ Nenhuma mensagem pendente na fila. Nada a fazer!');
    return;
  }

  console.log(`📋 ${messages.length} mensagens encontradas para re-agendar.`);
  console.log(`⏱️  Intervalo: ${MIN_DELAY_MIN}–${MAX_DELAY_MIN} min entre cada`);
  console.log(`🕐  Horário comercial: ${BUSINESS_START_H}h–${BUSINESS_END_H}h BRT`);
  console.log('');

  // Cursor de tempo: começa agora e avança para o próximo slot comercial
  let cursor = nextBusinessSlot(new Date());

  console.log(`📅 Primeiro envio agendado para: ${cursor.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log('');

  let updated = 0;

  for (const msg of messages) {
    await prisma.message_queue.update({
      where: { id: msg.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        next_attempt_at: cursor,
        error_reason: null,
        updated_at: new Date(),
      },
    });

    const localTime = cursor.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    console.log(`  [${String(updated + 1).padStart(3, '0')}] ID ${msg.id} → ${msg.phone} → ${localTime}`);

    // Avança cursor com delay aleatório, garantindo que caia em horário comercial
    cursor = nextBusinessSlot(new Date(cursor.getTime() + randomDelayMs()));
    updated++;
  }

  const lastTime = cursor.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`✅ ${updated} mensagens re-agendadas com sucesso.`);
  console.log(`📅 Estimativa de conclusão: ${lastTime}`);
  console.log('');
  console.log('  Agora suba a API. O worker processará automaticamente.');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
