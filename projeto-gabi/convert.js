/**
 * Conversor CLI direto via Linha de Comando
 * Processa todos os arquivos .pdf da pasta ou um arquivo específico
 * e gera as planilhas prontas no modelo Conta Azul.
 */

const fs = require('fs');
const path = require('path');
const { parseConsolidatedPdf } = require('./js/parser');
const { SmartCategorizer } = require('./js/categorizer');
const { createContaAzulWorkbook } = require('./js/excel-exporter');
const XLSX = require('xlsx');

async function processFile(pdfFilePath) {
    const filename = path.basename(pdfFilePath);
    console.log(`\n========================================`);
    console.log(`📄 Processando: ${filename}`);
    
    const buf = fs.readFileSync(pdfFilePath);
    const categorizer = new SmartCategorizer();

    const parsed = await parseConsolidatedPdf(buf, (p, total) => {
        process.stdout.write(`\rProcessando página ${p}/${total}...`);
    });

    console.log(`\n✅ Extração concluída: ${parsed.transactions.length} lançamentos encontrados.`);
    console.log(`📅 Período identificado: ${parsed.metadata.period}`);

    // Gera a planilha com Categoria e Centro de Custo em branco (padrão solicitado para Conta Azul)
    const wb = createContaAzulWorkbook(parsed.transactions);
    const outNameXlsx = filename.replace(/\.pdf$/i, '') + '_contaazul.xlsx';
    const outNameXls = filename.replace(/\.pdf$/i, '') + '_contaazul.xls';

    XLSX.writeFile(wb, outNameXlsx, { bookType: 'xlsx' });
    XLSX.writeFile(wb, outNameXls, { bookType: 'biff8' });

    let sumCred = 0;
    let sumDeb = 0;
    parsed.transactions.forEach(t => {
        if (t.amount > 0) sumCred += t.amount;
        else sumDeb += Math.abs(t.amount);
    });

    console.log(`📊 Totais do Extrato:`);
    console.log(`   (+) Entradas (Créditos): R$ ${sumCred.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   (-) Saídas (Débitos):    R$ ${sumDeb.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   (=) Saldo Líquido:       R$ ${(sumCred - sumDeb).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`💾 Planilhas salvas com sucesso:`);
    console.log(`   👉 ${outNameXlsx}`);
    console.log(`   👉 ${outNameXls}`);
}

async function main() {
    const args = process.argv.slice(2);
    let targetPdfs = [];

    if (args.length > 0) {
        targetPdfs = args;
    } else {
        const files = fs.readdirSync(__dirname);
        targetPdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    }

    if (targetPdfs.length === 0) {
        console.log('Nenhum arquivo PDF encontrado para processar.');
        return;
    }

    console.log(`Encontrado(s) ${targetPdfs.length} arquivo(s) PDF para conversão.`);
    for (const pdfPath of targetPdfs) {
        await processFile(pdfPath);
    }
    console.log('\n🎉 Todos os extratos foram processados com sucesso!');
}

main().catch(console.error);
