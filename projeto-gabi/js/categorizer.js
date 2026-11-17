/**
 * Mecanismo Inteligente de Categorização e Identificação de Favorecidos
 */

const DEFAULT_RULES = [
    { pattern: /GETNET/i, category: 'Vendas Cartão (Getnet)', costCenter: 'Comercial' },
    { pattern: /CIELO|REDE|STONE|PAGSEGURO/i, category: 'Vendas Cartão', costCenter: 'Comercial' },
    { pattern: /ENERGISA|EQUATORIAL|ENEL|CPFL|CEMIG/i, category: 'Energia Elétrica', costCenter: 'Administrativo' },
    { pattern: /OI FIBRA|CLARO|VIVO|TIM|TELEF/i, category: 'Telefonia e Internet', costCenter: 'Administrativo' },
    { pattern: /ALUGUEL|CONDOMINIO|LOCACAO/i, category: 'Aluguel e Instalações', costCenter: 'Administrativo' },
    { pattern: /SUPERMERCADO|PANIFICAD|PADARIA|SALGADERIA|RESTAURANTE/i, category: 'Alimentação / Copa', costCenter: 'Administrativo' },
    { pattern: /TARIFA|TAXA|IOF|ANUIDADE|MANUTENCAO CTA/i, category: 'Despesas Bancárias', costCenter: 'Financeiro' },
    { pattern: /CONTAMAX|MESMA TITULARIDADE|TRANSF.*TITULAR/i, category: 'Transferência Entre Contas', costCenter: 'Financeiro' },
    { pattern: /PIX RECEBIDO/i, category: 'Recebimentos de Clientes', costCenter: 'Vendas' },
    { pattern: /PIX ENVIADO/i, category: 'Pagamentos / Fornecedores', costCenter: 'Operacional' },
    { pattern: /PAGAMENTO DE BOLETO/i, category: 'Fornecedores e Boletos', costCenter: 'Operacional' }
];

class SmartCategorizer {
    constructor() {
        this.rules = this.loadRules();
    }

    loadRules() {
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('contaazul_categorizer_rules');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    return parsed.map(r => ({
                        pattern: new RegExp(r.regex, 'i'),
                        category: r.category,
                        costCenter: r.costCenter || ''
                    }));
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar regras:', e);
        }
        return [...DEFAULT_RULES];
    }

    saveRules(customRules) {
        try {
            if (typeof localStorage !== 'undefined') {
                const toSave = customRules.map(r => ({
                    regex: r.pattern.source,
                    category: r.category,
                    costCenter: r.costCenter || ''
                }));
                localStorage.setItem('contaazul_categorizer_rules', JSON.stringify(toSave));
            }
            this.rules = customRules;
        } catch (e) {
            console.warn('Erro ao salvar regras:', e);
        }
    }

    /**
     * Attempts to auto-categorize and extract client/supplier name from transaction description
     */
    processTransaction(tx) {
        const desc = tx.description || '';
        let category = tx.category || '';
        let costCenter = tx.costCenter || '';
        let clientSupplier = tx.clientSupplier || '';

        // 1. Check rules
        for (const rule of this.rules) {
            if (rule.pattern.test(desc)) {
                if (!category) category = rule.category;
                if (!costCenter && rule.costCenter) costCenter = rule.costCenter;
                break;
            }
        }

        // 2. Extract Client / Supplier name heuristics
        if (!clientSupplier) {
            // "PIX ENVIADO Jairo Ilidio Denicolo"
            const pixEnvMatch = desc.match(/PIX ENVIADO\s+([A-Za-zÀ-ÖØ-öø-ÿ\s\.\-]+?)(?:\s*-\s*|\s+\d+|$)/i);
            if (pixEnvMatch && pixEnvMatch[1].trim().length > 2) {
                clientSupplier = pixEnvMatch[1].trim();
            }

            // "PAGAMENTO DE BOLETO OUTROS BANCOS ENERGISA MATO GR D DE ENE"
            const boletoMatch = desc.match(/PAGAMENTO DE BOLETO(?:\s+OUTROS BANCOS)?\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9\s\.\-]+)/i);
            if (boletoMatch && boletoMatch[1].trim().length > 2) {
                clientSupplier = boletoMatch[1].trim();
            }

            // "DEBITO AUT. CONTA DE TELEFONE OI FIBRA ARBOR"
            const debAutoMatch = desc.match(/DEBITO AUT\.[A-Z\s]+\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9\s\.\-]+)/i);
            if (debAutoMatch && debAutoMatch[1].trim().length > 2) {
                clientSupplier = debAutoMatch[1].trim();
            }
        }

        return {
            ...tx,
            category: category,
            costCenter: costCenter,
            clientSupplier: clientSupplier
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SmartCategorizer, DEFAULT_RULES };
}
