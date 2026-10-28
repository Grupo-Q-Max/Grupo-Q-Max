/**
 * Corrige colunas ENUM restritas para VARCHAR(50) permitindo novos ecossistemas e status 'Aguardando Aprovação'
 */
exports.up = async function up(knex) {
  await knex.raw("ALTER TABLE propostas MODIFY COLUMN status VARCHAR(50) DEFAULT 'Pendente'");
  await knex.raw("ALTER TABLE propostas MODIFY COLUMN empresa_proposta VARCHAR(50) DEFAULT 'FINORA'");
  await knex.raw("ALTER TABLE regras_precificacao MODIFY COLUMN empresa VARCHAR(50) DEFAULT 'FINORA'");
};

exports.down = async function down(knex) {
  await knex.raw("ALTER TABLE propostas MODIFY COLUMN status ENUM('Pendente','Aprovada','Recusada') DEFAULT 'Pendente'");
  await knex.raw("ALTER TABLE propostas MODIFY COLUMN empresa_proposta ENUM('FINORA','QMAX','TECH') DEFAULT 'FINORA'");
  await knex.raw("ALTER TABLE regras_precificacao MODIFY COLUMN empresa ENUM('FINORA','CONTABIL','TECH') DEFAULT 'FINORA'");
};
