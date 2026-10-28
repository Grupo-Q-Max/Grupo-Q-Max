exports.up = async function(knex) {
  // 1. Criar Tabela crm_funis
  if (!(await knex.schema.hasTable('crm_funis'))) {
    await knex.schema.createTable('crm_funis', table => {
      table.increments('id').primary();
      table.string('nome', 100).notNullable();
      table.string('descricao', 255).nullable();
      table.integer('ativo').defaultTo(1);
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });

    // Inserir o Funil Principal
    await knex('crm_funis').insert([
      { id: 1, nome: 'Funil Comercial Principal', descricao: 'Funil principal de vendas', ativo: 1 }
    ]);
  }

  // 2. Adicionar funil_id em crm_etapas
  if (await knex.schema.hasTable('crm_etapas')) {
    const hasFunilCol = await knex.schema.hasColumn('crm_etapas', 'funil_id');
    if (!hasFunilCol) {
      await knex.schema.table('crm_etapas', table => {
        table.integer('funil_id').unsigned().defaultTo(1);
      });
    }
  }

  // 3. Adicionar funil_id em leads
  if (await knex.schema.hasTable('leads')) {
    const hasFunilColLeads = await knex.schema.hasColumn('leads', 'funil_id');
    if (!hasFunilColLeads) {
      await knex.schema.table('leads', table => {
        table.integer('funil_id').unsigned().defaultTo(1);
      });
    }
  }

  // 4. Criar Tabela crm_automacoes
  if (!(await knex.schema.hasTable('crm_automacoes'))) {
    await knex.schema.createTable('crm_automacoes', table => {
      table.increments('id').primary();
      table.integer('funil_id').unsigned().notNullable();
      table.string('etapa_destino_nome', 100).notNullable(); // A gente compara com dados.status
      table.string('tipo_acao', 50).notNullable(); // 'email', 'whatsapp', 'webhook'
      table.json('parametros').notNullable(); // Payload com subject, text, template_id, etc.
      table.integer('ativo').defaultTo(1);
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('leads')) {
    const hasFunilColLeads = await knex.schema.hasColumn('leads', 'funil_id');
    if (hasFunilColLeads) {
      await knex.schema.table('leads', table => {
        table.dropColumn('funil_id');
      });
    }
  }

  if (await knex.schema.hasTable('crm_etapas')) {
    const hasFunilCol = await knex.schema.hasColumn('crm_etapas', 'funil_id');
    if (hasFunilCol) {
      await knex.schema.table('crm_etapas', table => {
        table.dropColumn('funil_id');
      });
    }
  }

  await knex.schema.dropTableIfExists('crm_automacoes');
  await knex.schema.dropTableIfExists('crm_funis');
};
