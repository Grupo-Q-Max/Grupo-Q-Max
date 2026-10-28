// propostas.validade_inicia_em: início da validade atual de 10 dias. NULL = conta de criado_em.
//   Atualizado quando o cliente reativa pelo link (uma vez) ou o consultor renova pelo dashboard.
//   reativada_pelo_cliente_em continua sendo só a marca de "cliente já reativou".
//   Backfill: propostas já reativadas pelo cliente começam a validade na reativação (regra da fase 5).
// usuarios.telefone: WhatsApp/vCard do consultor na página do cliente. Opcional (NULL = sem telefone).
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn("propostas", "validade_inicia_em"))) {
    await knex.schema.table("propostas", (t) => t.dateTime("validade_inicia_em").nullable());
    await knex("propostas")
      .whereNotNull("reativada_pelo_cliente_em")
      .update({ validade_inicia_em: knex.ref("reativada_pelo_cliente_em") });
  }
  if (!(await knex.schema.hasColumn("usuarios", "telefone"))) {
    await knex.schema.table("usuarios", (t) => t.string("telefone", 20).nullable());
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn("propostas", "validade_inicia_em")) {
    await knex.schema.table("propostas", (t) => t.dropColumn("validade_inicia_em"));
  }
  if (await knex.schema.hasColumn("usuarios", "telefone")) {
    await knex.schema.table("usuarios", (t) => t.dropColumn("telefone"));
  }
};
