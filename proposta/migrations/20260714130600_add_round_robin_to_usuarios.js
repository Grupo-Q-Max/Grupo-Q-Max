exports.up = async function(knex) {
  if (await knex.schema.hasTable('usuarios')) {
    await knex.schema.alterTable('usuarios', table => {
      table.boolean('recebe_leads').defaultTo(true);
      table.timestamp('ultimo_lead_recebido_em').nullable().defaultTo(null);
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('usuarios')) {
    await knex.schema.alterTable('usuarios', table => {
      table.dropColumn('ultimo_lead_recebido_em');
      table.dropColumn('recebe_leads');
    });
  }
};
