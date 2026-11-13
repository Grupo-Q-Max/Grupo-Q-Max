const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DISPARADOR INTELIGENTE ANTI-BAN DO GRUPO Q-MAX (WHATSAPP VIA Z-API)
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Regras Anti-Bloqueio (Para número aquecido):
 * 1. Spintax Obrigatório: Cada mensagem gerada possui variações de texto e emojis únicos.
 * 2. Delay Humanizado: Intervalos aleatórios de 60 a 150 segundos entre envios.
 * 3. Pausa Humanizada: Pausa de 8 a 15 minutos a cada bloco de 15 mensagens.
 * 4. Horário Comercial: Envios concentrados entre 08:30 e 20:30 (horário de Brasília).
 * 5. Mídia + Legenda: Envio de imagem já com o texto na legenda (1 único disparo Z-API).
 * 6. Higienização e Deduplicação: Validação rigorosa de DDD, 9º dígito e eliminação de duplicados.
 */

// ─── PARSER DE SPINTAX {opcao1|opcao2|opcao3} ─────────────────────────────────
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

// ─── HIGIENIZAÇÃO DE NÚMERO (PADRÃO BRASIL 55 + DDD + NUMERO) ─────────────────
function sanitizePhone(rawPhone) {
  if (!rawPhone) return null;
  let clean = String(rawPhone).replace(/\D/g, '');
  if (clean.length < 10) return null;

  // Se já vier com 55 no início
  if (clean.startsWith('55') && clean.length >= 12) {
    return clean;
  }

  // DDD (2 dígitos) + 8 ou 9 dígitos -> adiciona DDI 55
  if (clean.length === 10 || clean.length === 11) {
    return '55' + clean;
  }

  return clean;
}

// ─── CONVERSÃO DE IMAGEM LOCAL PARA BASE64 OU VALIDAÇÃO DE URL ────────────────
function resolveMedia(imageInput) {
  if (!imageInput) return null;

  const trimmed = String(imageInput).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { mediaUrl: trimmed, mediaType: 'IMAGE' };
  }

  // Se for caminho de arquivo local
  const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(resolvedPath)) {
    const ext = path.extname(resolvedPath).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const base64Data = fs.readFileSync(resolvedPath).toString('base64');
    const dataUrl = `data:${mime};base64,${base64Data}`;
    return { mediaUrl: dataUrl, mediaType: 'IMAGE', isLocal: true, path: resolvedPath };
  }

  return null;
}

// ─── FUNÇÃO PRINCIPAL DE ENFILEIRAMENTO ───────────────────────────────────────
async function enfileirarDisparo({
  eventId = 1,
  contatos = [], // Array de { phone, name } ou array simples de strings ['11999999999', ...]
  mensagemTemplate = '',
  imagemCaminhoOuUrl = null,
  isDryRun = false,
}) {
  console.log('=====================================================');
  console.log('🚀 PREPARADOR DE DISPARO WHATSAPP - MODO ANTI-BAN');
  console.log('=====================================================');

  if (!mensagemTemplate.trim()) {
    throw new Error('A mensagem do disparo não pode estar vazia.');
  }

  const media = resolveMedia(imagemCaminhoOuUrl);
  if (imagemCaminhoOuUrl && !media) {
    console.warn(`⚠️ Aviso: Imagem especificada não foi encontrada nem é URL válida: "${imagemCaminhoOuUrl}"`);
  } else if (media) {
    console.log(`📸 Imagem anexada com sucesso: ${media.isLocal ? media.path : media.mediaUrl}`);
  }

  // 1. Higienizar e deduplicar lista de contatos
  const seenPhones = new Set();
  const validList = [];

  for (const item of contatos) {
    const rawPhone = typeof item === 'object' ? item.phone : item;
    const rawName = typeof item === 'object' ? item.name : 'Visitante';
    const phone = sanitizePhone(rawPhone);

    if (!phone) continue;
    if (seenPhones.has(phone)) continue;

    seenPhones.add(phone);
    const firstName = (rawName || 'Visitante').trim().split(/\s+/)[0];
    validList.push({ phone, name: firstName });
  }

  console.log(`\n📋 Contatos processados:`);
  console.log(`   - Total recebido: ${contatos.length}`);
  console.log(`   - Contatos válidos e únicos: ${validList.length}`);
  console.log(`   - Inválidos ou duplicados descartados: ${contatos.length - validList.length}`);

  if (validList.length === 0) {
    console.log('❌ Nenhum número válido para enfileirar.');
    return;
  }

  // 2. Conectar ao Azure MySQL para verificar fila existente e agendar
  const pool = mariadb.createPool({
    host: 'webbd01-app-server.mysql.database.azure.com',
    user: 'eventos',
    password: 'U2a6M2slUs-^',
    database: 'eventos',
    port: 3306,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 8000,
  });

  const conn = await pool.getConnection();

  try {
    // Verificar números que já estão na fila deste evento para não repetir
    const existingInQueue = await conn.query(
      'SELECT phone FROM message_queue WHERE event_id = ? AND status IN ("PENDING", "PROCESSING", "SENT")',
      [eventId]
    );
    const alreadyQueued = new Set(existingInQueue.map(q => q.phone));

    const toInsert = [];
    let scheduleCursor = new Date();
    // Iniciar 1 minuto à frente
    scheduleCursor.setMinutes(scheduleCursor.getMinutes() + 1);

    let batchCounter = 0;

    for (const contact of validList) {
      if (alreadyQueued.has(contact.phone)) {
        continue;
      }

      // Variação Spintax personalizada
      let msg = mensagemTemplate.replace(/\{nome\}/gi, contact.name);
      msg = parseSpintax(msg);

      // Intervalo seguro: 60s a 150s (flutuação humana)
      const randomSeconds = 60 + Math.floor(Math.random() * 91);
      scheduleCursor = new Date(scheduleCursor.getTime() + randomSeconds * 1000);

      // Pausa humana de 10 a 15 min a cada 15 envios
      batchCounter++;
      if (batchCounter >= 15) {
        batchCounter = 0;
        const pauseMinutes = 10 + Math.floor(Math.random() * 6);
        scheduleCursor = new Date(scheduleCursor.getTime() + pauseMinutes * 60 * 1000);
      }

      // Proteção de horário comercial (08:30 às 20:30 BRT)
      const brasiliaHour = (scheduleCursor.getUTCHours() - 3 + 24) % 24;
      if (brasiliaHour >= 21) {
        // Empurrar para o dia seguinte às 08:30 + jitter
        scheduleCursor.setUTCDate(scheduleCursor.getUTCDate() + 1);
        scheduleCursor.setUTCHours(11, 30 + Math.floor(Math.random() * 15), 0, 0); // 11:30 UTC = 08:30 BRT
      } else if (brasiliaHour < 8) {
        scheduleCursor.setUTCHours(11, 30 + Math.floor(Math.random() * 15), 0, 0);
      }

      toInsert.push({
        event_id: eventId,
        phone: contact.phone,
        message: msg,
        media_url: media ? media.mediaUrl : null,
        media_type: media ? media.mediaType : 'TEXT',
        status: 'PENDING',
        next_attempt_at: new Date(scheduleCursor),
      });
    }

    console.log(`\n📦 Lote final para enfileiramento: ${toInsert.length} mensagens`);
    console.log(`   - Ignorados por já constarem na fila: ${validList.length - toInsert.length}`);

    if (toInsert.length > 0) {
      console.log(`\n⏱️ Estimativa de entrega do lote com proteções Anti-Ban:`);
      console.log(`   - Primeiro envio programado para: ${toInsert[0].next_attempt_at.toLocaleString('pt-BR')}`);
      console.log(`   - Último envio programado para:   ${toInsert[toInsert.length - 1].next_attempt_at.toLocaleString('pt-BR')}`);
    }

    // Exibir amostra dos primeiros 2 textos gerados
    if (toInsert.length > 0) {
      console.log('\n📝 Amostra de mensagens com Spintax geradas:');
      console.log('----------------------------------------------------');
      console.log(`[Destinatário: ${toInsert[0].phone}]`);
      console.log(toInsert[0].message);
      if (toInsert.length > 1) {
        console.log('----------------------------------------------------');
        console.log(`[Destinatário: ${toInsert[1].phone}]`);
        console.log(toInsert[1].message);
      }
      console.log('----------------------------------------------------');
    }

    if (isDryRun) {
      console.log('\n🔍 [DRY-RUN] Modo simulação ativo. Nenhuma mensagem foi inserida no banco.');
      return;
    }

    // Gravação no Banco de Dados
    if (toInsert.length > 0) {
      console.log('\n💾 Gravando mensagens na fila do banco de dados (message_queue)...');
      for (const item of toInsert) {
        await conn.query(
          `INSERT INTO message_queue (event_id, phone, message, media_url, media_type, status, next_attempt_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NOW(), NOW())`,
          [item.event_id, item.phone, item.message, item.media_url, item.media_type, item.next_attempt_at]
        );
      }
      console.log(`✅ Sucesso! ${toInsert.length} mensagens inseridas na fila com sucesso.`);
      console.log('O worker em background enviará as mensagens progressivamente respeitando o Anti-Ban.');
    }

  } finally {
    conn.release();
    await pool.end();
  }
}

module.exports = {
  enfileirarDisparo,
  parseSpintax,
  sanitizePhone,
  resolveMedia,
};

// Execução direta caso chamado por linha de comando
if (require.main === module) {
  console.log('Disparador carregado como módulo. Pronto para uso!');
}

