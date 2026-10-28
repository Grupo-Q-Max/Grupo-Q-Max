exports.up = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    if (!(await knex.schema.hasColumn('leads', 'cnpj'))) {
      await knex.schema.table('leads', table => {
        table.string('cnpj', 20).nullable();
      });
    }
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    if (await knex.schema.hasColumn('leads', 'cnpj')) {
      await knex.schema.table('leads', table => {
        table.dropColumn('cnpj');
      });
    }
  }
};
