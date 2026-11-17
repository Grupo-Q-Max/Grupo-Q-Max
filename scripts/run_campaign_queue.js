const mariadb = require('mariadb');
const path = require('path');

const ZAPI_CONFIG = {
  instanceId: '3F89F6D486DE607670FCC6875DDA7AD5',
  token: 'B6484C6CC1E7F0C99EAAD46C',
  clientToken: 'F3c0fad77fa1b4aa485ee6d6ff93b4bbbS',
  baseUrl: 'https://api.z-api.io/instances',
};

// Anti-Ban human pacing parameters
const SETTINGS = {
  minDelaySec: 60,
  maxDelaySec: 150,
  batchSize: 15,
  batchPauseMinMinutes: 8,
  batchPauseMaxMinutes: 12,
  businessHourStart: 8,
  businessHourEnd: 21,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay() {
  const min = SETTINGS.minDelaySec * 1000;
  const max = SETTINGS.maxDelaySec * 1000;
  return min + Math.floor(Math.random() * (max - min));
}

function getRandomBatchPause() {
  const min = SETTINGS.batchPauseMinMinutes * 60 * 1000;
  const max = SETTINGS.batchPauseMaxMinutes * 60 * 1000;
  return min + Math.floor(Math.random() * (max - min));
}

function isWithinBusinessHours() {
  const now = new Date();
  const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
  return brasiliaHour >= SETTINGS.businessHourStart && brasiliaHour < SETTINGS.businessHourEnd;
}

async function checkZapiStatus() {
  const url = `${ZAPI_CONFIG.baseUrl}/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/status`;
  try {
    const res = await fetch(url, {
      headers: { 'Client-Token': ZAPI_CONFIG.clientToken },
    });
    if (!res.ok) return { connected: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      connected: data.connected === true,
      smartphoneConnected: data.smartphoneConnected === true,
      data,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function sendViaZapi(phone, message, mediaUrl, mediaType) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    cleanPhone = '55' + cleanPhone;
  }

  let endpoint = 'send-text';
  let payload = { phone: cleanPhone, message };

  if (mediaUrl) {
    if (mediaType === 'IMAGE') {
      endpoint = 'send-image';
      payload = {
        phone: cleanPhone,
        image: mediaUrl,
        caption: message,
      };
    }
  }

  const url = `${ZAPI_CONFIG.baseUrl}/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/${endpoint}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CONFIG.clientToken,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  let responseData = null;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { raw: responseText };
  }

  if (!res.ok) {
    throw new Error(`Z-API Erro (${res.status}): ${responseText}`);
  }

  return responseData;
}

async function startQueueWorker({ maxToSend = null } = {}) {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🚀 MOTOR DE DISPARO WHATSAPP - MODO ANTI-BAN ATIVO');
  console.log('═══════════════════════════════════════════════════════════════════');

  // 1. Verificar conexão Z-API
  console.log('\n🔍 Verificando status da instância Z-API...');
  const zapiStatus = await checkZapiStatus();
  if (!zapiStatus.connected) {
    console.error('❌ ERRO: Instância Z-API não está conectada ao WhatsApp!');
    console.error(zapiStatus);
    process.exit(1);
  }
  console.log('✅ Z-API Conectada e Pronta! Celular pareado com sucesso.');

  // 2. Conectar ao Banco de Dados
  console.log('🔌 Conectando ao Azure MySQL (eventos)...');
  const pool = mariadb.createPool({
    host: 'webbd01-app-server.mysql.database.azure.com',
    user: 'eventos',
    password: 'U2a6M2slUs-^',
    database: 'eventos',
    port: 3306,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 5,
  });

  let totalSentInSession = 0;
  let batchCounter = 0;

  try {
    while (true) {
      if (maxToSend && totalSentInSession >= maxToSend) {
        console.log(`\n🛑 Limite de envios da sessão (${maxToSend}) atingido.`);
        break;
      }

      // Checar horário comercial
      if (!isWithinBusinessHours()) {
        console.log('⏸️ [Anti-Ban] Fora do horário comercial (08:00 às 21:00 BRT). Aguardando...');
        await sleep(60 * 1000);
        continue;
      }

      const conn = await pool.getConnection();
      let nextItem = null;

      try {
        // Seleciona a próxima mensagem PENDING: DDD 11 primeiro (next_attempt_at asc, id asc)
        const rows = await conn.query(`
          SELECT id, event_id, phone, message, media_url, media_type, attempts
          FROM message_queue
          WHERE event_id = 1 AND status = 'PENDING'
          ORDER BY next_attempt_at ASC, id ASC
          LIMIT 1
        `);

        if (rows.length === 0) {
          console.log('\n🎉 PARABÉNS! Não há mais mensagens pendentes na fila. Campanha concluída!');
          break;
        }

        const candidate = rows[0];

        // Trava atômica (PROCESSING)
        const lockRes = await conn.query(
          `UPDATE message_queue SET status = 'PROCESSING', updated_at = NOW() WHERE id = ? AND status = 'PENDING'`,
          [candidate.id]
        );

        if (lockRes.affectedRows === 0) {
          // Outro processo pegou
          continue;
        }

        nextItem = candidate;
      } finally {
        conn.release();
      }

      const ddd = nextItem.phone.slice(2, 4);
      console.log(`\n-------------------------------------------------------------------`);
      console.log(`📤 Enviando Mensagem #${totalSentInSession + 1} (Fila ID: ${nextItem.id})`);
      console.log(`   - Destinatário: ${nextItem.phone} (DDD ${ddd})`);
      console.log(`   - Mídia: ${nextItem.media_url || 'Nenhuma'}`);
      console.log(`   - Tentativa: ${nextItem.attempts + 1}`);

      let success = false;
      let errorReason = null;

      try {
        const sendResult = await sendViaZapi(
          nextItem.phone,
          nextItem.message,
          nextItem.media_url,
          nextItem.media_type
        );
        success = true;
        console.log(`   ✅ Envio confirmado pela Z-API! ZaapId: ${sendResult.zaapId || sendResult.id || 'OK'}`);
      } catch (err) {
        errorReason = err.message || 'Erro desconhecido Z-API';
        console.error(`   ❌ Falha no envio: ${errorReason}`);
      }

      // Atualizar status no banco
      const connUpdate = await pool.getConnection();
      try {
        if (success) {
          await connUpdate.query(
            `UPDATE message_queue 
             SET status = 'SENT', attempts = attempts + 1, updated_at = NOW() 
             WHERE id = ?`,
            [nextItem.id]
          );
          totalSentInSession++;
          batchCounter++;
        } else {
          await connUpdate.query(
            `UPDATE message_queue 
             SET status = 'FAILED', attempts = attempts + 1, error_reason = ?, updated_at = NOW() 
             WHERE id = ?`,
            [errorReason, nextItem.id]
          );
        }
      } finally {
        connUpdate.release();
      }

      // Contagem restante
      const connCount = await pool.getConnection();
      let remainingCount = 0;
      try {
        const cRows = await connCount.query(`SELECT COUNT(*) as count FROM message_queue WHERE event_id = 1 AND status = 'PENDING'`);
        remainingCount = Number(cRows[0].count);
      } finally {
        connCount.release();
      }

      console.log(`   📊 Progresso: ${totalSentInSession} enviados nesta sessão | ${remainingCount} restantes na fila.`);

      if (remainingCount === 0) {
        console.log('\n🎉 Campanha 100% finalizada com sucesso!');
        break;
      }

      // Verificação de Pausa de Lote (após cada 15 envios)
      if (batchCounter >= SETTINGS.batchSize) {
        batchCounter = 0;
        const pauseMs = getRandomBatchPause();
        const pauseMin = Math.round(pauseMs / 60000);
        console.log(`\n☕ [Anti-Ban] Lote de 15 mensagens atingido. Pausa humana de ${pauseMin} minutos...`);
        await sleep(pauseMs);
      } else {
        // Delay aleatório normal entre 60s e 150s
        const delayMs = getRandomDelay();
        const delaySec = Math.round(delayMs / 1000);
        console.log(`⏳ [Anti-Ban] Aguardando ${delaySec}s antes do próximo envio (simulação humana)...`);
        await sleep(delayMs);
      }
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const max = process.argv[2] ? Number(process.argv[2]) : null;
  startQueueWorker({ maxToSend: max }).catch(console.error);
}

module.exports = { startQueueWorker };

