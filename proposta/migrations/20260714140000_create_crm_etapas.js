exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('crm_etapas'))) {
    await knex.schema.createTable('crm_etapas', table => {
      table.increments('id').primary();
      table.string('nome', 100).notNullable();
      table.string('cor', 50).defaultTo('#94a3b8');
      table.integer('ordem').defaultTo(0);
      table.integer('ativo').defaultTo(1);
      table.timestamp('criado_em').defaultTo(knex.fn.now());
    });

    // Inserir as etapas iniciais padrão
    await knex('crm_etapas').insert([
      { nome: 'Novo', cor: '#3b82f6', ordem: 1, ativo: 1 },
      { nome: 'Em Contato', cor: '#8b5cf6', ordem: 2, ativo: 1 },
      { nome: 'Qualificado', cor: '#f59e0b', ordem: 3, ativo: 1 },
      { nome: 'Reunião', cor: '#ec4899', ordem: 4, ativo: 1 },
      { nome: 'Proposta', cor: '#10b981', ordem: 5, ativo: 1 },
      { nome: 'Ganho', cor: '#10b981', ordem: 6, ativo: 1 },
      { nome: 'Perdido', cor: '#ef4444', ordem: 7, ativo: 1 }
    ]);
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('crm_etapas');
};
