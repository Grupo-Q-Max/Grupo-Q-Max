const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verificarToken, verificarRole } = require("../middleware/auth");

// --- FUNIS ---

// Listar todos os funis
router.get("/api/crm/funis", verificarToken, async (req, res, next) => {
  try {
    const funis = await db.executarQuery("SELECT * FROM crm_funis WHERE ativo = 1 ORDER BY id ASC");
    res.json({ success: true, funis });
  } catch (error) {
    next(error);
  }
});

// Criar um novo funil
router.post("/api/crm/funis", verificarToken, verificarRole(['Diretor']), async (req, res, next) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome do funil é obrigatório." });

    const novoFunilId = await db.transacao(async (conexao) => {
      const [result] = await conexao.query(
        "INSERT INTO crm_funis (nome, descricao, ativo) VALUES (?, ?, 1)",
        [nome, descricao || ""]
      );
      
      const novoFunilId = result.insertId;

      // Criar etapas padrões para o novo funil
      await conexao.query(
        "INSERT INTO crm_etapas (nome, cor, ordem, ativo, funil_id) VALUES (?, ?, ?, ?, ?)",
        ['Novo', '#3b82f6', 1, 1, novoFunilId]
      );
      await conexao.query(
        "INSERT INTO crm_etapas (nome, cor, ordem, ativo, funil_id) VALUES (?, ?, ?, ?, ?)",
        ['Ganho', '#10b981', 2, 1, novoFunilId]
      );
      await conexao.query(
        "INSERT INTO crm_etapas (nome, cor, ordem, ativo, funil_id) VALUES (?, ?, ?, ?, ?)",
        ['Perdido', '#ef4444', 3, 1, novoFunilId]
      );
      return novoFunilId;
    });

    res.json({ success: true, message: "Funil criado com sucesso!", funil_id: novoFunilId });
  } catch (error) {
    next(error);
  }
});

// Editar funil
router.put("/api/crm/funis/:id", verificarToken, verificarRole(['Diretor']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome do funil é obrigatório." });

    const resultado = await db.executarQuery(
      "UPDATE crm_funis SET nome = ?, descricao = ? WHERE id = ?",
      [nome, descricao || "", id]
    );
    if (resultado.affectedRows === 0) return res.status(404).json({ error: "Funil não encontrado." });
    res.json({ success: true, message: "Funil atualizado com sucesso!" });
  } catch (error) {
    next(error);
  }
});

// Desativar / Excluir funil
router.delete("/api/crm/funis/:id", verificarToken, verificarRole(['Diretor']), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (Number(id) === 1) {
      return res.status(400).json({ error: "O funil principal padrão (ID 1) não pode ser desativado." });
    }

    const resultado = await db.executarQuery(
      "UPDATE crm_funis SET ativo = 0 WHERE id = ?",
      [id]
    );
    if (resultado.affectedRows === 0) return res.status(404).json({ error: "Funil não encontrado." });
    res.json({ success: true, message: "Funil desativado com sucesso!" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
