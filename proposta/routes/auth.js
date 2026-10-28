const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const rateLimit = require("express-rate-limit");
const { verificarToken, verificarRole } = require("../middleware/auth");

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

