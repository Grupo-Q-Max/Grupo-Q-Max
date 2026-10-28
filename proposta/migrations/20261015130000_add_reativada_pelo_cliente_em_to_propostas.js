// Cliente pode reativar a proposta pelo link público uma única vez; depois só o consultor.
// NULL = nunca reativada pelo cliente.
exports.up = function (knex) {
  return knex.schema.table("propostas", (table) => {
    table.dateTime("reativada_pelo_cliente_em").nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.table("propostas", (table) => {
    table.dropColumn("reativada_pelo_cliente_em");
  });
};
