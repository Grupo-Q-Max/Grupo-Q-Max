exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  // 1. Atualizar ou inserir Certificado Digital em Mensal
  const certExist = await knex('regras_precificacao').where('codigo', 'certificado').first();
  if (certExist) {
    await knex('regras_precificacao')
      .where('codigo', 'certificado')
      .update({
        nome: 'Certificado Digital',
        tipo: 'Mensal',
        empresa: 'FINORA',
        ativo: 1
      });
  } else {
    await knex('regras_precificacao').insert({
      codigo: 'certificado',
      nome: 'Certificado Digital',
      valor_base: 220,
      tipo: 'Mensal',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    });
  }

  // 2. Atualizar ou inserir Declaração IRPF em Mensal
  const irpfExist = await knex('regras_precificacao').where('codigo', 'declaracao_irpf').first();
  if (irpfExist) {
    await knex('regras_precificacao')
      .where('codigo', 'declaracao_irpf')
      .update({
        nome: 'Declaração IRPF',
        tipo: 'Mensal',
        empresa: 'FINORA',
        ativo: 1
      });
  } else {
    await knex('regras_precificacao').insert({
      codigo: 'declaracao_irpf',
      nome: 'Declaração IRPF',
      valor_base: 250,
      tipo: 'Mensal',
      empresa: 'FINORA',
      ativo: 1,
      categoria: 'Servico'
    });
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('regras_precificacao');
  if (!hasTable) return;

  await knex('regras_precificacao')
    .where('codigo', 'certificado')
    .update({
      tipo: 'Pontual'
    });

  await knex('regras_precificacao')
    .where('codigo', 'declaracao_irpf')
    .delete();
};
