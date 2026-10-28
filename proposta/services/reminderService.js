const db = require("../config/db");
const notificationService = require("./notificationService");

function inicializarLembretesComerciais() {
  console.log("[Reminder Service] Inicializado com sucesso.");

  // Executar a verificação a cada 30 segundos; consulta lenta não pode sobrepor duas rodadas (lembrete duplicado)
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      // Buscar atividades pendentes vencidas ou no horário atual
      const atividadesVencidas = await db.executarQuery(`
        SELECT la.*, l.nome_cliente, u.nome AS usuario_nome
        FROM lead_atividades la
        JOIN leads l ON la.lead_id = l.id
        JOIN usuarios u ON la.usuario_id = u.id
        WHERE la.data_hora <= NOW() 
          AND la.concluido = 0 
          AND la.alerta_enviado = 0
      `);

      if (atividadesVencidas.length === 0) return;

      for (const act of atividadesVencidas) {
        // Marcar alerta como enviado no banco de dados
        await db.query(
          "UPDATE lead_atividades SET alerta_enviado = 1 WHERE id = ?",
          [act.id]
        );

        // Disparar notificação via SSE
        notificationService.enviarNotificacao("atividade_lembrete", {
          id: act.id,
          lead_id: act.lead_id,
          usuario_id: act.usuario_id,
          vendedor_nome: act.usuario_nome,
          cliente_nome: act.nome_cliente,
          tipo: act.tipo,
          descricao: act.descricao || "",
          data_hora: act.data_hora
        }, [act.usuario_id]);
      }
    } catch (error) {
      console.error("[Reminder Service] Erro ao checar lembretes:", error.message);
    } finally {
      rodando = false;
    }
  }, 30000);
}

module.exports = { inicializarLembretesComerciais };
