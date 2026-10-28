const PDFDocument = require("pdfkit");
const { ehOdonto } = require("./pdfService");
const { textoContratada, contratadaPadrao } = require("./contratadaService");

function gerarPDFContrato(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    const tipoProposta = (dados.tipo_proposta || dados.tipoProposta || "finora").toLowerCase();
    const nomeClinica = dados.nome_clinica || "CONTRATANTE";
    const cnpj = dados.cnpj || "Não informado";
    const nomeSocio = dados.nome_socio || "Representante Legal";
    const cpfSocio = dados.cpf_socio || "Não informado";
    const numeroProposta = dados.numero_proposta || dados.id || "000";
    const valorTotal = Number(dados.valor_total || 0);
    const dataCriacao = new Date(dados.criado_em || Date.now()).toLocaleDateString("pt-BR");

    // Contratada configurada no admin (services/contratadaService.js); mesma do contrato enviado ao D4Sign
    const contratada = dados.contratada || contratadaPadrao(dados.tipo_proposta || dados.tipoProposta);
    const nomeContratada = String(contratada.razao_social || "").replace(/^o escritório contábil /i, "");
    const cnpjContratada = contratada.cnpj || "";

    // CABEÇALHO DO CONTRATO
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#0f172a").text("CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#64748b").text(`Instrumento Particular Vinculado à Proposta Nº ${numeroProposta}`, { align: "center" });
    doc.moveDown(1.5);

    // QUALIFICAÇÃO DAS PARTES
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("1. DAS PARTES CONTRATANTES");
    doc.moveDown(0.5);

    const situacaoCNPJ = dados.documentoStatus && dados.documentoStatus !== 'ATIVA' ? ` (Situação: ${dados.documentoStatus})` : '';

    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `Pelo presente instrumento particular de Contrato de Prestação de Serviços, de um lado ${nomeClinica}, pessoa jurídica de direito privado devidamente registrada no CNPJ sob o nº ${cnpj}${situacaoCNPJ}, com sede à ${dados.endereco_clinica || "____________________"}, denominado CONTRATANTE neste ato representada por ${nomeSocio}, portador(a) do CPF sob o nº ${cpfSocio}, com endereço comercial à ${dados.endereco_clinica || "____________________"}, e ${textoContratada(contratada)}, mediante as cláusulas e condições seguintes, tem justo e contratado que se segue no quadro resumo e na descrição de cada cláusula.`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(1);

    // CLÁUSULA PRIMEIRA - DO OBJETO
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("2. DO OBJETO DO CONTRATO");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `O presente contrato tem por objeto a prestação de serviços especializados descritos detalhadamente na Proposta Comercial nº ${numeroProposta}, compreendendo a assessoria, BPO financeiro, gestão estratégica, consultoria tributária e/ou tecnologia especializada para ${ehOdonto({ tipoProposta }) ? "clínicas e consultórios odontológicos" : "área de saúde e clínicas médicas/odontológicas"}.`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(1);

    // CLÁUSULA SEGUNDA - DOS VALORES E FORMA DE PAGAMENTO
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("3. DOS VALORES, FORMAS DE PAGAMENTO E VENCIMENTOS");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total pactuado na Proposta Comercial nº ${numeroProposta}, totalizando o montante de R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.\n\n` +
      `Parágrafo Único: O pagamento será efetuado mensalmente via boleto bancário ou Pix, com vencimento estipulado todo dia 10 (dez) de cada mês, ou conforme acordado expressamente no ato da contratação.`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(1);

    // CLÁUSULA TERCEIRA - DA CONFIDENCIALIDADE E LGPD
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("4. DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `As partes comprometem-se a manter absoluto sigilo sobre quaisquer informações operacionais, financeiras, cadastrais e de pacientes obtidas em razão da execução do presente contrato, em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(1);

    // CLÁUSULA QUARTA - DO PRAZO E RESCISÃO
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("5. DO PRAZO DE VIGÊNCIA E RESCISÃO");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `O presente contrato vigorará por prazo indeterminado (ou pelo período estipulado de 12 meses), podendo ser rescindido por qualquer das partes mediante aviso prévio por escrito de 30 (trinta) dias, sem incidência de multas punitivas abusivas, ressalvada a quitação dos serviços até então prestados.`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(1);

    // CLÁUSULA QUINTA - DO FORO
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("6. DO FORO");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#334155").text(
      `Para dirimir eventuais controvérsias oriundas deste instrumento, as partes elegem o foro da Comarca da sede da CONTRATADA, com renúncia expressa a qualquer outro, por mais privilegiado que seja.\n\n` +
      `E, por estarem justas e contratadas, as partes firmam o presente instrumento por meio de assinatura digital com plena validade jurídica (MP nº 2.200-2/2001 e Lei nº 14.063/2020).`,
      { align: "justify", lineGap: 3 }
    );
    doc.moveDown(2);

    // ASSINATURAS
    doc.fontSize(10).font("Helvetica").fillColor("#64748b").text(`Emitido em: ${dataCriacao}`, { align: "left" });
    doc.moveDown(2);

    const posLeft = 70;
    const posRight = 320;
    const currentY = doc.y;

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text("_______________________________", posLeft, currentY);
    doc.text("_______________________________", posRight, currentY);

    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(nomeContratada, posLeft);
    doc.text(nomeClinica, posRight);

    doc.moveDown(0.2);
    doc.fontSize(8).font("Helvetica").fillColor("#64748b").text(`CNPJ: ${cnpjContratada}`, posLeft);
    doc.text(`Resp: ${nomeSocio} (${cpfSocio})`, posRight);

    doc.end();
  });
}

// Mesmo escape de emailService.js: dados do cliente chegam até do formulário público (webhook de leads)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

function gerarHTMLContrato(dados) {
  const tipoProposta = (dados.tipo_proposta || dados.tipoProposta || "finora").toLowerCase();
  const nomeClinica = esc(dados.nome_clinica || "CONTRATANTE");
  const cnpj = esc(dados.cnpj || "Não informado");
  const nomeSocio = esc(dados.nome_socio || "Representante Legal");
  const cpfSocio = esc(dados.cpf_socio || "Não informado");
  const email = esc(dados.email || "Não informado");
  const telefone = esc(dados.telefone || "Não informado");
  const numeroProposta = esc(dados.numero_proposta || dados.id || "000");
  const valorTotal = Number(dados.valor_total || 0);
  const dataCriacao = new Date(dados.criado_em || Date.now()).toLocaleDateString("pt-BR");

  // Contratada configurada no admin (services/contratadaService.js); mesma do contrato enviado ao D4Sign
  const contratada = dados.contratada || contratadaPadrao(dados.tipo_proposta || dados.tipoProposta);
  const nomeContratada = String(contratada.razao_social || "").replace(/^o escritório contábil /i, "");
  const cnpjContratada = contratada.cnpj || "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Minuta de Contrato - ${nomeClinica} | #${numeroProposta}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; color: #1e293b; background: #f8fafc; padding: 40px 20px; line-height: 1.6; margin: 0; }
    .contract-sheet { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 50px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    .contract-header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { font-size: 20px; color: #0f172a; margin: 0 0 6px 0; font-weight: 800; }
    .sub { font-size: 13px; color: #64748b; margin: 0; font-weight: 600; }
    h2 { font-size: 14px; color: #0f172a; font-weight: 800; margin-top: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
    p { font-size: 13px; color: #334155; text-align: justify; margin-bottom: 12px; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e2e8f0; }
    .sign-box { text-align: center; font-size: 12px; color: #334155; }
    .sign-line { border-top: 1px solid #0f172a; margin-bottom: 8px; width: 80%; margin-left: auto; margin-right: auto; }
    .print-btn { display: inline-flex; align-items: center; gap: 6px; background: #0284c7; color: #fff; text-decoration: none; padding: 10px 20px; font-weight: 800; border-radius: 10px; font-size: 13px; border: none; cursor: pointer; margin-bottom: 20px; }
    @media print { .no-print { display: none; } body { background: #fff; padding: 0; } .contract-sheet { box-shadow: none; border: none; padding: 20px; } }
  </style>
</head>
<body>
  <div style="max-width:800px; margin:0 auto; display:flex; justify-content:space-between; align-items:center;" class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
    <a href="/api/propostas/${encodeURIComponent(dados.token_acesso)}/contrato/pdf" class="print-btn" style="background:#0f172a;">⬇️ Baixar PDF Oficial</a>
  </div>

  <div class="contract-sheet">
    <div class="contract-header">
      <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS PROFISSIONAIS</h1>
      <div class="sub">Instrumento Particular Vinculado à Proposta Nº #${numeroProposta}</div>
    </div>

    <h2>1. DAS PARTES CONTRATANTES</h2>
    <p><strong>CONTRATADA:</strong> ${esc(textoContratada(contratada))}.</p>
    <p><strong>CONTRATANTE:</strong> ${nomeClinica}, inscrita no CNPJ sob o nº ${cnpj}, representada neste ato por seu sócio/administrador(a) ${nomeSocio}, portador(a) do CPF nº ${cpfSocio}, e-mail ${email}, telefone ${telefone}.</p>

    <h2>2. DO OBJETO DO CONTRATO</h2>
    <p>O presente contrato tem por objeto a prestação de serviços especializados descritos detalhadamente na Proposta Comercial nº ${numeroProposta}, compreendendo assessoria, BPO financeiro, gestão estratégica, consultoria tributária e/ou tecnologia especializada para ${ehOdonto({ tipoProposta }) ? "clínicas e consultórios odontológicos" : "a área de saúde e clínicas médicas/odontológicas"}.</p>

    <h2>3. DOS VALORES E CONDIÇÕES DE PAGAMENTO</h2>
    <p>Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA o montante global/mensal estipulado na proposta comercial, totalizando <strong>R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>.</p>
    <p><em>Parágrafo Único:</em> O faturamento será processado mensalmente via boleto bancário ou Pix, com vencimento todo dia 10 (dez) de cada mês.</p>

    <h2>4. DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS (LGPD)</h2>
    <p>As partes comprometem-se a manter absoluto sigilo sobre quaisquer informações operacionais, financeiras e de pacientes obtidas em razão da execução do presente contrato, em estrita conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>

    <h2>5. DA VIGÊNCIA E RESCISÃO</h2>
    <p>O presente instrumento vigorará por prazo indeterminado (ou período mínimo de 12 meses), podendo ser rescindido mediante aviso prévio por escrito de 30 (trinta) dias, sem aplicação de multas abusivas.</p>

    <h2>6. DO FORO</h2>
    <p>Para dirimir quaisquer dúvidas oriundas deste contrato, as partes elegem o foro da sede da CONTRATADA, renunciando a qualquer outro por mais privilegiado que seja.</p>

    <div style="font-size: 12px; color: #64748b; margin-top: 30px;">Data de Emissão: ${dataCriacao}</div>

    <div class="sign-grid">
      <div class="sign-box">
        <div class="sign-line"></div>
        <strong>${esc(nomeContratada)}</strong><br>
        <small>CNPJ: ${esc(cnpjContratada)}</small>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <strong>${nomeClinica}</strong><br>
        <small>Resp: ${nomeSocio} (${cpfSocio})</small>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  gerarPDFContrato,
  gerarHTMLContrato,
};
