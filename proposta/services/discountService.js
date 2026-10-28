const bcrypt = require("bcrypt");
const { temDescontoAcimaDe20 } = require("./proposalHelpers");

/**
 * Serviço de Gerenciamento e Alçada de Descontos
 */
class DiscountService {
  /**
   * Calcula totais separados por tipo (Mensal vs Pontual) a partir da lista de itens
   */
  calcularTotaisSeparados(itens = []) {
    let totalMensal = 0;
    let totalPontual = 0;

    for (const item of itens) {
      const obs = (item.observacao || "").toLowerCase();
      const ehPontual =
        obs.includes("pontual") ||
        obs.includes("taxas") ||
        obs.includes("emissão") ||
        obs.includes("renovação") ||
        obs.includes("implanta");

      const valor = Number(item.valor || 0);
      if (ehPontual) {
        totalPontual += valor;
      } else {
        totalMensal += valor;
      }
    }

    return {
      totalMensal,
      totalPontual,
      totalGeral: totalMensal + totalPontual,
    };
  }

  /**
   * Verifica se a alçada do usuário permite conceder o desconto imediatamente
   * Diretores podem até 100%. Comerciais podem até 20%. Acima disso, requer aprovação ou senha de diretor.
   */
  async verificarAlcadaDesconto({ role, percentual, diretorEmail, diretorSenha, db }) {
    const percentualNum = parseFloat(percentual);

    // Diretor tem autonomia total
    if (role === "Diretor") {
      return { autorizado: true, requerAprovacao: false };
    }

    // Comercial tem autonomia até 20%
    if (role === "Comercial" && percentualNum <= 20) {
      return { autorizado: true, requerAprovacao: false };
    }

    // Se fornecidas credenciais em tempo real do Diretor
    if (diretorEmail && diretorSenha) {
      const dirs = await db.executarQuery(
        'SELECT * FROM usuarios WHERE email = ? AND ativo = 1 AND role = "Diretor"',
        [diretorEmail]
      );
      if (dirs.length > 0) {
        const senhaValida = await bcrypt.compare(diretorSenha, dirs[0].senha_hash);
        if (senhaValida) {
          return { autorizado: true, requerAprovacao: false, diretorId: dirs[0].id };
        }
        return { autorizado: false, erro: "Senha do Diretor inválida.", statusHttp: 401 };
      }
      return { autorizado: false, erro: "Credenciais de Diretor não encontradas.", statusHttp: 401 };
    }

    // Não autorizado diretamente: requer envio para aprovação da diretoria
    return { autorizado: false, requerAprovacao: true };
  }

  /**
   * Verifica se itens possuem desconto acima de 20%
   */
  precisaAprovacaoItens(itens, role) {
    if (role === "Diretor") return false;
    return temDescontoAcimaDe20(itens);
  }
}

const discountService = new DiscountService();
module.exports = discountService;
