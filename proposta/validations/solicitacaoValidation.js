const { z } = require("zod");

const responderSolicitacaoSchema = z.object({
  acao: z.enum(["Aprovar", "Recusar"], {
    errorMap: () => ({ message: "Ação deve ser 'Aprovar' ou 'Recusar'" })
  }),
  tipo: z.enum(["global", "item"]).optional().default("global"),
});

const alterarDescontoSchema = z.object({
  percentual: z.coerce.number().min(0.01, "Percentual deve ser maior que zero").max(100, "Percentual máximo de 100%"),
});

module.exports = {
  responderSolicitacaoSchema,
  alterarDescontoSchema,
};
