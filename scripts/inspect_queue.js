const mariadb = require('mariadb');

async function test() {
  const pool = mariadb.createPool({
    host: 'webbd01-app-server.mysql.database.azure.com',
    user: 'eventos',
    password: 'U2a6M2slUs-^',
    database: 'eventos',
    port: 3306,
    ssl: { rejectUnauthorized: false },
  });

  const conn = await pool.getConnection();
  try {
    const summary = await conn.query("SELECT status, count(*) as count FROM message_queue GROUP BY status");
    console.log('Status counts:', summary);

    const pendingByDdd = await conn.query("SELECT SUBSTRING(phone, 3, 2) as ddd, count(*) as count FROM message_queue WHERE status = 'PENDING' GROUP BY ddd ORDER BY count DESC");
    console.log('Pending by DDD:', pendingByDdd);

    const first5 = await conn.query("SELECT id, phone, SUBSTRING(phone, 3, 2) as ddd, next_attempt_at FROM message_queue WHERE status = 'PENDING' ORDER BY next_attempt_at ASC LIMIT 5");
    console.log('First 5 pending in queue:', first5);

    const last5 = await conn.query("SELECT id, phone, SUBSTRING(phone, 3, 2) as ddd, next_attempt_at FROM message_queue WHERE status = 'PENDING' ORDER BY next_attempt_at DESC LIMIT 5");
    console.log('Last 5 pending in queue:', last5);
  } finally {
    conn.release();
    await pool.end();
  }
}

test().catch(console.error);
