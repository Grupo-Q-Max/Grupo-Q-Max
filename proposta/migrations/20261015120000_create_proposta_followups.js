// Tabela era criada em runtime pelo followUpService a cada 15 min; produção já pode tê-la.
exports.up = async function (knex) {
  if (await knex.schema.hasTable("proposta_followups")) return;
  await knex.schema.createTable("proposta_followups", (table) => {
    table.increments("id").primary();
    table.integer("proposta_id").notNullable();
    table.string("tipo_etapa", 50).notNullable();
    table.string("canal", 30).notNullable();
    table.string("destinatario", 150).notNullable();
    table.boolean("sucesso").defaultTo(true);
    table.text("detalhes").nullable();
    table.dateTime("enviado_em").defaultTo(knex.fn.now());
    table.index(["proposta_id", "tipo_etapa"], "idx_proposta_etapa");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("proposta_followups");
};
