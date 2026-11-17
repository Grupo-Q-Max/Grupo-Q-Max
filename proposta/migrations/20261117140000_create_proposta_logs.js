exports.up = async function (knex) {
  if (await knex.schema.hasTable("proposta_logs")) return;
  await knex.schema.createTable("proposta_logs", (table) => {
    table.increments("id").primary();
    table.integer("proposta_id").notNullable();
    table.integer("usuario_id").nullable();
    table.string("usuario_nome", 255).nullable();
    table.string("usuario_role", 50).nullable();
    table.string("acao", 100).notNullable();
    table.string("titulo", 255).notNullable();
    table.text("detalhes").nullable();
    table.text("dados_anteriores_json", "longtext").nullable();
    table.text("dados_novos_json", "longtext").nullable();
    table.string("ip", 50).nullable();
    table.dateTime("criado_em").defaultTo(knex.fn.now());
    table.index(["proposta_id"], "idx_proposta_logs_prop");
    table.index(["acao"], "idx_proposta_logs_acao");
    table.index(["criado_em"], "idx_proposta_logs_criado");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("proposta_logs");
};
