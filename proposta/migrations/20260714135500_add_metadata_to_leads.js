exports.up = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    if (!(await knex.schema.hasColumn('leads', 'campos_personalizados'))) {
      await knex.schema.table('leads', table => {
        table.json('campos_personalizados').nullable();
      });
    }
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    if (await knex.schema.hasColumn('leads', 'campos_personalizados')) {
      await knex.schema.table('leads', table => {
        table.dropColumn('campos_personalizados');
      });
    }
  }
};
