const { z } = require("zod");

const socioDetalhadoSchema = z.object({
  nome: z.string().max(150).optional().default(""),
  cpf: z.string().max(20).optional().default(""),
  participacao: z.coerce.number().min(0).max(100).default(0),
  cargo: z.string().max(100).optional().default(""),
});

const itemPropostaSchema = z.object({
  id: z.any().optional(),
  nome: z.string().optional(),
  // servico vai para proposta_itens (NOT NULL) e é a chave do preço de referência da alçada
  servico: z.string().trim().min(1, "Item sem serviço").max(255),
  // valor negativo baixaria o total sem passar pela alçada de desconto
  valor: z.coerce.number().min(0, "Valor do item não pode ser negativo").optional(),
  valorOriginal: z.coerce.number().optional(),
  observacao: z.string().optional().default(""),
  desconto: z.coerce.number().optional().default(0),
  descontoPercentual: z.coerce.number().optional().default(0),
  justificativa: z.string().optional().default(""),
}).passthrough();

const propostaSchema = z.object({
  nomeClinica: z.string().min(2, "Nome da clínica é obrigatório"),
  razaoSocial: z.string().optional().default(""),
  cnpj: z.string().optional().default(""),
  nomeSocio: z.string().optional().default(""),
  cpfSocio: z.string().optional().default(""),
  email: z.string().email("E-mail do cliente inválido"),
  telefone: z.string().optional().default(""),
  enderecoClinica: z.string().optional().default(""),
  empresaProposta: z.string().optional().default("FINORA"),
  tipoProposta: z.string().optional().default("finora"),
  cadeiras: z.coerce.number().min(0).default(0),
  funcionarios: z.coerce.number().min(0).default(0),
  socios: z.coerce.number().min(0).default(0),
  faturamento: z.coerce.number().min(0).default(0),
  distanciaKm: z.coerce.number().min(0).default(0),
  metragem: z.coerce.number().min(0).default(0),

  regimeFiscal: z.string().optional().default(""),
  regimeHibrido: z.string().optional().default(""),

  totalMensal: z.coerce.number().min(0).default(0),
  totalPontual: z.coerce.number().min(0).default(0),
  justificativaDesconto: z.string().optional().default(""),
  total: z.coerce.number().positive("Valor total deve ser maior que zero"),
  itens: z.array(itemPropostaSchema).default([]),

  tipoPessoa: z.string().optional().default("PJ"),
  proLabore: z.any().optional().default("Não"),
  dentistasParceiros: z.coerce.number().int().min(0).default(0),
  quantidadeSocios: z.coerce.number().int().min(0).max(20).default(0),
  sociosDetalhados: z.array(socioDetalhadoSchema).max(20).default([]),
  certificadoDigitalStatus: z.string().optional().default("Não"),
  certificadoDigitalNomeArquivo: z.string().max(255).optional().default(""),
  pdfTheme: z.string().optional().default("moderno"),
  pdfCover: z.coerce.boolean().optional().default(false),
  showApresentacao: z.coerce.boolean().optional().default(true),
  showCondicoesGerais: z.coerce.boolean().optional().default(true),
}).passthrough();

const descontoItemSchema = z.object({
  itensComDesconto: z.array(z.object({
    nome: z.string(),
    valorOriginal: z.coerce.number(),
    valorComDesconto: z.coerce.number(),
    descontoPercentual: z.coerce.number().min(0).max(100),
    justificativa: z.string().optional().default(""),
    observacao: z.string().optional().default(""),
  })).min(1, "Ao menos um item com desconto deve ser fornecido"),
  justificativaGeral: z.string().optional().default(""),
});

const solicitacaoDescontoGlobalSchema = z.object({
  percentualDesconto: z.coerce.number().min(0.01, "Percentual deve ser maior que zero").max(100, "Percentual máximo de 100%"),
  justificativa: z.string().optional().default(""),
});

module.exports = {
  propostaSchema,
  itemPropostaSchema,
  descontoItemSchema,
  solicitacaoDescontoGlobalSchema,
};
