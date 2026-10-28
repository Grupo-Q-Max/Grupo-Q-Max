const { z } = require("zod");

const leadSchema = z.object({
  nome_cliente: z.string().min(2, "Nome do cliente deve ter pelo menos 2 caracteres"),
  nome_clinica: z.string().optional().nullable().default(""),
  cnpj: z.string().optional().nullable().default(""),
  cadeiras: z.coerce.number().optional().nullable(),
  faturamento: z.coerce.number().optional().nullable(),
  area_m2: z.coerce.number().optional().nullable(),
  posicoes_coworking: z.coerce.number().optional().nullable(),
  tipo_espaco: z.string().optional().nullable().default(""),
  marca: z.string().optional().default("finora"),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable().default(""),
  telefone: z.string().optional().nullable().default(""),
  origem: z.string().optional().nullable().default("Outro"),
  status: z.string().optional().default("Novo"),
  valor_estimado: z.coerce.number().min(0).default(0),
  cargo: z.string().optional().nullable().default(""),
  vendedor_id: z.coerce.number().optional().nullable(),
  proposta_id: z.coerce.number().optional().nullable(),
  motivo_perda: z.string().optional().nullable().default(""),
  detalhes_perda: z.string().optional().nullable().default(""),
});

const comentarioLeadSchema = z.object({
  comentario: z.string().min(1, "O comentário não pode ser vazio"),
});

const moverEtapaLeadSchema = z.object({
  etapa_id: z.coerce.number().int().positive("Etapa inválida"),
});

module.exports = {
  leadSchema,
  comentarioLeadSchema,
  moverEtapaLeadSchema,
};
