require("./exigir-env-test");
const db = require("../config/db");
// dotenv já carregado por exigir-env-test (.env.test)

async function cleanup() {
  try {
    await db.query("SET FOREIGN_KEY_CHECKS = 0");

    const [propRows] = await db.query(
      "SELECT id FROM propostas WHERE email = 'test_clinic@qmax.com'"
    );

    if (propRows.length > 0) {
      const ids = propRows.map(r => r.id);
      const ph = ids.map(() => "?").join(",");
      await db.query("DELETE FROM proposta_itens WHERE proposta_id IN (" + ph + ")", ids);
      await db.query("DELETE FROM solicitacoes_desconto WHERE proposta_id IN (" + ph + ")", ids);
      await db.query("DELETE FROM propostas WHERE id IN (" + ph + ")", ids);
      console.log(ids.length + " proposta(s) de teste apagadas. IDs: " + ids.join(","));
    } else {
      console.log("Nenhuma proposta de teste encontrada.");
    }

    const [u] = await db.query(
      "DELETE FROM usuarios WHERE email IN ('test_dir@qmax.com', 'test_com@qmax.com')"
    );
    console.log(u.affectedRows + " usuario(s) de teste apagados.");

    await db.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("Banco limpo com sucesso!");
  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    await db.end();
  }
}

cleanup();
