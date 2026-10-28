exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  // 1. Atualizar para todas as empresas (FINORA, CONTABIL, etc)
  await knex('regras_precificacao')
    .where('codigo', 'like', 'contabil%')
    .update({
      nome: 'Assessoria Contábil/Fiscal PJ',
      tipo: 'Mensal'
    });

  await knex('regras_precificacao')
    .where('codigo', 'like', 'fiscal%')
    .update({
      nome: 'Assessoria Contábil/Fiscal PF',
      tipo: 'Mensal'
    });

  await knex('regras_precificacao')
    .where('codigo', 'like', 'bpo%')
    .update({
      tipo: 'Mensal'
    });

  await knex('regras_precificacao')
    .whereIn('codigo', ['regulatorio', 'alvara', 'cro', 'AVS', 'AVS_contabil', 'regulatorio_contabil', 'cro_contabil'])
    .orWhere('nome', 'like', '%Alvará%')
    .update({
      tipo: 'Pontual'
    });
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  await knex('regras_precificacao')
    .where('codigo', 'like', 'contabil%')
    .update({
      nome: 'Assessoria Contábil',
      tipo: 'Mensal'
    });

  await knex('regras_precificacao')
    .where('codigo', 'like', 'fiscal%')
    .update({
      nome: 'Assessoria Fiscal',
      tipo: 'Mensal'
    });
};
