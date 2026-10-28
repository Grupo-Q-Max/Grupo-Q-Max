exports.up = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    await knex.schema.table('leads', table => {
      table.float('area_m2').nullable();
      table.integer('posicoes_coworking').nullable();
      table.string('tipo_espaco', 100).nullable();
      table.string('marca', 50).defaultTo('finora');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    await knex.schema.table('leads', table => {
      table.dropColumn('area_m2');
      table.dropColumn('posicoes_coworking');
      table.dropColumn('tipo_espaco');
      table.dropColumn('marca');
    });
  }
};
