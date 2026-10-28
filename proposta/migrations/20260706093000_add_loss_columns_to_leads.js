exports.up = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    await knex.schema.table('leads', table => {
      table.string('motivo_perda', 100).nullable();
      table.text('detalhes_perda').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    await knex.schema.table('leads', table => {
      table.dropColumn('motivo_perda');
      table.dropColumn('detalhes_perda');
    });
  }
};
