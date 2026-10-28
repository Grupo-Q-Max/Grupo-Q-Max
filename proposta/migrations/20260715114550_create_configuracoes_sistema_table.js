/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable("configuracoes_sistema");
  if (!hasTable) {
    await knex.schema.createTable("configuracoes_sistema", (table) => {
      table.increments("id").primary();
      table.string("chave", 100).unique().notNullable();
      table.text("valor").nullable();
      table.timestamp("atualizado_em").defaultTo(knex.fn.now());
    });

    // Insere o fluxo padrão da D4Sign (ordenado por default: Cliente assina primeiro, depois Vendedor)
    await knex("configuracoes_sistema").insert({
      chave: "fluxo_d4sign",
      valor: "ordenado"
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists("configuracoes_sistema");
};
