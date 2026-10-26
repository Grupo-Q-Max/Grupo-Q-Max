import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../src/generated/prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';

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

function parseSpintax(text: string): string {
  const spintaxRegex = /\{([^{}]+)\}/g;
  let result = text;
  let match;
  while ((match = spintaxRegex.exec(result)) !== null) {
    const options = match[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    result = result.replace(match[0], randomOption);
    spintaxRegex.lastIndex = 0;
  }
  return result;
}

async function main() {
  console.log('Iniciando Broadcast do Hugo via Excel...');
  
  const EVENT_ID = 2; // Clinicorp

  // 0. Busca a mensagem salva no painel Admin Web (usamos o campo de Cadastro de Visitante)
  const event = await prisma.events.findUnique({ where: { id: EVENT_ID } });
  if (!event || !event.whatsapp_message) {
    console.error('ERRO: A mensagem do WhatsApp está vazia no banco de dados!');
    console.error('Vá até o painel Admin Web > Gerenciador de WhatsApp > Aba "Cadastro de Visitante", digite o texto e salve.');
    return;
  }
  const SPINTAX_MESSAGE = event.whatsapp_message;

  // 1. Busca todos os telefones que já foram para a fila de disparo deste evento
  const existingQueue = await prisma.message_queue.findMany({
    where: { event_id: EVENT_ID },
    select: { phone: true },
  });
  const alreadySentPhones = new Set(existingQueue.map(q => q.phone));
  console.log(`Verificados ${alreadySentPhones.size} números que já estão na fila.`);

  // 2. Busca todos os usuários que JÁ FIZERAM CADASTRO no projeto (tabela participants)
  const existingParticipants = await prisma.participants.findMany({
    select: { phone: true, phone_normalized: true },
  });
  
  const registeredPhones = new Set<string>();
  for (const p of existingParticipants) {
    if (p.phone) registeredPhones.add(p.phone.replace(/\D/g, ''));
    if (p.phone_normalized) registeredPhones.add(p.phone_normalized.replace(/\D/g, ''));
  }
  console.log(`Verificados ${registeredPhones.size} números que já possuem cadastro no sistema.`);

  // 3. Carrega a planilha Excel
  const excelPath = path.resolve(__dirname, '../../../Clinicorp Summit 2026.xlsx');
  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  console.log(`Encontrados ${rows.length} contatos na planilha Excel.`);

  let queuedCount = 0;
  let delayMinutes = 0;
  let skippedAlreadyQueued = 0;
  let skippedAlreadyRegistered = 0;

  for (const row of rows) {
    const phone = row['Telefone'] ? String(row['Telefone']) : null;
    if (!phone) continue;

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) continue;
    // Se o número não começar com 55 e for do BR, adiciona 55 pra garantir o padrão
    if (cleanPhone.length <= 11) {
      cleanPhone = '55' + cleanPhone;
    }

    const firstName = (row['Nome'] ? String(row['Nome']) : 'Visitante').trim().split(' ')[0];
    
    // Pula se já estiver na fila
    if (alreadySentPhones.has(cleanPhone) || alreadySentPhones.has(cleanPhone.replace(/^55/, ''))) {
      skippedAlreadyQueued++;
      continue;
    }

    // Pula se já tiver cadastro no projeto
    if (registeredPhones.has(cleanPhone) || registeredPhones.has(cleanPhone.replace(/^55/, ''))) {
      skippedAlreadyRegistered++;
      continue;
    }

    // Process the template
    let msg = SPINTAX_MESSAGE.replace(/\{nome\}/gi, firstName);
    msg = parseSpintax(msg);

    // Atraso ULTRA SEGURO: Aleatório entre 5 e 12 minutos
    const randomMinutes = Math.floor(Math.random() * 8) + 5;
    delayMinutes += randomMinutes;
    const sendDate = new Date();
    sendDate.setMinutes(sendDate.getMinutes() + delayMinutes);

    // Proteção de Horário Comercial (não enviar de madrugada)
    // Se a mensagem caiu pra depois das 21h ou antes das 08h da manhã
    if (sendDate.getHours() >= 21) {
      sendDate.setDate(sendDate.getDate() + 1); // Pula pro dia seguinte
      sendDate.setHours(8, Math.floor(Math.random() * 15), 0, 0); // Define entre 08:00 e 08:15
      delayMinutes = Math.floor((sendDate.getTime() - new Date().getTime()) / 60000);
    } else if (sendDate.getHours() < 8) {
      sendDate.setHours(8, Math.floor(Math.random() * 15), 0, 0); // Define entre 08:00 e 08:15 do próprio dia
      delayMinutes = Math.floor((sendDate.getTime() - new Date().getTime()) / 60000);
    }

    // Enqueue
    await prisma.message_queue.create({
      data: {
        event_id: EVENT_ID,
        phone: cleanPhone,
        message: msg,
        status: 'PENDING',
        next_attempt_at: sendDate,
      },
    });

    queuedCount++;
    if (queuedCount >= 100) {
      console.log('Limite de 100 mensagens por lote atingido. Parando por aqui.');
      break;
    }
  }

  console.log(`Concluído! ${queuedCount} NOVAS mensagens agendadas.`);
  console.log(`- Ignorados (já estavam na fila): ${skippedAlreadyQueued}`);
  console.log(`- Ignorados (já possuem cadastro no sistema): ${skippedAlreadyRegistered}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
