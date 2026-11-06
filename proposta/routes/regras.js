const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verificarToken, verificarRole } = require("../middleware/auth");
const cacheService = require("../services/cacheService");
const { carregarRegrasPrecificacao } = require("../services/precoService");
const d4signService = require("../services/d4signService");
const loggerService = require("../services/loggerService");
const notificationService = require("../services/notificationService");

// --- GET ALL REGRAS PRECIFICACAO ---
router.get("/api/regras-precificacao", verificarToken, async (req, res, next) => {
  try {
    res.json(await carregarRegrasPrecificacao());
  } catch (error) {
    next(error);
  }
});

// --- UPDATE REGRA PRECIFICACAO ---
router.put(
  "/api/regras-precificacao/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      // Atualização parcial: cada tela do admin manda só os campos que edita.
      // Antes o UPDATE regravava todas as colunas e zerava preço PF/PJ, empresa e multiplicadores omitidos.
      const valorOuNulo = (v) => (v !== null && v !== "" ? Number(v) : null);
      const normalizar = {
        nome: (v) => String(v).trim(),
        tipo: (v) => v,
        valor_base: (v) => Number(v || 0),
        valor_base_pf: valorOuNulo,
        valor_base_pj: valorOuNulo,
        valor_base_hibrido: valorOuNulo,
        ativo: (v) => (v ? 1 : 0),
        descricao: (v) => v || "",
        empresa: (v) => v || "FINORA",
        categoria: (v) => v || "Servico",
        modo_calculo: (v) => v || "fixo",
        campo_quantidade: (v) => v || null,
        multiplica_cadeiras: (v) => (v ? 1 : 0),
        multiplica_faturamento: (v) => (v ? 1 : 0),
        multiplica_hibrido: (v) => (v ? 1 : 0),
      };
      const campos = Object.keys(normalizar).filter((c) => req.body[c] !== undefined);
      if (campos.length === 0) {
        return res.status(400).json({ error: "Nenhum campo para atualizar." });
      }
      if (campos.includes("nome") && !String(req.body.nome).trim()) {
        return res.status(400).json({ error: "Nome não pode ficar vazio." });
      }
      if (campos.includes("tipo") && !req.body.tipo) {
        return res.status(400).json({ error: "Tipo não pode ficar vazio." });
      }
      const numericos = ["valor_base", "valor_base_pf", "valor_base_pj", "valor_base_hibrido"];
      if (campos.filter((c) => numericos.includes(c)).some((c) => Number.isNaN(normalizar[c](req.body[c])))) {
        return res.status(400).json({ error: "Valor inválido." });
      }

      const [resultado] = await db.execute(
        `UPDATE regras_precificacao SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
        [...campos.map((c) => normalizar[c](req.body[c])), req.params.id],
      );
      if (resultado.affectedRows === 0) {
        return res.status(404).json({ error: "Regra de precificação não encontrada." });
      }

      cacheService.del("regras_precificacao");
      res.json({
        success: true,
        message: "Regra de precificação atualizada com sucesso.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// --- CREATE REGRA PRECIFICACAO ---
router.post(
  "/api/regras-precificacao",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const {
        codigo,
        nome,
        tipo,
        valor_base,
        valor_base_pf,
        valor_base_pj,
        valor_base_hibrido,
        categoria,
        descricao,
        empresa,
        modo_calculo,
        campo_quantidade,
      } = req.body;
      if (!codigo || !nome || !tipo || valor_base === undefined) {
        return res.status(400).json({
          error: "Código, nome, tipo e valor base são obrigatórios.",
        });
      }

      await db.transacao(async (conexao) => {
        await conexao.execute(
          `INSERT INTO regras_precificacao
            (codigo, nome, tipo, valor_base, valor_base_pf, valor_base_pj, valor_base_hibrido, descricao, empresa, categoria, modo_calculo, campo_quantidade)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            codigo.trim(),
            nome.trim(),
            tipo,
            Number(valor_base || 0),
            valor_base_pf !== undefined && valor_base_pf !== null && valor_base_pf !== "" ? Number(valor_base_pf) : null,
            valor_base_pj !== undefined && valor_base_pj !== null && valor_base_pj !== "" ? Number(valor_base_pj) : null,
            valor_base_hibrido !== undefined && valor_base_hibrido !== null && valor_base_hibrido !== "" ? Number(valor_base_hibrido) : null,
            descricao || "",
            empresa || "FINORA",
            categoria || "Servico",
            modo_calculo || "fixo",
            campo_quantidade || null,
          ],
        );

        await conexao.execute(
          `INSERT INTO servicos_proposta (nome, tipo) VALUES (?, ?)`,
          [nome.trim(), tipo],
        );
      });

      cacheService.del("regras_precificacao");
      res.json({
        success: true,
        message: "Serviço criado com sucesso.",
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Já existe uma regra com esse código.",
        });
      }
      next(error);
    }
  },
);

// --- CREATE TOPICO ---
router.post(
  "/api/config/topicos",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { titulo, texto, ordem } = req.body;
      if (!titulo || !texto) {
        return res.status(400).json({
          error: "Título e texto são obrigatórios.",
        });
      }

      await db.execute(
        `INSERT INTO topicos_pdf (titulo, texto, ordem, ativo) VALUES (?, ?, ?, 1)`,
        [titulo.trim(), texto.trim(), Number(ordem || 0)],
      );

      cacheService.del("topicos_pdf");
      res.json({
        success: true,
        message: "Tópico criado com sucesso.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// --- GET ALL TOPICOS ---
router.get("/api/config/topicos", verificarToken, async (req, res, next) => {
  try {
    const topicos = await cacheService.getOrSet("topicos_pdf", async () => {
      return await db.executarQuery(
        `SELECT id, titulo, texto, ordem, ativo FROM topicos_pdf WHERE ativo = 1 ORDER BY ordem ASC, id ASC`
      );
    }, 600);
    res.json(topicos);
  } catch (error) {
    next(error);
  }
});

// --- UPDATE TOPICO ---
router.put(
  "/api/config/topicos/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { titulo, texto, ordem } = req.body;

      if (!titulo || !texto) {
        return res.status(400).json({ error: "Título e texto são obrigatórios." });
      }

      const [resultado] = await db.execute(
        `UPDATE topicos_pdf SET titulo = ?, texto = ?, ordem = ? WHERE id = ?`,
        [titulo.trim(), texto.trim(), Number(ordem || 0), id]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ error: "Tópico não encontrado." });
      }

      cacheService.del("topicos_pdf");
      res.json({ success: true, message: "Tópico atualizado com sucesso." });
    } catch (error) {
      next(error);
    }
  }
);

// --- DELETE TOPICO ---
router.delete(
  "/api/config/topicos/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const [resultado] = await db.execute(
        `UPDATE topicos_pdf SET ativo = 0 WHERE id = ?`,
        [id]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ error: "Tópico não encontrado." });
      }

      cacheService.del("topicos_pdf");
      res.json({ success: true, message: "Tópico removido com sucesso." });
    } catch (error) {
      next(error);
    }
  }
);

// --- GET ALL REGRAS CALCULO ---
router.get("/api/regras-calculo", verificarToken, async (req, res, next) => {
  try {
    const regras = await db.executarQuery(`SELECT 
      id, 
      codigo, 
      nome, 
      descricao, 
      tipo, 
      ativo,
      campo_base,
      operador,
      valor_comparacao,
      fator
    FROM regras_calculo
    WHERE ativo = 1
    ORDER BY nome ASC
    `);
    res.json(regras);
  } catch (error) {
    next(error);
  }
});

// --- DELETE REGRA PRECIFICACAO ---
router.delete(
  "/api/regras-precificacao/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      await db.execute(
        `UPDATE regras_precificacao SET ativo = 0 WHERE id = ?`,
        [req.params.id],
      );
      res.json({
        success: true,
        message: "Serviço removido com sucesso.",
      });
    } catch (error) {
      next(error);
    }
  },
);

// --- GET VINCS REGRAS PRECIFICACAO ---
router.get(
  "/api/regras-precificacao/:id/regras",
  verificarToken,
  async (req, res, next) => {
    try {
      const regras = await db.executarQuery(
        `SELECT 
          rc.id,
          rc.codigo,
          rc.nome,
          rc.descricao,
          rc.tipo,
          rc.campo_base,
          rc.operador,
          rc.valor_comparacao,
          rc.fator,
          COALESCE(src.ativo, 0) AS vinculado
        FROM regras_calculo rc
        LEFT JOIN servico_regra_calculo src
          ON src.regra_calculo_id = rc.id
          AND src.regra_precificacao_id = ?
        WHERE rc.ativo = 1
        ORDER BY rc.nome ASC`,
        [req.params.id],
      );
      res.json(regras);
    } catch (error) {
      next(error);
    }
  },
);

// --- VINCULATE REGRA CALCULO ---
router.post(
  "/api/regras-precificacao/:id/regras/:regraId",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { ativo } = req.body;
      const existente = await db.executarQuery(
        `SELECT id FROM servico_regra_calculo WHERE regra_precificacao_id = ? AND regra_calculo_id = ?`,
        [req.params.id, req.params.regraId],
      );

      if (existente.length > 0) {
        await db.execute(
          `UPDATE servico_regra_calculo SET ativo = ? WHERE regra_precificacao_id = ? AND regra_calculo_id = ?`,
          [ativo ? 1 : 0, req.params.id, req.params.regraId],
        );
      } else {
        await db.execute(
          `INSERT INTO servico_regra_calculo (regra_precificacao_id, regra_calculo_id, ativo) VALUES (?, ?, ?)`,
          [req.params.id, req.params.regraId, ativo ? 1 : 0],
        );
      }

      res.json({ success: true, message: "Regra atualizada com sucesso." });
    } catch (error) {
      next(error);
    }
  },
);

// --- CREATE REGRA CALCULO ---
router.post(
  "/api/regras-calculo",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const {
        codigo,
        nome,
        descricao,
        campo_base,
        operador,
        valor_comparacao,
        fator,
      } = req.body;
      if (!codigo || !nome) {
        return res.status(400).json({
          error: "Código e nome da regra são obrigatórios.",
        });
      }

      await db.execute(
        `INSERT INTO regras_calculo
          (codigo, nome, descricao, tipo, ativo, campo_base, operador, valor_comparacao, fator)
        VALUES (?, ?, ?, 'multiplicador', 1, ?, ?, ?, ?)`,
        [
          codigo.trim(),
          nome.trim(),
          descricao ? descricao.trim() : "",
          campo_base || null,
          operador || null,
          Number(valor_comparacao || 0),
          Number(fator || 1),
        ],
      );
      res.json({
        success: true,
        message: "Regra criada com sucesso.",
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          error: "Já existe uma regra com esse código.",
        });
      }
      next(error);
    }
  },
);

// --- GET TECH PLANOS ---
router.get("/api/tech-planos", verificarToken, async (req, res, next) => {
  try {
    const planos = await db.executarQuery(`SELECT id, codigo, nome, valor_implantacao, valor_mensalidade, ativo
      FROM tech_planos WHERE ativo = 1 ORDER BY id ASC`);

    const servicos = await db.executarQuery(`SELECT plano_id, servico FROM tech_plano_servicos ORDER BY id ASC`);

    const resultado = planos.map((plano) => ({
      ...plano,
      servicos: servicos
        .filter((s) => Number(s.plano_id) === Number(plano.id))
        .map((s) => s.servico),
    }));

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// --- CREATE TECH PLAN ---
router.post(
  "/api/tech-planos",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { codigo, nome, valor_implantacao, valor_mensalidade, servicos } = req.body;
      if (!codigo || !nome) {
        return res.status(400).json({ error: "Código e nome do plano são obrigatórios." });
      }

      await db.transacao(async (conexao) => {
        const [resultado] = await conexao.execute(
          `INSERT INTO tech_planos (codigo, nome, valor_implantacao, valor_mensalidade, ativo) VALUES (?, ?, ?, ?, 1)`,
          [codigo.trim(), nome.trim(), Number(valor_implantacao || 0), Number(valor_mensalidade || 0)],
        );

        const planoId = resultado.insertId;
        const listaServicos = Array.isArray(servicos) ? servicos : [];

        for (const servico of listaServicos) {
          if (!servico || !servico.trim()) continue;
          await conexao.execute(
            `INSERT INTO tech_plano_servicos (plano_id, servico) VALUES (?, ?)`,
            [planoId, servico.trim()],
          );
        }
      });

      res.json({ success: true, message: "Plano Tech criado com sucesso." });
    } catch (error) {
      next(error);
    }
  },
);

// --- UPDATE TECH PLAN ---
router.put(
  "/api/tech-planos/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { codigo, nome, valor_implantacao, valor_mensalidade, servicos } = req.body;
      if (!codigo || !nome) {
        return res.status(400).json({ error: "Código e nome do plano são obrigatórios." });
      }

      await db.transacao(async (conexao) => {
        await conexao.execute(
          `UPDATE tech_planos SET codigo = ?, nome = ?, valor_implantacao = ?, valor_mensalidade = ? WHERE id = ?`,
          [codigo.trim(), nome.trim(), Number(valor_implantacao || 0), Number(valor_mensalidade || 0), req.params.id],
        );

        await conexao.execute(`DELETE FROM tech_plano_servicos WHERE plano_id = ?`, [req.params.id]);

        const listaServicos = Array.isArray(servicos) ? servicos : [];
        for (const servico of listaServicos) {
          if (!servico || !servico.trim()) continue;
          await conexao.execute(
            `INSERT INTO tech_plano_servicos (plano_id, servico) VALUES (?, ?)`,
            [req.params.id, servico.trim()],
          );
        }
      });

      res.json({ success: true, message: "Plano Tech atualizado com sucesso." });
    } catch (error) {
      next(error);
    }
  },
);

// --- DELETE TECH PLAN ---
router.delete(
  "/api/tech-planos/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      await db.execute(`UPDATE tech_planos SET ativo = 0 WHERE id = ?`, [req.params.id]);
      res.json({ success: true, message: "Plano Tech removido com sucesso." });
    } catch (error) {
      next(error);
    }
  }
);

// --- GET SERVICOS E SEUS TOPICOS ---
router.get("/api/config/servicos-topicos", verificarToken, async (req, res, next) => {
  try {
    const dados = await db.executarQuery(`
      SELECT 
        s.id AS servico_id,
        s.nome AS servico_nome,
        s.tipo AS servico_tipo,
        st.topico_id,
        st.mostrar
      FROM servicos_proposta s
      LEFT JOIN servico_topico_pdf st ON st.servico_id = s.id
      WHERE s.ativo = 1
      ORDER BY s.nome ASC
    `);
    res.json(dados);
  } catch (error) {
    next(error);
  }
});

// --- POST VINCULAR SERVICO E TOPICO ---
router.post(
  "/api/config/servicos/:servicoId/topicos/:topicoId",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { servicoId, topicoId } = req.params;
      const { mostrar } = req.body;

      const existente = await db.executarQuery(
        `SELECT id FROM servico_topico_pdf WHERE servico_id = ? AND topico_id = ?`,
        [servicoId, topicoId]
      );

      if (existente.length > 0) {
        await db.execute(
          `UPDATE servico_topico_pdf SET mostrar = ? WHERE servico_id = ? AND topico_id = ?`,
          [mostrar ? 1 : 0, servicoId, topicoId]
        );
      } else {
        await db.execute(
          `INSERT INTO servico_topico_pdf (servico_id, topico_id, mostrar) VALUES (?, ?, ?)`,
          [servicoId, topicoId, mostrar ? 1 : 0]
        );
      }

      res.json({ success: true, message: "Vínculo do tópico atualizado com sucesso." });
    } catch (error) {
      next(error);
    }
  }
);

// Credenciais D4Sign nunca voltam ao navegador inteiras: a tela mostra a máscara e só grava valor novo
const CHAVES_SECRETAS = ["d4sign_token", "d4sign_secret", "oauth_refresh_token"];
const MASCARA_SEGREDO = "••••";
const mascarar = (valor) => (valor ? `${MASCARA_SEGREDO}${String(valor).slice(-4)}` : "");
const ehMascara = (valor) => typeof valor === "string" && valor.startsWith(MASCARA_SEGREDO);

// --- GET CONFIGURAÇÕES SISTEMA ---
router.get("/api/config/sistema", verificarToken, verificarRole(["Diretor"]), async (req, res, next) => {
  try {
    const config = await db.executarQuery(`SELECT chave, valor FROM configuracoes_sistema`);
    const result = {};
    config.forEach(row => {
      result[row.chave] = CHAVES_SECRETAS.includes(row.chave) ? mascarar(row.valor) : row.valor;
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// --- POST CONFIGURAÇÕES SISTEMA ---
router.post(
  "/api/config/sistema",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const body = req.body; // { chave: valor }
      for (const [chave, valor] of Object.entries(body)) {
        // Máscara devolvida pela tela sem edição: mantém o valor gravado
        if (CHAVES_SECRETAS.includes(chave) && ehMascara(valor)) continue;
        const existente = await db.executarQuery(
          `SELECT id FROM configuracoes_sistema WHERE chave = ?`,
          [chave]
        );
        if (existente.length > 0) {
          await db.execute(
            `UPDATE configuracoes_sistema SET valor = ?, atualizado_em = NOW() WHERE chave = ?`,
            [valor, chave]
          );
        } else {
          await db.execute(
            `INSERT INTO configuracoes_sistema (chave, valor) VALUES (?, ?)`,
            [chave, valor]
          );
        }
      }
      res.json({ success: true, message: "Configurações salvas com sucesso." });
    } catch (error) {
      next(error);
    }
  }
);

// --- TESTAR CONEXÃO D4SIGN ---
router.post(
  "/api/d4sign/testar-conexao",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      // Campos ainda mascarados: testa com a credencial gravada
      const corpo = { ...(req.body || {}) };
      if (ehMascara(corpo.token)) delete corpo.token;
      if (ehMascara(corpo.secret)) delete corpo.secret;
      const resultado = await d4signService.testarConexaoD4Sign(corpo);
      return res.json(resultado);
    } catch (error) {
      next(error);
    }
  }
);

// --- HEALTH CHECK DO SISTEMA & MONITORAMENTO ---
router.get(
  "/api/admin/health-check",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const inicioPing = Date.now();
      let statusDb = "ok";
      let latencyDb = 0;
      let totalPropostas = 0;
      let totalLeads = 0;

      try {
        const [rowsProp] = await db.execute("SELECT COUNT(*) AS total FROM propostas");
        totalPropostas = rowsProp[0]?.total || 0;
        const [rowsLead] = await db.execute("SELECT COUNT(*) AS total FROM leads");
        totalLeads = rowsLead[0]?.total || 0;
        latencyDb = Date.now() - inicioPing;
      } catch (dbErr) {
        statusDb = "erro";
        loggerService.registrarLog("error", "MySQL", `Erro no Health Check do MySQL: ${dbErr.message}`);
      }

      // Testar D4Sign
      let d4signStatus = "ok";
      let d4signMsg = "Conectado";
      try {
        const d4cfg = await d4signService.obterConfiguracoesD4Sign();
        if (!d4cfg.apiToken || d4cfg.apiToken.includes("placeholder")) {
          d4signStatus = "warning";
          d4signMsg = "Token de API pendente ou placeholder";
        }
      } catch (d4Err) {
        d4signStatus = "erro";
        d4signMsg = d4Err.message;
      }

      // Memory & Uptime
      const memUsage = process.memoryUsage();
      const uptimeSec = Math.floor(process.uptime());

      const statusGeral = {
        timestamp: new Date().toISOString(),
        uptime: uptimeSec,
        uptimeFormatted: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
        memoryRamMb: (memUsage.heapUsed / 1024 / 1024).toFixed(1),
        database: {
          status: statusDb,
          latencyMs: latencyDb,
          totalPropostas,
          totalLeads,
          host: process.env.DB_HOST || "localhost",
          port: process.env.DB_PORT || 3306
        },
        emailService: {
          status: "ok",
          account: process.env.EMAIL_USER || "envio@qmax.com.br",
          method: process.env.RESEND_API_KEY ? "Resend API" : "Microsoft Outlook OAuth2"
        },
        d4sign: {
          status: d4signStatus,
          message: d4signMsg,
          vault: process.env.D4SIGN_UUID_COFRE ? `${process.env.D4SIGN_UUID_COFRE.substring(0, 8)}...` : "Não definido"
        },
        realtimeClients: notificationService.getClientsCount ? notificationService.getClientsCount() : 0
      };

      loggerService.registrarLog("info", "HealthCheck", "Diagnóstico completo do sistema executado com sucesso.");
      res.json(statusGeral);
    } catch (error) {
      next(error);
    }
  }
);

// --- BUSCAR LOGS DO SISTEMA ---
router.get(
  "/api/admin/logs",
  verificarToken,
  verificarRole(["Diretor"]),
  (req, res) => {
    // level como array (?level=a&level=b) quebrava o toLowerCase e a requisição ficava pendurada
    const level = typeof req.query.level === "string" ? req.query.level : null;
    const limite = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);
    res.json(loggerService.obterLogs(level, limite));
  }
);

// --- LIMPAR LOGS DO SISTEMA ---
router.delete(
  "/api/admin/logs",
  verificarToken,
  verificarRole(["Diretor"]),
  (req, res) => {
    loggerService.limparLogs();
    loggerService.registrarLog("info", "Sistema", "Buffer de logs limpo pela diretoria.");
    res.json({ success: true, message: "Logs limpos com sucesso." });
  }
);

module.exports = router;
