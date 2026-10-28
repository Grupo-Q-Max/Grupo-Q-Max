exports.up = async function(knex) {
  // 1. Tabela leads
  if (!(await knex.schema.hasTable('leads'))) {
    await knex.schema.createTable('leads', table => {
      table.increments('id').primary();
      table.string('nome_cliente', 255).notNullable();
      table.string('nome_clinica', 255).nullable();
      table.string('email', 255).nullable();
      table.string('telefone', 50).nullable();
      table.string('origem', 100).nullable(); // Google, Instagram, Indicação, WhatsApp, Outbound, etc.
      table.string('status', 50).defaultTo('Novo'); // Novo, Em Contato, Qualificado, Reunião Agendada, Proposta Enviada, Ganho, Perdido
      table.decimal('valor_estimado', 15, 2).defaultTo(0);
      table.string('cargo', 100).nullable(); // Sócio, Gerente, etc.
      table.integer('criado_por').nullable(); // ID do usuario que cadastrou
      table.integer('vendedor_id').nullable(); // ID do usuario responsavel
      table.integer('proposta_id').nullable(); // ID da proposta gerada a partir do lead
      table.timestamp('criado_em').defaultTo(knex.fn.now());
      table.timestamp('atualizado_em').defaultTo(knex.fn.now());
    });
  }

  // 2. Tabela lead_comentarios (timeline/atividades do lead)
  if (!(await knex.schema.hasTable('lead_comentarios'))) {
    await knex.schema.createTable('lead_comentarios', table => {
      table.increments('id').primary();
      table.integer('lead_id').notNullable();
      table.integer('usuario_id').notNullable();
      table.text('comentario').notNullable();
      table.string('tipo', 50).defaultTo('comentario'); // comentario, historico
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('lead_comentarios');
  await knex.schema.dropTableIfExists('leads');
};
