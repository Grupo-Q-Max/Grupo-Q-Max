exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  await knex.schema.alterTable('regras_precificacao', table => {
    table.decimal('valor_base_pf', 15, 2).nullable();
    table.decimal('valor_base_pj', 15, 2).nullable();
    table.decimal('valor_base_hibrido', 15, 2).nullable();
  });
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  await knex.schema.alterTable('regras_precificacao', table => {
    table.dropColumn('valor_base_pf');
    table.dropColumn('valor_base_pj');
    table.dropColumn('valor_base_hibrido');
  });
};
