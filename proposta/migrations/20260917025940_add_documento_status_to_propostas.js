exports.up = function(knex) {
  return knex.schema.table('propostas', function(table) {
    table.string('documento_status').nullable().defaultTo('ATIVA');
  });
};

exports.down = function(knex) {
  return knex.schema.table('propostas', function(table) {
    table.dropColumn('documento_status');
  });
};
