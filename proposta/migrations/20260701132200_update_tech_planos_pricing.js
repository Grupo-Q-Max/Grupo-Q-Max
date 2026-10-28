exports.up = async function(knex) {
  // Atualizar os valores da tabela tech_planos para coincidir com a soma acumulada da planilha
  await knex('tech_planos')
    .where('codigo', 'essencial')
    .update({
      valor_implantacao: 5470.00,
      valor_mensalidade: 1037.00
    });

  await knex('tech_planos')
    .where('codigo', 'performance')
    .update({
      valor_implantacao: 8470.00,
      valor_mensalidade: 1727.00
    });

  await knex('tech_planos')
    .where('codigo', 'autoridade')
    .update({
      valor_implantacao: 11470.00,
      valor_mensalidade: 2487.00
    });
};

exports.down = async function(knex) {
  // Voltar aos valores originais do mock
  await knex('tech_planos')
    .where('codigo', 'essencial')
    .update({
      valor_implantacao: 2500.00,
      valor_mensalidade: 497.00
    });

  await knex('tech_planos')
    .where('codigo', 'performance')
    .update({
      valor_implantacao: 4500.00,
      valor_mensalidade: 997.00
    });

  await knex('tech_planos')
    .where('codigo', 'autoridade')
    .update({
      valor_implantacao: 7900.00,
      valor_mensalidade: 1497.00
    });
};
