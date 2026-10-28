// Índices para as consultas que rodam a toda hora e hoje varrem a tabela inteira (validação de 27/10):
// - leads: lista/KPIs do CRM filtram por vendedor_id OR criado_por e por funil; webhook D4Sign busca por proposta_id
// - lead_comentarios / lead_atividades: subconsultas por lead na lista do CRM; lembretes a cada 30 s
// - proposta_visualizacoes / proposta_documentos: contagem por proposta no dashboard, follow-up e página do cliente
// - propostas.ip_assinatura: webhook D4Sign localiza a proposta pelo UUID do documento
// Só adiciona índice (não altera dados). Pula índice que já exista com o mesmo nome (banco criado à mão).
const INDICES = [
  ["leads", "idx_leads_vendedor", ["vendedor_id"]],
  ["leads", "idx_leads_criado_por", ["criado_por"]],
  ["leads", "idx_leads_funil", ["funil_id"]],
  ["leads", "idx_leads_proposta", ["proposta_id"]],
  ["lead_comentarios", "idx_lead_comentarios_lead", ["lead_id"]],
  ["lead_atividades", "idx_lead_atividades_lead", ["lead_id"]],
  ["lead_atividades", "idx_lead_atividades_lembrete", ["concluido", "alerta_enviado", "data_hora"]],
  ["proposta_visualizacoes", "idx_visualizacoes_proposta", ["proposta_id"]],
  ["proposta_documentos", "idx_documentos_proposta", ["proposta_id"]],
  ["propostas", "idx_propostas_ip_assinatura", ["ip_assinatura"]],
];

async function existeIndice(knex, tabela, nome) {
  const [linhas] = await knex.raw("SHOW INDEX FROM ?? WHERE Key_name = ?", [tabela, nome]);
  return linhas.length > 0;
}

exports.up = async function (knex) {
  for (const [tabela, nome, colunas] of INDICES) {
    if (await existeIndice(knex, tabela, nome)) continue;
    await knex.schema.alterTable(tabela, (t) => t.index(colunas, nome));
  }
};

exports.down = async function (knex) {
  for (const [tabela, nome] of INDICES) {
    if (!(await existeIndice(knex, tabela, nome))) continue;
    await knex.schema.alterTable(tabela, (t) => t.dropIndex([], nome));
  }
};
