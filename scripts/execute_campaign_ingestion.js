const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');

const rawData = `
MANUELA SANTOS	11 91057-2810
HENRIQUE ISSAO 	44 99157-6897
FERNANDA MAGNABOSCO	48 99135-8485
ANA CARLA ARAÚJO	11 93418-0813
MARIANA BEDIN	11 97182-2337
NEIFI AKID	11 98131-4073
AMARO	11 98461-4877
FE 	11 98758-9444
SIDNEIS MUNHOZ	11 99268-1053
DRA. NATALIA REZENDE	11 99485-9700
JULIANY	11 99911-5925
REGINA	11 99991-4329
ANA PAULA DIAS	12 98266-7000
MARIANA	12 99700-9042
VICTOR LIMA	13 99737-2118
SAMIA LEAL	24 99218-6034
RRBARCELLOS2505	27 99737-3410
MARCELO QUEIROZ	31 97145-0047
RAQUEL LIMA	31 99184-0512
LILIANY	31 99499-4044
ÉRICA CARVALHO	35 99202-5541
JONATHAS PIASSI	37 99812-5671
THIAGO MILEIB	37 99821-0053
PAULA	37 99929-5163
DANI	41 99899-0019
JÉSSICA LIMA NESELLO 	41 99992-3089
GABRIELA LIMA FABRI	44 98455-0078
GLAUBER COSTA DE OLIVEIRA	55 99101-2648
VICTORIA MACHADO	61 98191-3071
TIA THAY	62 98406-6349
DRA ESTER LEONCIO	99 98405-9241
KARINNE SOUSA	99 99183-6364
	11 91333-0818
	11 94272-3105
	11 94635-9247
	11 94738-1450
	11 95000-7889
	11 95253-3109
	11 95648-6071
	11 95991-1782
	11 96339-0004
	11 96340-8878
	11 96424-7797
	11 99517-6991
	11 99547-1996
	11 99621-8074
	11 99632-8065
	11 99938-4590
	11 99991-1447
	14 99767-9363
	14 99783-8312
	15 98166-6459
	15 99772-7553
	16 98146-0330
	16 98218-3419
	16 99149-6639
	16 99250-1880
	27 99691-8219
	27 99946-2051
	27 99978-1227
	28 99884-2926
	31 98586-0407
`;

// Spintax parser
function parseSpintax(text) {
  if (!text) return text;
  const regex = /\{([^{}]+)\}/g;
  let result = text;
  let match;
  while ((match = regex.exec(result)) !== null) {
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)];
    result = result.substring(0, match.index) + chosen + result.substring(match.index + match[0].length);
    regex.lastIndex = 0;
  }
  return result;
}

// Format friendly name
function extractFriendlyName(rawName) {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.toLowerCase() === 'nome') return '';

  const parts = trimmed.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  if (parts[0].toLowerCase().startsWith('dr')) {
    return parts.slice(0, 2).join(' ');
  }
  return parts[0];
}

// Contacts parser
function parseAndSortContacts(raw) {
  const lines = raw.trim().split('\n');
  const contacts = [];
  const seenPhones = new Set();
  let duplicates = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('NOME')) continue;

    let name = '';
    let phoneStr = '';

    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      name = tabParts[0].trim();
      phoneStr = tabParts[tabParts.length - 1].trim();
    } else {
      const match = trimmed.match(/^(.*?)(?:[\s\t]+)(\d{2}[\s\d\-]+)$/);
      if (match) {
        name = match[1].trim();
        phoneStr = match[2].trim();
      } else {
        phoneStr = trimmed;
      }
    }

    const clean = phoneStr.replace(/\D/g, '');
    if (clean.length < 10) continue;

    let fullPhone = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
    const ddd = Number(fullPhone.slice(2, 4));

    if (seenPhones.has(fullPhone)) {
      duplicates++;
      continue;
    }
    seenPhones.add(fullPhone);

    const friendlyName = extractFriendlyName(name);

    contacts.push({
      rawName: name,
      friendlyName,
      phone: fullPhone,
      displayPhone: phoneStr,
      ddd,
    });
  }

  // Ordenação: DDD 11 PRIMEIRO, depois os outros DDDs em ordem crescente
  contacts.sort((a, b) => {
    if (a.ddd === 11 && b.ddd !== 11) return -1;
    if (a.ddd !== 11 && b.ddd === 11) return 1;
    if (a.ddd !== b.ddd) return a.ddd - b.ddd;
    return a.phone.localeCompare(b.phone);
  });

  return { contacts, duplicates };
}

// Template de Mensagem com Spintax
function buildMessage(contact) {
  const greeting = contact.friendlyName
    ? `{Olá|Oi|Oie|Olá, Dr(a).}, *${contact.friendlyName}*! `
    : `{Olá|Oi|Oie|Olá, doutor(a)}! `;

  const template = `${greeting}{🎁 DONO DE CLÍNICA, SEU PRÓXIMO PASSO PARA CRESCER COM MAIS LUCRO É POR NOSSA CONTA!|🎁 DONO DE CLÍNICA: SEU PRÓXIMO PASSO PARA CRESCER COM MAIS LUCRO É POR NOSSA CONTA!|✨ DONO DE CLÍNICA, SEU PRÓXIMO PASSO PARA CRESCER COM MAIS LUCRO É POR NOSSA CONTA!}
 
{A FINORA tem um presente para você:|A FINORA preparou um presente especial para você:|A FINORA tem um presente imperdível para você:} um ingresso GOLD de cortesia para a Imersão O Código das Clínicas Lucrativas, com o Dr. Igor Steinmeyer!
 
📅 20 e 21 de novembro de 2026
📍 Grupo Acelerador — Alphaville/SP
 
Serão dois dias de conteúdo prático sobre gestão, marketing e vendas, voltados a donos de consultórios e clínicas odontológicas de pequeno e médio porte que querem melhorar seus resultados e se preparar para os desafios do próximo ano.
 
{💜 E a FINORA estará lá com você!|💜 E a equipe FINORA estará lá com você!|✨ E a FINORA estará presente junto com você!}
 
Nossa equipe estará presente para esclarecer dúvidas sobre contabilidade, impostos e gestão financeira, ajudando você a identificar oportunidades para transformar faturamento em lucro.
 
{Você não precisa enfrentar os desafios da sua clínica sozinho. Vamos juntos!|Não enfrente os desafios da sua clínica sozinho. Conte com a FINORA!|Você não precisa passar por esses desafios sozinho. Vamos juntos!}
 
FINORA — Inteligência financeira que transforma sorrisos em crescimento real.
 
{Quer ter este presente??? 💝|Quer garantir este presente??? 💝|Deseja receber este presente??? 💝}
{Entre em contato e fale com nossa equipe!!|Responda aqui e fale com nossa equipe!!|Fale com nossa equipe agora para garantir seu ingresso!!}`;

  return parseSpintax(template);
}

async function runCampaignSetup({ dryRun = true } = {}) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 PREPARADOR E AGENDADOR DA CAMPANHA DR. IGOR STEINMEYER');
  console.log(`Modo: ${dryRun ? '🔍 SIMULAÇÃO (DRY RUN)' : '💾 GRAVAÇÃO REAL NO BANCO'}`);
  console.log('═══════════════════════════════════════════════════════════════════');

  const { contacts, duplicates } = parseAndSortContacts(rawData);
  console.log(`\n📋 Contatos processados: ${contacts.length} únicos (${duplicates} duplicados ignorados).`);

  const ddd11Count = contacts.filter(c => c.ddd === 11).length;
  const othersCount = contacts.length - ddd11Count;
  console.log(`   - DDD 11 (Primeiros a serem enviados): ${ddd11Count}`);
  console.log(`   - Outros DDDs (Enviados na sequência):  ${othersCount}`);

  // Horários e Cadência Anti-Ban
  let scheduleCursor = new Date();
  // Se for fora de horário comercial (08:30 - 20:30 BRT), posiciona para início do horário comercial
  const brasiliaHour = (scheduleCursor.getUTCHours() - 3 + 24) % 24;
  if (brasiliaHour >= 21) {
    scheduleCursor.setUTCDate(scheduleCursor.getUTCDate() + 1);
    scheduleCursor.setUTCHours(11, 30, 0, 0); // 08:30 BRT
  } else if (brasiliaHour < 8) {
    scheduleCursor.setUTCHours(11, 30, 0, 0);
  } else {
    // Iniciar 2 minutos após agora
    scheduleCursor.setMinutes(scheduleCursor.getMinutes() + 2);
  }

  const plannedQueue = [];
  let batchCount = 0;

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const message = buildMessage(contact);

    // Delay entre 60s e 150s (flutuação humana anti-ban)
    const randomSeconds = 60 + Math.floor(Math.random() * 91);
    scheduleCursor = new Date(scheduleCursor.getTime() + randomSeconds * 1000);

    // Pausa humana de 10 a 15 minutos a cada 15 envios
    batchCount++;
    if (batchCount >= 15) {
      batchCount = 0;
      const pauseMinutes = 10 + Math.floor(Math.random() * 6);
      scheduleCursor = new Date(scheduleCursor.getTime() + pauseMinutes * 60 * 1000);
    }

    // Checagem de horário comercial
    const curHour = (scheduleCursor.getUTCHours() - 3 + 24) % 24;
    if (curHour >= 21) {
      scheduleCursor.setUTCDate(scheduleCursor.getUTCDate() + 1);
      scheduleCursor.setUTCHours(11, 30 + Math.floor(Math.random() * 15), 0, 0);
    }

    plannedQueue.push({
      order: i + 1,
      event_id: 1,
      phone: contact.phone,
      ddd: contact.ddd,
      friendlyName: contact.friendlyName,
      rawName: contact.rawName,
      message,
      media_url: 'https://grupoqmax.com.br/disparos/midia.jpg',
      media_type: 'IMAGE',
      next_attempt_at: new Date(scheduleCursor),
    });
  }

  console.log(`\n⏱️ Cronograma Planejado Anti-Ban:`);
  console.log(`   - 1º Envio (DDD ${plannedQueue[0].ddd}): ${plannedQueue[0].next_attempt_at.toLocaleString('pt-BR')}`);
  const lastDdd11 = plannedQueue.filter(p => p.ddd === 11).pop();
  console.log(`   - Último DDD 11 (#${lastDdd11.order}): ${lastDdd11.next_attempt_at.toLocaleString('pt-BR')}`);
  const firstOther = plannedQueue.find(p => p.ddd !== 11);
  console.log(`   - Primeiro Outro DDD (#${firstOther.order} - DDD ${firstOther.ddd}): ${firstOther.next_attempt_at.toLocaleString('pt-BR')}`);
  console.log(`   - Último Envio (#${plannedQueue.length} - DDD ${plannedQueue[plannedQueue.length - 1].ddd}): ${plannedQueue[plannedQueue.length - 1].next_attempt_at.toLocaleString('pt-BR')}`);

  console.log('\n📝 Amostras de Mensagens Geradas:');
  console.log('---------------------------------------------------------------');
  console.log(`[Exemplo 1 - Com Nome: ${plannedQueue[0].friendlyName} | Tel: ${plannedQueue[0].phone}]`);
  console.log(plannedQueue[0].message);
  console.log('---------------------------------------------------------------');
  const sampleNoName = plannedQueue.find(p => !p.friendlyName);
  if (sampleNoName) {
    console.log(`[Exemplo 2 - Sem Nome | Tel: ${sampleNoName.phone}]`);
    console.log(sampleNoName.message);
    console.log('---------------------------------------------------------------');
  }

  if (dryRun) {
    console.log('\n🔍 [DRY RUN CONCLUÍDO] Nenhum dado foi inserido no banco.');
    return plannedQueue;
  }

  // Gravação Real no Banco de Dados
  console.log('\n🔌 Conectando ao Azure MySQL...');
  const pool = mariadb.createPool({
    host: 'webbd01-app-server.mysql.database.azure.com',
    user: 'eventos',
    password: 'U2a6M2slUs-^',
    database: 'eventos',
    port: 3306,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 10000,
  });

  const conn = await pool.getConnection();
  try {
    // 1. Arquivar 35 mensagens antigas pendentes de setembro
    console.log('🧹 Arquivando pendências antigas de campanhas anteriores...');
    const archiveResult = await conn.query(
      `UPDATE message_queue 
       SET status = 'FAILED', 
           attempts = 99, 
           error_reason = 'Campanha anterior encerrada - substituída pela campanha Dr. Igor Steinmeyer',
           updated_at = NOW()
       WHERE status = 'PENDING' AND created_at < '2026-11-01'`
    );
    console.log(`   - ${archiveResult.affectedRows} mensagens antigas arquivadas com segurança.`);

    // 2. Inserir a nova fila rigorosamente na ordem
    console.log(`\n💾 Inserindo ${plannedQueue.length} mensagens na fila oficial...`);
    let inserted = 0;
    for (const item of plannedQueue) {
      await conn.query(
        `INSERT INTO message_queue 
         (event_id, phone, message, media_url, media_type, status, attempts, next_attempt_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?, NOW(), NOW())`,
        [item.event_id, item.phone, item.message, item.media_url, item.media_type, item.next_attempt_at]
      );
      inserted++;
    }

    console.log(`\n🎉 SUCESSO ABSOLUTO! ${inserted} mensagens gravadas na fila com sucesso.`);
    console.log('Todas ordenadas por DDD (DDD 11 primeiro), espaçadas de 60 a 150 segundos com pausas de lote.');

  } finally {
    conn.release();
    await pool.end();
  }

  return plannedQueue;
}

if (require.main === module) {
  const isReal = process.argv.includes('--execute');
  runCampaignSetup({ dryRun: !isReal }).catch(console.error);
}

module.exports = { runCampaignSetup, parseAndSortContacts, buildMessage };
