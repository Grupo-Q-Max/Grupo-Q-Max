exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  const servicosPontuais = [
    {
      codigo: 'diagnostico_obrigacoes',
      nome: 'Diagnóstico Obrigações Tributárias',
      valor_base: 1500.00,
      tipo: 'Pontual',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    },
    {
      codigo: 'regularizacao_cro',
      nome: 'Regularização CRO',
      valor_base: 800.00,
      tipo: 'Pontual',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    },
    {
      codigo: 'regularizacao_prefeitura',
      nome: 'Regularização Prefeitura',
      valor_base: 1000.00,
      tipo: 'Pontual',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    },
    {
      codigo: 'diagnostico_tributario_financeiro',
      nome: 'Diagnóstico Tributário/Financeiro',
      valor_base: 2500.00,
      tipo: 'Pontual',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    },
    {
      codigo: 'alvara',
      nome: 'Alvará',
      valor_base: 1200.00,
      tipo: 'Pontual',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    }
  ];

  for (const s of servicosPontuais) {
    const exist = await knex('regras_precificacao').where('codigo', s.codigo).first();
    if (exist) {
      await knex('regras_precificacao')
        .where('codigo', s.codigo)
        .update({
          nome: s.nome,
          tipo: 'Pontual',
          ativo: 1
        });
    } else {
      await knex('regras_precificacao').insert(s);
    }
  }

  // Garantir que CRO e Alvará legados fiquem como Pontual
  await knex('regras_precificacao')
    .whereIn('codigo', ['cro', 'regulatorio', 'AVS', 'cro_contabil', 'AVS_contabil', 'regulatorio_contabil'])
    .orWhere('nome', 'like', '%Alvará%')
    .orWhere('nome', 'like', '%CRO%')
    .update({
      tipo: 'Pontual'
    });
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  await knex('regras_precificacao')
    .whereIn('codigo', [
      'diagnostico_obrigacoes',
      'regularizacao_cro',
      'regularizacao_prefeitura',
      'diagnostico_tributario_financeiro',
      'alvara'
    ])
    .delete();
};
