exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('lead_atividades'))) {
    await knex.schema.createTable('lead_atividades', table => {
      table.increments('id').primary();
      table.integer('lead_id').notNullable();
      table.integer('usuario_id').notNullable();
      table.string('tipo', 50).notNullable(); // Ligar, Reunião, E-mail, WhatsApp
      table.datetime('data_hora').notNullable();
      table.text('descricao').nullable();
      table.integer('concluido').defaultTo(0); // 0 = Pendente, 1 = Concluído
      table.integer('alerta_enviado').defaultTo(0); // 0 = Pendente, 1 = Enviado
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('lead_atividades');
};
