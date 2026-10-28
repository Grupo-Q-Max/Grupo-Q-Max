const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Verifica se o usuário enviou um token válido e continua ativo (desativado perde o acesso na hora, não só quando o JWT expira)
async function validarToken(token, req, res, next) {
  if (!token) return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });

  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // 401 = sessão inválida (o front desloga); 403 fica só para falta de permissão
    return res.status(401).json({ error: 'Sessão expirada ou token inválido.' });
  }

  try {
    const db = require('../config/db');
    const [usuario] = await db.executarQuery('SELECT ativo, role FROM usuarios WHERE id = ?', [user.id]);
    if (!usuario || !Number(usuario.ativo)) {
      return res.status(401).json({ error: 'Usuário desativado ou inexistente.' });
    }
    // Perfil vem do banco: Diretor rebaixado a Comercial perde o acesso na hora, não só quando o JWT expira
    user.role = usuario.role;
  } catch (error) {
    return next(error);
  }

  req.user = user;
  next();
}

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  return validarToken(authHeader && authHeader.split(' ')[1], req, res, next);
}

// Só o SSE aceita ?token= (EventSource não envia header); em outras rotas o JWT na URL vazaria em logs/histórico
function verificarTokenSSE(req, res, next) {
  const authHeader = req.headers['authorization'];
  return validarToken((authHeader && authHeader.split(' ')[1]) || req.query.token, req, res, next);
}

// Verifica se o usuário tem a patente (role) correta para a ação
function verificarRole(rolesPermitidas) {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidas.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para esta ação.' });
    }
    next();
  };
}

// Comercial só acessa o que criou ou de que é vendedor; Diretor acessa tudo.
// `sql` recebe req.params.id e devolve criado_por e/ou vendedor_id do registro.
function exigirDono(sql) {
  return async (req, res, next) => {
    if (req.user.role !== 'Comercial') return next();
    try {
      const db = require('../config/db');
      const [registro] = await db.executarQuery(sql, [req.params.id]);
      if (!registro) return res.status(404).json({ error: 'Registro não encontrado.' });
      const dono = [registro.criado_por, registro.vendedor_id]
        .some((id) => id != null && Number(id) === Number(req.user.id));
      if (!dono) return res.status(403).json({ error: 'Acesso negado. Este registro pertence a outro vendedor.' });
      next();
    } catch (error) {
      next(error);
    }
  };
}

const donoLead = exigirDono('SELECT criado_por, vendedor_id FROM leads WHERE id = ?');
const donoProposta = exigirDono('SELECT criado_por FROM propostas WHERE id = ?');
const donoAtividade = exigirDono(
  'SELECT a.usuario_id AS criado_por, l.vendedor_id FROM lead_atividades a LEFT JOIN leads l ON l.id = a.lead_id WHERE a.id = ?'
);
const donoDocumento = exigirDono(
  'SELECT p.criado_por FROM proposta_documentos d JOIN propostas p ON p.id = d.proposta_id WHERE d.id = ?'
);

module.exports = { verificarToken, verificarTokenSSE, verificarRole, donoLead, donoProposta, donoAtividade, donoDocumento };