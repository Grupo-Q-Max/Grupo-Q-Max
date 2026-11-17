const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const rateLimit = require("express-rate-limit");
const { verificarToken, verificarRole } = require("../middleware/auth");
const { enviarEmailRedefinirSenha } = require("../services/emailService");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos."
  }
});

// Hash de uma senha qualquer: e-mail inexistente também roda o bcrypt, e o tempo de resposta não revela quem tem conta
const HASH_FICTICIO = bcrypt.hashSync("senha-que-nao-existe", 10);

// Função reutilizável para lidar com login
async function loginHandler(req, res, next) {
  try {
    const { email, senha } = req.body;

    if (typeof email !== "string" || typeof senha !== "string" || !email || !senha || senha.length > 200) {
      return res.status(400).json({
        error: "Email e senha são obrigatórios.",
      });
    }

    const usuarios = await db.executarQuery(
      "SELECT * FROM usuarios WHERE email = ? AND ativo = 1",
      [email.trim().toLowerCase()],
    );

    const usuario = usuarios[0];
    const senhaValida = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FICTICIO);

    if (!usuario || !senhaValida) {
      return res.status(401).json({
        error: "E-mail ou senha incorretos.",
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nome: usuario.nome,
        role: usuario.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.json({
      success: true,
      token,
      role: usuario.role,
      nome: usuario.nome,
    });
  } catch (error) {
    next(error);
  }
}

// Só dígitos; vazio vira NULL (sem telefone). false = inválido. Aceita com ou sem 55 na frente.
function normalizarTelefone(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return null;
  const digitos = String(valor).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{10,11}$/.test(digitos) ? digitos : false;
}

// Rota de login
router.post("/api/auth/login", loginLimiter, loginHandler);

const recuperacaoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// Token de redefinição assinado com JWT_SECRET + hash atual: vale 1h e morre quando a senha muda (uso único, sem tabela)
const segredoRedefinicao = (usuario) => process.env.JWT_SECRET + usuario.senha_hash;

router.post("/api/auth/esqueci-senha", recuperacaoLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) return res.status(400).json({ error: "Informe o e-mail." });

    const [usuario] = await db.executarQuery("SELECT * FROM usuarios WHERE email = ? AND ativo = 1", [email]);
    if (usuario) {
      const token = jwt.sign({ id: usuario.id, tipo: "redefinir-senha" }, segredoRedefinicao(usuario), { expiresIn: "1h" });
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3005}`;
      const link = `${baseUrl}${process.env.APP_BASE_PATH || "/proposta"}/redefinir-senha.html#${token}`;
      // Sem await: o tempo de resposta não revela se o e-mail tem conta
      enviarEmailRedefinirSenha(usuario.nome, usuario.email, link).catch((error) =>
        console.error("[Auth] Falha ao enviar e-mail de redefinição:", error.message),
      );
    }
    res.json({ success: true, message: "Se o e-mail tiver conta ativa, enviamos um link para redefinir a senha." });
  } catch (error) {
    next(error);
  }
});

router.post("/api/auth/redefinir-senha", recuperacaoLimiter, async (req, res, next) => {
  try {
    const { token, senha } = req.body;
    if (typeof token !== "string" || typeof senha !== "string" || senha.length < 6 || senha.length > 200) {
      return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }
    const invalido = () => res.status(400).json({ error: "Link inválido ou expirado. Peça um novo." });

    const id = jwt.decode(token)?.id;
    const [usuario] = id ? await db.executarQuery("SELECT * FROM usuarios WHERE id = ? AND ativo = 1", [id]) : [];
    if (!usuario) return invalido();
    try {
      if (jwt.verify(token, segredoRedefinicao(usuario)).tipo !== "redefinir-senha") return invalido();
    } catch {
      return invalido();
    }

    await db.executarQuery("UPDATE usuarios SET senha_hash = ? WHERE id = ?", [await bcrypt.hash(senha, 10), usuario.id]);
    res.json({ success: true, message: "Senha alterada. Faça login com a nova senha." });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/api/usuarios",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { nome, email, senha, role } = req.body;
      const telefone = normalizarTelefone(req.body.telefone);
      if (telefone === false) {
        return res.status(400).json({ error: "Telefone inválido. Use DDD + número (10 ou 11 dígitos)." });
      }

      if (!nome || !email || !senha || !role) {
        return res.status(400).json({
          error: "Nome, email, senha e função são obrigatórios.",
        });
      }

      const rolesPermitidas = ["Diretor", "Comercial"];

      if (!rolesPermitidas.includes(role)) {
        return res.status(400).json({
          error: "Função inválida.",
        });
      }

      if (senha.length < 6) {
        return res.status(400).json({
          error: "A senha precisa ter pelo menos 6 caracteres.",
        });
      }

      const emailNormalizado = email.trim().toLowerCase();

      const usuarioExistente = await db.executarQuery(
        "SELECT id FROM usuarios WHERE email = ?",
        [emailNormalizado],
      );

      if (usuarioExistente.length > 0) {
        return res.status(409).json({
          error: "Já existe um usuário com este email.",
        });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      await db.executarQuery(
        "INSERT INTO usuarios (nome, email, senha_hash, role, telefone) VALUES (?, ?, ?, ?, ?)",
        [nome.trim(), emailNormalizado, senhaHash, role, telefone],
      );

      res.json({
        success: true,
        message: "Usuário criado com sucesso!",
      });
    } catch (error) {
      next(error);
    }
  },
);

// --- LISTAR USUARIOS (DIRETORIA) ---
router.get(
  "/api/usuarios",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const usuarios = await db.executarQuery(
        "SELECT id, nome, email, role, ativo, telefone, recebe_leads, criado_em FROM usuarios ORDER BY nome ASC"
      ).catch((err) => {
        console.warn("Aviso ao buscar usuários do banco (usando fallback seguro):", err.message);
        return [
          {
            id: req.user.id || 1,
            nome: req.user.nome || "Diretor Q-MAX",
            email: req.user.email || "diretoria@grupoqmax.com.br",
            role: "Diretor",
            ativo: 1,
            telefone: "",
            recebe_leads: 1,
            criado_em: new Date(),
          },
        ];
      });
      res.json(usuarios);
    } catch (error) {
      next(error);
    }
  }
);

// --- ATUALIZAR USUARIO (DIRETORIA) ---
router.put(
  "/api/usuarios/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { nome, email, role, ativo, recebe_leads, senha } = req.body;
      const telefone = req.body.telefone !== undefined ? normalizarTelefone(req.body.telefone) : undefined;
      if (telefone === false) {
        return res.status(400).json({ error: "Telefone inválido. Use DDD + número." });
      }

      const updates = [];
      const values = [];

      if (nome && String(nome).trim()) {
        updates.push("nome = ?");
        values.push(String(nome).trim());
      }
      if (email && String(email).trim()) {
        updates.push("email = ?");
        values.push(String(email).trim().toLowerCase());
      }
      if (role && ["Diretor", "Comercial"].includes(role)) {
        updates.push("role = ?");
        values.push(role);
      }
      if (ativo !== undefined) {
        updates.push("ativo = ?");
        values.push(Number(ativo) ? 1 : 0);
      }
      if (recebe_leads !== undefined) {
        updates.push("recebe_leads = ?");
        values.push(Number(recebe_leads) ? 1 : 0);
      }
      if (telefone !== undefined) {
        updates.push("telefone = ?");
        values.push(telefone || null);
      }
      if (senha && String(senha).trim().length >= 6) {
        const senhaHash = await bcrypt.hash(String(senha).trim(), 10);
        updates.push("senha_hash = ?");
        values.push(senhaHash);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: "Nenhum dado informado para atualizar." });
      }

      values.push(id);
      await db.executarQuery(
        `UPDATE usuarios SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      res.json({ success: true, message: "Usuário atualizado com sucesso!" });
    } catch (error) {
      next(error);
    }
  }
);

// --- DESATIVAR / EXCLUIR USUARIO (DIRETORIA) ---
router.delete(
  "/api/usuarios/:id",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (Number(id) === Number(req.user.id)) {
        return res.status(400).json({ error: "Você não pode desativar sua própria conta logada." });
      }

      await db.executarQuery("UPDATE usuarios SET ativo = 0 WHERE id = ?", [id]);
      res.json({ success: true, message: "Usuário desativado com sucesso!" });
    } catch (error) {
      next(error);
    }
  }
);

// Telefone/WhatsApp do consultor (aparece para o cliente na página da proposta). Diretor edita.
router.put(
  "/api/usuarios/:id/telefone",
  verificarToken,
  verificarRole(["Diretor"]),
  async (req, res, next) => {
    try {
      const telefone = normalizarTelefone(req.body.telefone);
      if (telefone === false) {
        return res.status(400).json({ error: "Telefone inválido. Use DDD + número (10 ou 11 dígitos)." });
      }
      const [resultado] = await db.execute("UPDATE usuarios SET telefone = ? WHERE id = ?", [telefone, req.params.id]);
      if (resultado.affectedRows === 0) return res.status(404).json({ error: "Usuário não encontrado." });
      res.json({ success: true, message: telefone ? "Telefone salvo." : "Telefone removido." });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;

