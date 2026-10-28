exports.up = async function(knex) {
  // 1. Tabela usuarios
  if (!(await knex.schema.hasTable('usuarios'))) {
    await knex.schema.createTable('usuarios', table => {
      table.increments('id').primary();
      table.string('nome', 255).notNullable();
      table.string('email', 255).notNullable().unique();
      table.string('senha_hash', 255).notNullable();
      table.string('role', 50).notNullable();
      table.integer('ativo').defaultTo(1);
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 2. Tabela propostas
  if (!(await knex.schema.hasTable('propostas'))) {
    await knex.schema.createTable('propostas', table => {
      table.increments('id').primary();
      table.string('token_acesso', 255).notNullable();
      table.string('numero_proposta', 50).notNullable();
      table.date('data_proposta').notNullable();
      table.string('nome_clinica', 255);
      table.string('razao_social', 255);
      table.string('cnpj', 30);
      table.string('nome_socio', 255);
      table.string('cpf_socio', 30);
      table.string('email', 255).notNullable();
      table.string('telefone', 50);
      table.text('endereco_clinica');
      table.integer('cadeiras');
      table.integer('funcionarios');
      table.integer('socios');
      table.decimal('faturamento', 15, 2);
      table.string('regime_fiscal', 100);
      table.string('regime_hibrido', 10);
      table.integer('distancia_km');
      table.integer('metragem');
      table.decimal('valor_total', 15, 2).notNullable();
      table.json('itens_json');
      table.string('status', 50).defaultTo('Pendente');
      table.integer('criado_por');
      table.integer('proposta_pai_id').nullable();
      table.string('empresa_proposta', 100);
      table.string('tipo_proposta', 100);
      table.decimal('percentual_desconto', 5, 2).nullable();
      table.decimal('valor_desconto', 15, 2).nullable();
      table.string('ip_assinatura', 50).nullable();
      table.timestamp('data_decisao').nullable();
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 3. Tabela proposta_itens
  if (!(await knex.schema.hasTable('proposta_itens'))) {
    await knex.schema.createTable('proposta_itens', table => {
      table.increments('id').primary();
      table.integer('proposta_id').notNullable();
      table.string('servico', 255).notNullable();
      table.text('observacao');
      table.string('tipo', 50);
      table.decimal('valor', 15, 2).notNullable();
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 4. Tabela solicitacoes_desconto
  if (!(await knex.schema.hasTable('solicitacoes_desconto'))) {
    await knex.schema.createTable('solicitacoes_desconto', table => {
      table.increments('id').primary();
      table.integer('proposta_id').notNullable();
      table.integer('solicitado_por').notNullable();
      table.decimal('percentual_solicitado', 5, 2).notNullable();
      table.text('justificativa');
      table.string('status', 50).defaultTo('Pendente');
      table.integer('aprovado_por').nullable();
      table.timestamp('data_resposta').nullable();
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 5. Tabela solicitacoes_desconto_item
  if (!(await knex.schema.hasTable('solicitacoes_desconto_item'))) {
    await knex.schema.createTable('solicitacoes_desconto_item', table => {
      table.increments('id').primary();
      table.integer('proposta_id').notNullable();
      table.integer('solicitado_por').notNullable();
      table.json('descontos_json').notNullable();
      table.text('justificativa');
      table.string('status', 50).defaultTo('Pendente');
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 6. Tabela proposta_observacoes
  if (!(await knex.schema.hasTable('proposta_observacoes'))) {
    await knex.schema.createTable('proposta_observacoes', table => {
      table.increments('id').primary();
      table.integer('proposta_id').notNullable();
      table.integer('usuario_id').notNullable();
      table.text('observacao').notNullable();
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  // 7. Tabela proposta_visualizacoes
  if (!(await knex.schema.hasTable('proposta_visualizacoes'))) {
    await knex.schema.createTable('proposta_visualizacoes', table => {
      table.increments('id').primary();
      table.integer('proposta_id').notNullable();
      table.string('ip', 50);
      table.text('user_agent');
      table.timestamp('visualizado_em').defaultTo(knex.fn.now());
    });
  }

  // 8. Tabela regras_precificacao
  if (!(await knex.schema.hasTable('regras_precificacao'))) {
    await knex.schema.createTable('regras_precificacao', table => {
      table.increments('id').primary();
      table.string('codigo', 100).notNullable().unique();
      table.string('nome', 255).notNullable();
      table.decimal('valor_base', 15, 2).notNullable();
      table.integer('ativo').defaultTo(1);
      table.text('descricao');
      table.string('empresa', 100);
      table.string('tipo', 50);
      table.string('categoria', 100);
      table.string('modo_calculo', 50).defaultTo('fixo');
      table.string('campo_quantidade', 100).nullable();
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  // Para rollback seguro, em prod geralmente evitamos deletar tabelas inteiras
  // Mas definimos o rollback padrão para ambientes de teste locais
  await knex.schema.dropTableIfExists('regras_precificacao');
  await knex.schema.dropTableIfExists('proposta_visualizacoes');
  await knex.schema.dropTableIfExists('proposta_observacoes');
  await knex.schema.dropTableIfExists('solicitacoes_desconto_item');
  await knex.schema.dropTableIfExists('solicitacoes_desconto');
  await knex.schema.dropTableIfExists('proposta_itens');
  await knex.schema.dropTableIfExists('propostas');
  await knex.schema.dropTableIfExists('usuarios');
};
