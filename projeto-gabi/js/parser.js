/**
 * Conversor de Extrato Consolidado para Modelo Conta Azul
 * Motor de Extração Inteligente de PDFs Financeiros
 * Suporte: Santander PJ Consolidado | Asaas
 */

const MONTH_NAMES = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06',
    'julho': '07', 'agosto': '08', 'setembro': '09',
    'outubro': '10', 'novembro': '11', 'dezembro': '12'
};

function parsePtBrFloat(str) {
    if (!str) return 0;
    let s = str.trim();
    // Strip "R$ " prefix if present
    s = s.replace(/^R\$\s*/, '');
    let isNeg = false;
    if (s.endsWith('-') || s.startsWith('-')) {
        isNeg = true;
        s = s.replace(/-/g, '').trim();
    }
    s = s.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(s);
    return isNeg ? -Math.abs(val) : val;
}

function cleanDescription(desc) {
    if (!desc) return '';
    return desc
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*$/, '')
        .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sniffs the PDF type by looking at the first page text.
 * Returns 'asaas' | 'santander'
 */
async function detectPdfType(doc) {
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    const fullText = textContent.items.map(it => it.str).join(' ');

    if (
        /asaas/i.test(fullText) ||
        /Período\s+\d{2}\s+de\s+\w+\s+de\s+\d{4}/i.test(fullText) ||
        /Saldo inicial do período/i.test(fullText) ||
        /Movimentações\s+Valor/i.test(fullText) ||
        /Conta:\s*\d{5,}/i.test(fullText)
    ) {
        return 'asaas';
    }

    return 'santander';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: group PDF items into lines by Y coordinate
// ─────────────────────────────────────────────────────────────────────────────
function groupIntoLines(items, tolerance) {
    const linesMap = new Map();
    for (const item of items) {
        let foundY = null;
        for (const y of linesMap.keys()) {
            if (Math.abs(y - item.y) <= tolerance) { foundY = y; break; }
        }
        if (foundY === null) { foundY = item.y; linesMap.set(foundY, []); }
        linesMap.get(foundY).push(item);
    }
    // Return sorted descending (top of page first)
    return Array.from(linesMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([y, lineItems]) => ({ y, lineItems: lineItems.sort((a, b) => a.x - b.x) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ASAAS PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an Asaas bank statement PDF.
 *
 * Asaas column layout (PDF coordinates):
 *   Data (DD/MM/AAAA): x ≈ 38
 *   Movimentações (description): x ≈ 144
 *   Valor (R$ ±value): x ≈ 500–530
 *
 * Multi-line rows: Asaas wraps long descriptions across 2-3 lines.
 * The date+value row is the anchor; desc-only lines above or below belong to it.
 */
async function parseAsaasPdf(doc, onProgress) {
    // ── 1. Extract period from page 1 header ─────────────────────────────────
    let statementMonth = null;
    let statementYear = new Date().getFullYear();
    let accountInfo = { name: '', agency: '', account: '' };

    for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items
            .filter(it => it.str && it.str.trim().length > 0)
            .map(it => ({ str: it.str.trim(), x: it.transform[4], y: it.transform[5] }));

        const fullText = items.map(i => i.str).join(' ');

        // "01 de Dezembro de 2025 a 31 de Dezembro de 2025"
        const matchPeriodo = fullText.match(
            /\d{1,2}\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/i
        );
        if (matchPeriodo && !statementMonth) {
            statementMonth = MONTH_NAMES[matchPeriodo[1].toLowerCase()];
            statementYear = parseInt(matchPeriodo[2], 10);
        }

        // The company name is the first item on the first page (highest Y, leftmost)
        if (!accountInfo.name) {
            const lines = groupIntoLines(items, 3.5);
            if (lines.length > 0) {
                const topLine = lines[0];
                accountInfo.name = topLine.lineItems.map(i => i.str).join(' ').trim();
            }
        }

        const agMatch = fullText.match(/Agência:\s*([\d]+)/i);
        if (agMatch && !accountInfo.agency) accountInfo.agency = agMatch[1].trim();

        const accMatch = fullText.match(/Conta:\s*([\d\s\-]+)/i);
        if (accMatch && !accountInfo.account) accountInfo.account = accMatch[1].trim();

        if (statementMonth) break;
    }

    if (!statementMonth) {
        statementMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    }

    // ── 2. Extract transactions page by page ─────────────────────────────────
    const transactions = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        onProgress(pageNum, doc.numPages, `Processando página ${pageNum} de ${doc.numPages}...`);

        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();

        const items = textContent.items
            .filter(it => it.str && it.str.trim().length > 0)
            .map(it => ({
                str: it.str.trim(),
                x: it.transform[4],
                y: it.transform[5]
            }));

        if (!items.length) continue;

        const lines = groupIntoLines(items, 3.5);

        // ── Pass 1: classify each line ────────────────────────────────────────
        const classified = [];

        for (const { y, lineItems } of lines) {
            const lineStr = lineItems.map(i => i.str).join(' ');

            // Skip header / separator rows
            if (
                /^Data\s+Movimentações\s+Valor/i.test(lineStr) ||
                /Saldo (inicial|final) do período/i.test(lineStr) ||
                /Extrato gerado em/i.test(lineStr) ||
                /Período\s+\d{1,2}\s+de/i.test(lineStr) ||
                /CNPJ\s+\d{2}\.\d{3}\.\d{3}/.test(lineStr) ||
                /Agência:/.test(lineStr) ||
                /LABORATORIO|LABORATÓ/.test(lineStr) && /LTDA/.test(lineStr)
            ) {
                classified.push({ type: 'skip', y });
                continue;
            }

            const dateItem = lineItems.find(it =>
                it.x <= 65 && /^\d{2}\/\d{2}\/\d{4}$/.test(it.str)
            );
            const valueItem = lineItems.find(it =>
                it.x > 490 && /^R\$\s*-?[\d\.]+,\d{2}$/.test(it.str)
            );
            const descItems = lineItems.filter(it => it.x >= 120 && it.x < 495);
            const descText = descItems.map(it => it.str).join(' ').trim();

            if (dateItem && valueItem) {
                const rawVal = valueItem.str.replace(/^R\$\s*/, '').trim();
                const numVal = parsePtBrFloat(rawVal);
                const [d, m, yr] = dateItem.str.split('/');
                classified.push({
                    type: 'transaction',
                    y,
                    date: `${d}/${m}/${yr}`,
                    desc: descText,
                    amount: numVal,
                    txType: numVal >= 0 ? 'CREDITO' : 'DEBITO'
                });
            } else if (descText) {
                classified.push({ type: 'desc-only', y, desc: descText });
            }
        }

        // ── Pass 2: build transactions, attaching adjacent desc-only lines ────
        // Asaas layout: each tx block has 2-3 lines spaced ~5px apart.
        // Between separate tx blocks, the gap is ~20-25px.
        // Strategy: for each tx row, grab desc-only lines within a tight
        // window (~18px) in Y above and below.
        for (let i = 0; i < classified.length; i++) {
            const row = classified[i];
            if (row.type !== 'transaction') continue;

            let prependParts = [];
            let appendParts = [];

            // Scan BACKWARDS for desc-only lines ABOVE this tx row (higher Y)
            for (let j = i - 1; j >= 0; j--) {
                const prev = classified[j];
                if (prev.type === 'skip') continue;
                if (prev.type !== 'desc-only') break;
                // Must be within ~18px (tight: same tx block, not another tx)
                if (Math.abs(prev.y - row.y) <= 18) {
                    prependParts.unshift(prev.desc);
                    prev.type = 'consumed';
                } else {
                    break;
                }
            }

            // Scan FORWARD for desc-only lines BELOW this tx row (lower Y)
            for (let j = i + 1; j < classified.length; j++) {
                const next = classified[j];
                if (next.type === 'skip') continue;
                if (next.type !== 'desc-only') break;
                // Must be within ~18px
                if (Math.abs(next.y - row.y) <= 18) {
                    appendParts.push(next.desc);
                    next.type = 'consumed';
                } else {
                    break;
                }
            }

            const fullDesc = [...prependParts, row.desc, ...appendParts]
                .filter(Boolean)
                .join(' ');

            transactions.push({
                id: 'tx_' + (transactions.length + 1) + '_' + Math.random().toString(36).substring(2, 7),
                date: row.date,
                description: cleanDescription(fullDesc),
                amount: row.amount,
                type: row.txType,
                docNumber: '',
                page: pageNum,
                y: row.y,
                selected: true,
                category: '',
                clientSupplier: '',
                cnpjCpf: '',
                costCenter: '',
                notes: ''
            });
        }
    }

    return {
        metadata: {
            period: `${statementMonth}/${statementYear}`,
            month: statementMonth,
            year: statementYear,
            accountInfo: accountInfo,
            totalPages: doc.numPages,
            totalTransactions: transactions.length,
            source: 'asaas'
        },
        transactions: transactions
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SANTANDER PARSER (original)
// ─────────────────────────────────────────────────────────────────────────────

async function parseSantanderPdf(doc, onProgress) {
    let statementMonth = null;
    let statementYear = new Date().getFullYear();
    let accountInfo = { name: '', agency: '', account: '' };

    // Pass 1: Detect period and account info from header/Resumo
    for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const fullText = textContent.items.map(it => it.str).join(' ');

        const matchTitle = fullText.match(/(?:EXTRATO CONSOLIDADO INTELIGENTE|Resumo\s*-\s*)\s*(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*\/\s*(\d{4})/i);
        if (matchTitle) {
            statementMonth = MONTH_NAMES[matchTitle[1].toLowerCase()];
            statementYear = parseInt(matchTitle[2], 10);
            break;
        }

        const matchAnyMonth = fullText.match(/\b(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})\b/i);
        if (matchAnyMonth && !statementMonth) {
            statementMonth = MONTH_NAMES[matchAnyMonth[1].toLowerCase()];
            statementYear = parseInt(matchAnyMonth[2], 10);
        }

        const nameMatch = fullText.match(/Nome\s+([A-Z0-9\.\s\-]+?)(?:Agência|Conta)/i);
        if (nameMatch && !accountInfo.name) accountInfo.name = nameMatch[1].trim();

        const agMatch = fullText.match(/Agência\s+(\d+)/i);
        if (agMatch && !accountInfo.agency) accountInfo.agency = agMatch[1].trim();

        const accMatch = fullText.match(/Conta Corrente\s+([0-9\.\-]+)/i);
        if (accMatch && !accountInfo.account) accountInfo.account = accMatch[1].trim();
    }

    if (!statementMonth) {
        statementMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    }

    const transactions = [];
    let currentDate = null;
    let reachedEndOfStatement = false;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        if (reachedEndOfStatement) break;

        onProgress(pageNum, doc.numPages, `Processando página ${pageNum} de ${doc.numPages}...`);
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageRawText = textContent.items.map(it => it.str).join(' ');

        if (
            pageRawText.includes('Lançamentos Pendentes e Futuros') ||
            pageRawText.includes('Lançamentos Futuros') ||
            pageRawText.includes('Saldos por Período') ||
            pageRawText.includes('Pacote de Serviços') ||
            (pageRawText.includes('Investimentos com Resgate') && !pageRawText.includes('Conta Corrente'))
        ) {
            reachedEndOfStatement = true;
        }

        const items = textContent.items
            .filter(it => it.str && it.str.trim().length > 0)
            .map(it => ({
                str: it.str.trim(),
                x: it.transform[4],
                y: it.transform[5],
                w: it.width,
                h: it.height
            }));

        if (!items.length) continue;

        const lines = groupIntoLines(items, 3.5);

        for (const { y, lineItems } of lines) {
            const lineStr = lineItems.map(i => i.str).join(' ');

            if (
                lineStr.includes('Lançamentos Pendentes') ||
                lineStr.includes('Lançamentos Futuros') ||
                lineStr.includes('Saldos por Período') ||
                lineStr.includes('Pacote de Serviços')
            ) {
                reachedEndOfStatement = true;
                break;
            }

            if (
                lineStr.includes('EXTRATO CONSOLIDADO') ||
                lineStr.includes('Extrato_PJ_A4') ||
                lineStr.includes('BALP_UY_') ||
                lineStr.includes('Pagina:') ||
                lineStr.includes('Movimentação') ||
                lineStr.includes('DataDescriçãoNº') ||
                lineStr.includes('CréditosDébitos') ||
                lineStr.includes('Central de Atendimento') ||
                lineStr.includes('Ouvidoria') ||
                lineStr.includes('SAC') ||
                lineStr.includes('Resumo -') ||
                lineStr.includes('Total de Créditos') ||
                lineStr.includes('Total de Débitos') ||
                lineStr.includes('Saldo de Conta Corrente') ||
                lineStr.includes('Saldo Disponível') ||
                lineStr.includes('Depósitos / Transferências') ||
                lineStr.includes('Outros Créditos') ||
                lineStr.includes('Compras com Cartão') ||
                lineStr.includes('Pagamentos / Transferências') ||
                lineStr.includes('Outros Débitos') ||
                lineStr.includes('Investimentos com Resgate') ||
                (lineStr.includes('Agência') && lineStr.includes('Conta Corrente')) ||
                lineStr.startsWith('(=)') ||
                lineStr.startsWith('(+)') ||
                lineStr.startsWith('(-)') ||
                lineStr.includes('Prezado Cliente') ||
                lineStr.includes('Soluções em pagamentos') ||
                lineStr.includes('Fale Conosco') ||
                lineStr.includes('Loja:') ||
                lineStr.includes('Libras') ||
                lineStr.includes('Central de Vendas') ||
                lineStr.includes('SALDO EM') ||
                lineStr.includes('SALDO ANTERIOR')
            ) {
                continue;
            }

            const dateItem = lineItems.find(it => it.x <= 55 && /^\d{2}\/\d{2}$/.test(it.str));
            if (dateItem) {
                const [d, m] = dateItem.str.split('/');
                if (m !== statementMonth && !(m === '12' && statementMonth === '01')) {
                    reachedEndOfStatement = true;
                    break;
                }
                const yr = (m === '12' && statementMonth === '01') ? (statementYear - 1) : statementYear;
                currentDate = `${d}/${m}/${yr}`;
            }

            const creditItem = lineItems.find(it => it.x >= 350 && it.x < 415 && /^-?[\d\.]+(,\d{2})-?$/.test(it.str));
            const debitItem = lineItems.find(it => it.x >= 415 && it.x < 485 && /^-?[\d\.]+(,\d{2})-?$/.test(it.str));

            const descItems = lineItems.filter(it => it.x >= 50 && it.x < 300);
            const descText = descItems.map(it => it.str).join(' ').trim();

            const docItem = lineItems.find(it => it.x >= 290 && it.x < 345 && it.str !== '-');
            const docNum = docItem ? docItem.str.trim() : '';

            if (creditItem) {
                transactions.push({
                    id: 'tx_' + (transactions.length + 1) + '_' + Math.random().toString(36).substring(2, 7),
                    date: currentDate || `01/${statementMonth}/${statementYear}`,
                    description: cleanDescription(descText),
                    amount: Math.abs(parsePtBrFloat(creditItem.str)),
                    type: 'CREDITO',
                    docNumber: docNum,
                    page: pageNum,
                    y: y,
                    selected: true,
                    category: '',
                    clientSupplier: '',
                    cnpjCpf: '',
                    costCenter: '',
                    notes: ''
                });
            } else if (debitItem) {
                // Se a descrição já tiver sido usada pelo crédito, adiciona "(Débito)" para diferenciar se necessário,
                // mas o sistema agrupa pela data/valor, então podemos usar a mesma.
                transactions.push({
                    id: 'tx_' + (transactions.length + 1) + '_' + Math.random().toString(36).substring(2, 7),
                    date: currentDate || `01/${statementMonth}/${statementYear}`,
                    description: cleanDescription(descText),
                    amount: -Math.abs(parsePtBrFloat(debitItem.str)),
                    type: 'DEBITO',
                    docNumber: docNum,
                    page: pageNum,
                    y: y,
                    selected: true,
                    category: '',
                    clientSupplier: '',
                    cnpjCpf: '',
                    costCenter: '',
                    notes: ''
                });
            } else if (descText && transactions.length > 0) {
                const lastTx = transactions[transactions.length - 1];
                if (lastTx.page === pageNum && Math.abs(lastTx.y - y) <= 25) {
                    lastTx.description = cleanDescription(lastTx.description + ' ' + descText);
                }
            }
        }
    }

    return {
        metadata: {
            period: `${statementMonth}/${statementYear}`,
            month: statementMonth,
            year: statementYear,
            accountInfo: accountInfo,
            totalPages: doc.numPages,
            totalTransactions: transactions.length,
            source: 'santander'
        },
        transactions: transactions
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT (auto-detects PDF type)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses any supported bank statement PDF into structured financial transactions.
 * Auto-detects: Santander Consolidated PJ | Asaas
 *
 * @param {ArrayBuffer|Uint8Array} pdfData
 * @param {Function} onProgress
 * @returns {Promise<{transactions: Array, metadata: Object}>}
 */
async function parseConsolidatedPdf(pdfData, onProgress = () => {}) {
    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    }

    const lib = typeof pdfjsLib !== 'undefined'
        ? pdfjsLib
        : (typeof require !== 'undefined'
            ? require('pdfjs-dist/legacy/build/pdf.js')
            : window.pdfjsLib);

    const loadingTask = lib.getDocument({ data: new Uint8Array(pdfData) });
    const doc = await loadingTask.promise;

    // Auto-detect bank format
    const pdfType = await detectPdfType(doc);

    if (pdfType === 'asaas') {
        return parseAsaasPdf(doc, onProgress);
    } else {
        return parseSantanderPdf(doc, onProgress);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseConsolidatedPdf, parsePtBrFloat, cleanDescription, detectPdfType };
}
