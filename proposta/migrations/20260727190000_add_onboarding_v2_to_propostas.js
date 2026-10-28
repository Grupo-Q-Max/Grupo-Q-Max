/**
 * Campos do onboarding V2 e armazenamento seguro do certificado digital.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable("propostas", (table) => {
    table.string("tipo_pessoa", 2).notNullable().defaultTo("PJ");
table.string("pro_labore", 30).nullable().defaultTo("Não");    table.integer("dentistas_parceiros").unsigned().notNullable().defaultTo(0);
    table.integer("quantidade_socios").unsigned().notNullable().defaultTo(0);
    table.json("socios_detalhados_json").nullable();
    table.string("certificado_status", 3).notNullable().defaultTo("Não");
    table.string("certificado_nome_original", 255).nullable();
    table.string("certificado_caminho", 255).nullable();
    table.text("certificado_senha_criptografada").nullable();
    table.timestamp("certificado_enviado_em").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("propostas", (table) => {
    table.dropColumns(
      "tipo_pessoa", "pro_labore", "dentistas_parceiros", "quantidade_socios",
      "socios_detalhados_json", "certificado_status", "certificado_nome_original",
      "certificado_caminho", "certificado_senha_criptografada", "certificado_enviado_em"
    );
  });
};
