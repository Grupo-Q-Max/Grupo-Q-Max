/**
 * Gerador de Planilhas Modelo Conta Azul
 * Cria arquivos 100% compatíveis com a importação do Conta Azul (.xls, .xlsx, .csv)
 */

const CONTA_AZUL_HEADERS = [
    "Data de Competência",
    "Data de Vencimento",
    "Data de Pagamento",
    "Valor",
    "Categoria",
    "Descrição",
    "Cliente/Fornecedor",
    "CNPJ/CPF Cliente/Fornecedor",
    "Centro de Custo",
    "Observações"
];

const ORIENTACOES_CONTA_AZUL = [
    ["Orientações de preenchimento da planilha:"],
    ["* A data de pagamento precisa ser igual ou inferior a data de hoje, caso a mesma seja superior ao dia de hoje o lançamento será importado com o status: \"Em Aberto\"."],
    ["* Não utilizar caracteres especiais, como por exemplo: ' \" ! @ #  %  ¨  &  *  (  )  ª  º  §  + _  - ? ° [ { } ] : ;"],
    ["* Cole as informações planilha utilizando a função \"Colar Especial > Colar Valores\" para não perder a formatação padrão das células;"],
    ["* Verificar se não ficou espaços entre os dados informados, principalmente quando as informações são coladas;"],
    ["* As células não podem conter fórmulas;"]
];

/**
 * Transforms transactions array into 2D array for Conta Azul
 */
function buildContaAzulRows(transactions) {
    const rows = [CONTA_AZUL_HEADERS];
    const seen = new Map();

    for (const tx of transactions) {
        if (tx.selected === false) continue;

        // User requirement: "As datas são sempre as mesmas, nas 3 colunas"
        const dateVal = tx.date || '';
        
        // Anti-deduplication logic for Conta Azul:
        // Conta Azul ignores exactly identical lines. We append a counter to the description.
        let desc = tx.description || '';
        const key = `${dateVal}_${tx.amount}_${desc}`;
        let count = (seen.get(key) || 0) + 1;
        seen.set(key, count);
        if (count > 1) {
            desc = `${desc} (${count})`;
        }
        
        // Categoria, Centro de Custo, Cliente/Fornecedor mantidos em branco conforme solicitado
        // para evitar que o Conta Azul duplique cadastros
        rows.push([
            dateVal,                          // Data de Competência
            dateVal,                          // Data de Vencimento
            dateVal,                          // Data de Pagamento
            tx.amount,                        // Valor (Numérico com sinal negativo se débito)
            tx.category || '',                // Categoria (em branco por padrão)
            desc,                             // Descrição (com contador se for duplicada)
            tx.clientSupplier || '',          // Cliente/Fornecedor (em branco por padrão)
            tx.cnpjCpf || '',                 // CNPJ/CPF (em branco por padrão)
            tx.costCenter || '',              // Centro de Custo (em branco por padrão)
            tx.notes || ''                    // Observações (em branco por padrão)
        ]);
    }

    return rows;
}

/**
 * Creates an XLSX/XLS workbook matching the Conta Azul specification
 */
function createContaAzulWorkbook(transactions) {
    const XLSX_LIB = typeof XLSX !== 'undefined' ? XLSX : (typeof require !== 'undefined' ? require('xlsx') : window.XLSX);
    
    const wb = XLSX_LIB.utils.book_new();
    const rows = buildContaAzulRows(transactions);

    // Sheet 1: Dados
    const wsDados = XLSX_LIB.utils.aoa_to_sheet(rows);

    // Column widths
    wsDados['!cols'] = [
        { wch: 18 }, // Data de Competência
        { wch: 18 }, // Data de Vencimento
        { wch: 18 }, // Data de Pagamento
        { wch: 15 }, // Valor
        { wch: 25 }, // Categoria
        { wch: 45 }, // Descrição
        { wch: 30 }, // Cliente/Fornecedor
        { wch: 25 }, // CNPJ/CPF
        { wch: 20 }, // Centro de Custo
        { wch: 30 }  // Observações
    ];

    XLSX_LIB.utils.book_append_sheet(wb, wsDados, 'Dados');

    // Sheet 2: Orientações
    const wsOrientacoes = XLSX_LIB.utils.aoa_to_sheet(ORIENTACOES_CONTA_AZUL);
    wsOrientacoes['!cols'] = [{ wch: 120 }];
    XLSX_LIB.utils.book_append_sheet(wb, wsOrientacoes, 'Orientações');

    return wb;
}

/**
 * Downloads the workbook in the browser with guaranteed filename and extension
 */
function downloadContaAzulExcel(transactions, filename = 'planilha_importacao_contaazul.xlsx', format = 'xlsx') {
    const XLSX_LIB = typeof XLSX !== 'undefined' ? XLSX : window.XLSX;
    const wb = createContaAzulWorkbook(transactions);

    let cleanFilename = filename || 'planilha_contaazul.xlsx';
    if (format === 'xls') {
        if (!cleanFilename.toLowerCase().endsWith('.xls')) {
            cleanFilename = cleanFilename.replace(/\.xlsx$/i, '') + '.xls';
        }
    } else {
        if (!cleanFilename.toLowerCase().endsWith('.xlsx')) {
            cleanFilename = cleanFilename.replace(/\.xls$/i, '') + '.xlsx';
        }
    }

    const bookType = format === 'xls' ? 'biff8' : 'xlsx';
    const wbout = XLSX_LIB.write(wb, { bookType: bookType, type: 'array' });

    const mimeType = format === 'xls' 
        ? 'application/vnd.ms-excel' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const blob = new Blob([wbout], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', cleanFilename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
        if (link.parentNode) document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1500);
}

/**
 * Exports to CSV formatted for Brazilian Excel / Conta Azul (delimiter ;)
 */
function downloadContaAzulCsv(transactions, filename = 'planilha_importacao_contaazul.csv') {
    const rows = buildContaAzulRows(transactions);
    
    const csvContent = rows.map(r => {
        return r.map(cell => {
            if (cell === null || cell === undefined) return '';
            let val = String(cell);
            // format number if numeric
            if (typeof cell === 'number') {
                val = cell.toFixed(2).replace('.', ',');
            }
            if (val.includes(';') || val.includes('"') || val.includes('\n')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(';');
    }).join('\r\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Copies formatted table text to clipboard (ready for Ctrl+V in Excel)
 */
async function copyContaAzulToClipboard(transactions) {
    const rows = buildContaAzulRows(transactions);
    const text = rows.map(r => {
        return r.map(c => {
            if (typeof c === 'number') return c.toFixed(2).replace('.', ',');
            return (c || '').toString().replace(/\t/g, ' ');
        }).join('\t');
    }).join('\n');

    await navigator.clipboard.writeText(text);
    return rows.length - 1; // number of records copied
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONTA_AZUL_HEADERS,
        buildContaAzulRows,
        createContaAzulWorkbook,
        downloadContaAzulExcel,
        downloadContaAzulCsv,
        copyContaAzulToClipboard
    };
}
