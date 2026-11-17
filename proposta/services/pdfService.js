const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");
// Contratada configurável por marca (admin); padrão = texto que já ia para o D4Sign
const { textoContratada, contratadaPadrao } = require("./contratadaService");

// Segmento exclusivo odonto: apenas FINORA atende odontologia / dentistas
function ehOdonto(dados) {
  return String(dados?.tipoProposta || dados?.tipo_proposta || "").toLowerCase() === "finora";
}

// Ícone de dente em vetor (caixa 24x24), desenhado centralizado em (x, y)
function desenharDente(doc, x, y, tamanho, cor) {
  const escala = tamanho / 24;
  doc
    .save()
    .translate(x - tamanho / 2, y - tamanho / 2)
    .scale(escala)
    .path("M7 3C4.5 3 3 5 3 7.5c0 2 .8 3.5 1.5 5 .6 1.4.8 3 1.2 4.8.4 1.9 1 3.7 2.1 3.7 1.3 0 1.4-2.3 1.9-4.2.3-1.2.8-1.8 1.3-1.8s1 .6 1.3 1.8c.5 1.9.6 4.2 1.9 4.2 1.1 0 1.7-1.8 2.1-3.7.4-1.8.6-3.4 1.2-4.8.7-1.5 1.5-3 1.5-5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z")
    .fill(cor)
    .restore();
}

function gerarPDFProposta(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    // === OPÇÕES DE CUSTOMIZAÇÃO ===
    const pdfTheme = dados.pdfTheme || "moderno";
    const pdfCover = dados.pdfCover === true || dados.pdfCover === "true";
    const showApresentacao = dados.showApresentacao !== false && dados.showApresentacao !== "false";
    const showCondicoesGerais = dados.showCondicoesGerais !== false && dados.showCondicoesGerais !== "false";

    const coresPorTipo = {
      finora: "#663399",
      contabil: "#12c8c2",
      tech: "#315cff",
      auditoria: "#1e3a5f",
      lagerhaus: "#C8860A",
    };

    const tipoProposta = dados.tipoProposta || dados.tipo_proposta || "finora";

    // === PALETA DE CORES POR TEMA ===
    let corTexto, corPrimaria, corDestaque, corBordaFrame;

    if (pdfTheme === "impressao") {
      corTexto = "#000000";
      corPrimaria = "#334155";
      corDestaque = "#0f172a";
      corBordaFrame = "#cbd5e1";
    } else if (pdfTheme === "classico") {
      corTexto = "#2c2c2c";
      corPrimaria = "#4a4a4a";
      corDestaque = "#2c2c2c";
      corBordaFrame = null;
    } else if (pdfTheme === "criativo") {
      corTexto = "#1e1b4b";
      corPrimaria = coresPorTipo[tipoProposta] || "#6d28d9";
      corDestaque = corPrimaria;
      corBordaFrame = corPrimaria;
    } else {
      // moderno (padrão)
      corTexto = "#334155";
      corPrimaria = coresPorTipo[tipoProposta] || "#12c8c2";
      corDestaque = corPrimaria;
      corBordaFrame = null;
    }

    const larguraUtil = 495;
    const marcas = {
      finora: {
        nome: "FINORA",
        subtitulo: "Assessoria e Inteligência Financeira",
        logo: "finora.png",
        assinatura: "Equipe Comercial FINORA.",
        fallbackNome: "FINORA",
        fallbackSubtitulo: "Inteligência Financeira",
      },
      contabil: {
        nome: "QMAX CONTÁBIL",
        subtitulo: "Account | Tax | Financial",
        logo: "contabil.png",
        assinatura: "Equipe Comercial QMAX Contábil.",
        fallbackNome: "QMAX",
        fallbackSubtitulo: "Account | Tax | Financial",
      },
      tech: {
        nome: "QMAX TECH",
        subtitulo: "Tecnologia e Soluções Digitais",
        logo: "tech.png",
        assinatura: "Equipe Comercial QMAX Tech.",
        fallbackNome: "QMAX TECH",
        fallbackSubtitulo: "Tecnologia e Soluções Digitais",
      },
      // Sem logo em public/assets/logos: o cabeçalho usa o nome em texto (fallback)
      auditoria: {
        nome: "QMAX AUDITORIA",
        subtitulo: "Auditoria e Conformidade",
        logo: "auditoria.png",
        assinatura: "Equipe QMAX Auditoria.",
        fallbackNome: "QMAX AUDITORIA",
        fallbackSubtitulo: "Auditoria e Conformidade",
      },
      lagerhaus: {
        nome: "LAGERHAUS",
        subtitulo: "Coworking e Endereço Comercial",
        logo: "lagerhaus.png",
        assinatura: "Equipe de Operações Lagerhaus.",
        fallbackNome: "LAGERHAUS",
        fallbackSubtitulo: "Coworking e Endereço Comercial",
      },
    };

    const marca = marcas[tipoProposta] || marcas.finora;
    const odonto = ehOdonto({ tipoProposta });
    const subtituloCapa = odonto ? "Contabilidade especializada em Odontologia" : marca.subtitulo;

    // Separador de milhar (R$ 12.500,00) e valor ausente vira R$ 0,00 em vez de "R$ NaN"
    const formatarMoeda = (valor) =>
      `R$ ${(Number(valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    // dataProposta chega como "AAAA-MM-DD" ou Date (registro do banco): split em Date derrubava o PDF
    const dataPropostaBr = (() => {
      const d = dados.dataProposta;
      if (d instanceof Date) return d.toLocaleDateString("pt-BR");
      return d ? String(d).slice(0, 10).split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR");
    })();

    const configTexto = { width: larguraUtil, align: "justify", lineGap: 2 };

    const addPageIfNeeded = (limite = 680) => {
      if (doc.y > limite) {
        doc.addPage();
        doc.y = 50;
        doc.x = 50;
      }
    };

    // === CAPA PERSONALIZADA ===
    if (pdfCover) {
      // Fundo colorido full-page
      doc.rect(0, 0, 595, 842).fill(pdfTheme === "classico" ? "#f5f5f5" : corPrimaria);

      // Barra decorativa inferior
      doc.rect(0, 790, 595, 52).fill(pdfTheme === "classico" ? "#d0d0d0" : "rgba(0,0,0,0.25)");

      // Logo ou nome da empresa centralizado
      const logoPathCover = path.join(__dirname, "../public/assets/logos", marca.logo);
      if (fs.existsSync(logoPathCover)) {
        doc.image(logoPathCover, 237, 80, { width: 120 });
      } else {
        doc
          .fillColor(pdfTheme === "classico" ? corDestaque : "#ffffff")
          .font("Helvetica-Bold")
          .fontSize(36)
          .text(marca.fallbackNome, 50, 110, { align: "center", width: 495 });
      }

      // Linha decorativa
      const linhaCoverY = 230;
      doc
        .save()
        .moveTo(100, linhaCoverY)
        .lineTo(495, linhaCoverY)
        .lineWidth(1.5)
        .strokeColor(pdfTheme === "classico" ? "#bbb" : "rgba(255,255,255,0.4)")
        .stroke()
        .restore();

      // Título da proposta ou contrato
      const tituloPrincipal = dados.isContrato ? "CONTRATO DE PRESTAÇÃO DE SERVIÇOS" : "PROPOSTA COMERCIAL";
      doc
        .fillColor(pdfTheme === "classico" ? corDestaque : "#ffffff")
        .font("Helvetica-Bold")
        .fontSize(dados.isContrato ? 20 : 28) // Menor tamanho para caber o título maior
        .text(tituloPrincipal, 50, 250, { align: "center", width: 495 });

      // Subtítulo
      doc
        .fillColor(pdfTheme === "classico" ? "#555" : "rgba(255,255,255,0.8)")
        .font("Helvetica")
        .fontSize(13)
        .text(subtituloCapa, 50, 295, { align: "center", width: 495 });

      if (odonto) desenharDente(doc, 297, 340, 28, pdfTheme === "classico" ? corDestaque : "#ffffff");

      // Informações do cliente
      const labelCliente = dados.isContrato ? "CONTRATANTE:" : "APRESENTADO PARA:";
      const clienteY = 380;
      doc
        .fillColor(pdfTheme === "classico" ? "#333" : "rgba(255,255,255,0.9)")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(labelCliente, 50, clienteY, { align: "center", width: 495 });

      doc
        .fillColor(pdfTheme === "classico" ? corDestaque : "#ffffff")
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(dados.nomeClinica || "Cliente", 50, clienteY + 22, { align: "center", width: 495 });

      if (dados.nomeSocio) {
        doc
          .fillColor(pdfTheme === "classico" ? "#555" : "rgba(255,255,255,0.8)")
          .font("Helvetica")
          .fontSize(11)
          .text(`Atenção: ${dados.nomeSocio}`, 50, clienteY + 52, { align: "center", width: 495 });
      }

      // Nº proposta e data
      const labelNumero = dados.isContrato ? "Contrato Nº" : "Nº";
      doc
        .fillColor(pdfTheme === "classico" ? "#777" : "rgba(255,255,255,0.65)")
        .font("Helvetica")
        .fontSize(10)
        .text(`${labelNumero} ${dados.numeroProposta}  |  ${dataPropostaBr}`, 50, 520, { align: "center", width: 495 });

      // Validade
      doc
        .fillColor(pdfTheme === "classico" ? "#777" : "rgba(255,255,255,0.55)")
        .font("Helvetica")
        .fontSize(9)
        .text("Validade: 10 dias a partir da data de emissão", 50, 540, { align: "center", width: 495 });

      // Rodapé da capa (fica abaixo da margem inferior; sem zerar a margem o PDFKit abre uma página em branco)
      doc.page.margins.bottom = 0;
      doc
        .fillColor(pdfTheme === "classico" ? "#555" : "rgba(255,255,255,0.7)")
        .font("Helvetica")
        .fontSize(8)
        .text(`${marca.nome} · ${marca.subtitulo}`, 50, 810, { align: "center", width: 495 });

      doc.addPage();
    }

    // === CABEÇALHO PADRÃO ===
    const logoPath = path.join(__dirname, "../public/assets/logos", marca.logo);

    // Fundo do cabeçalho no tema Criativo
    if (pdfTheme === "criativo") {
      doc.rect(0, 0, 595, 110).fill(corPrimaria);
      doc.rect(0, 105, 595, 6).fill("rgba(0,0,0,0.15)");
    } else if (pdfTheme === "classico") {
      doc.rect(0, 0, 595, 100).fill("#f0f0f0");
      doc.save().moveTo(0, 100).lineTo(595, 100).lineWidth(1).strokeColor("#ccc").stroke().restore();
    }

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 120 });
      doc.moveDown(2);
    } else {
      doc
        .fillColor(pdfTheme === "criativo" ? "#ffffff" : corPrimaria)
        .fontSize(28)
        .font("Helvetica-Bold")
        .text(marca.fallbackNome, 50, 40);
      doc
        .fillColor(pdfTheme === "criativo" ? "rgba(255,255,255,0.8)" : "#ffffff")
        .fontSize(12)
        .font("Helvetica")
        .text(marca.fallbackSubtitulo, 170, 52);
      doc.moveDown(3);
    }

    const docHeaderTitle = dados.isContrato ? "CONTRATO DE PRESTAÇÃO DE SERVIÇOS" : "PROPOSTA COMERCIAL";
    doc
      .fillColor(pdfTheme === "criativo" ? "#ffffff" : corDestaque)
      .fontSize(dados.isContrato ? 11 : 16) // Ajusta tamanho do cabeçalho caso contrato
      .font("Helvetica-Bold")
      .text(docHeaderTitle, 50, doc.y, { align: "right" });

    doc
      .fillColor(pdfTheme === "criativo" ? "rgba(255,255,255,0.85)" : corTexto)
      .fontSize(12)
      .font("Helvetica")
      .text(`${dados.isContrato ? "Contrato" : "Nº"} ${dados.numeroProposta}`, { align: "right" });

    doc
      .fontSize(10)
      .text(dataPropostaBr, {
        align: "right",
      });

    doc
      .fillColor(pdfTheme === "criativo" ? "rgba(255,255,255,0.9)" : corPrimaria)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`${dados.nomeClinica || "Cliente"}`, { align: "right" });

    if (odonto) {
      const perfil = ["Clínica Odontológica"];
      if (Number(dados.cadeiras) > 0) perfil.push(`${dados.cadeiras} cadeira(s)`);
      if (Number(dados.dentistasParceiros) > 0) perfil.push(`${dados.dentistasParceiros} dentista(s) parceiro(s)`);
      if (Number(dados.socios) > 0) perfil.push(`${dados.socios} sócio(s)`);
      doc
        .fillColor(pdfTheme === "criativo" ? "rgba(255,255,255,0.85)" : corTexto)
        .fontSize(9)
        .font("Helvetica")
        .text(perfil.join("  ·  "), { align: "right" });
    }

    doc.moveDown(2);

    doc.x = 50;
    if (tipoProposta === "tech") {
      gerarPDFTech(doc, dados, {
        corPrimaria,
        corTexto,
        corDestaque,
        larguraUtil,
        formatarMoeda,
        addPageIfNeeded,
        marca,
      });

      const range = doc.bufferedPageRange();
      const totalPaginas = range.count;

      for (let i = range.start; i < range.start + totalPaginas; i++) {
        doc.switchToPage(i);
        doc
          .save()
          .lineWidth(1)
          .strokeColor("#315cff")
          .roundedRect(20, 20, 555, 790, 10)
          .stroke()
          .restore();

        doc.save().rect(20, 20, 555, 18).fill("#315cff").restore();
        doc.save().rect(50, 755, larguraUtil, 1).fill("#e2e8f0").restore();

        // Mesmo rodapé de validação das outras marcas (o PDF da Tech saía só com o nome da marca)
        const tokenTech = dados.token_acesso || dados.tokenAcesso || "";
        const hostTech = String(process.env.BASE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#64748b")
          .text(tokenTech ? `Autenticação Digital: SHA-256 [${String(tokenTech).substring(0, 16)}...]` : "Prévia - documento sem validação", 50, 762, {
            width: 320,
            lineBreak: false,
          });

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#94a3b8")
          .text(tokenTech ? `${marca.nome} • Validação: ${hostTech}${process.env.APP_BASE_PATH || "/proposta"}/p/${tokenTech}` : `${marca.nome} - ${marca.subtitulo}`, 50, 772, {
            width: 320,
            lineBreak: false,
          });

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#94a3b8")
          .text(`Página ${i + 1} de ${totalPaginas}`, 400, 765, {
            width: 145,
            align: "right",
            lineBreak: false,
          });
      }

      doc.end();
      return;
    }
    const apresentacoes = {
      finora: [
        "O FINORA foi desenvolvido para oferecer uma análise clara e objetiva sobre as principais formas de tributação aplicáveis a profissionais da odontologia e clínicas, permitindo uma visão comparativa que facilita a tomada de decisão sobre o regime tributário mais vantajoso.",

        "Este produto foi idealizado pelo CEO do Grupo Q-Max do Brasil, Hugo L. Werninghaus, contador e empresário, especialista em gestão de clínicas odontológicas, mestre em Ciências Contábeis pela PUC/SP, presidente do conselho do Grupo Q-Max e conselheiro empresarial.",

        "Nesta jornada Hugo não está sozinho. Atua juntamente com Luciano Fiel Reis, contador e administrador de empresas, professor de graduação e pós-graduação, além de Alessandra F. dos Passos, contadora e perita contábil, ambos profissionais com ampla experiência em gestão empresarial, planejamento tributário e desenvolvimento organizacional.",

        "Os sócios participam ativamente da construção das metodologias e análises desenvolvidas dentro do FINORA, garantindo segurança técnica, experiência prática e visão estratégica para os clientes.",

        "Após ouvirmos as dores dos proprietários de clínicas e cirurgiões dentistas, desenvolvemos o FINORA com o objetivo de proporcionar economia tributária, previsibilidade financeira e melhoria contínua da gestão empresarial.",
      ],

      contabil: [
        "A QMAX Contábil foi estruturada para atender clínicas, consultórios e empresas que buscam uma gestão contábil moderna, segura e alinhada aos objetivos estratégicos do negócio.",

        "Nossa atuação vai além do cumprimento das obrigações legais. Trabalhamos com foco em organização financeira, planejamento tributário, conformidade fiscal, gestão trabalhista e suporte gerencial para tomada de decisões.",

        "A operação é conduzida por profissionais com ampla experiência em contabilidade, gestão empresarial, controladoria e consultoria para empresas em crescimento, garantindo acompanhamento próximo e informações confiáveis para nossos clientes.",

        "Ao longo dos anos, a QMAX consolidou uma metodologia própria baseada em proximidade, tecnologia e visão estratégica, permitindo que empresários concentrem esforços no crescimento do negócio enquanto nossa equipe cuida da estrutura contábil, fiscal e trabalhista.",

        "Acreditamos que uma contabilidade eficiente deve fornecer inteligência para apoiar decisões, gerar segurança e contribuir diretamente para o crescimento sustentável das empresas.",
      ],
    };

    // Marca sem texto próprio não recebe a apresentação de outra marca
    const textosApresentacao = apresentacoes[tipoProposta] || [];

    // === SEÇÃO APRESENTAÇÃO / PREÂMBULO (togglable) ===
    if (dados.isContrato) {
      // Preâmbulo de Contrato
      doc
        .fillColor(corDestaque)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS");

      doc.moveDown(0.8);
      doc.fillColor(corTexto).font("Helvetica").fontSize(10);

      const situacaoCNPJ = dados.documentoStatus && dados.documentoStatus !== 'ATIVA' ? ` (Situação: ${dados.documentoStatus})` : '';
      const preambuloText = `Pelo presente instrumento particular de Contrato de Prestação de Serviços, de um lado ${dados.nomeClinica || "Cliente"}, pessoa jurídica de direito privado devidamente registrada no CNPJ sob o nº ${dados.cnpj || "____________________"}${situacaoCNPJ}, com sede à ${dados.enderecoClinica || "____________________"}${odonto ? ", atuante na área odontológica" : ""}, denominado CONTRATANTE neste ato representada por ${dados.nomeSocio || "____________________"}, portador(a) do CPF sob o nº ${dados.cpfSocio || "____________________"}, e ${textoContratada(dados.contratada || contratadaPadrao(tipoProposta))}, mediante as cláusulas e condições seguintes:`;

      doc.text(preambuloText, configTexto);
      doc.moveDown(1.5);
    } else if (showApresentacao && textosApresentacao.length) {
      doc
        .fillColor(corDestaque)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("APRESENTAÇÃO");

      doc.moveDown(0.5);
      doc.fillColor(corTexto).font("Helvetica").fontSize(10);

      textosApresentacao.forEach((texto) => {
        doc.text(texto, configTexto);
        doc.moveDown(0.5);
      });
      if (tipoProposta === "finora") {
        doc.moveDown(1);

        doc
          .font("Helvetica-Bold")
          .fillColor(corDestaque)
          .text("Seja bem-vindos!", { align: "center" });

        doc
          .font("Helvetica")
          .fillColor(corTexto)
          .text("Hugo Ludwig Werninghaus", { align: "center" });

        doc.text("Chief Executive Officer", { align: "center" });

        doc.moveDown(1);
      }

      if (doc.y > 620) {
        doc.addPage();
      } else {
        doc.moveDown(2);
      }
    }

    doc.x = 50;
    doc
      .fillColor(corDestaque)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(dados.isContrato ? "CLÁUSULA PRIMEIRA – DO OBJETO E ESCOPO" : "ESCOPO DOS TRABALHOS");

    doc.moveDown(0.5);
    doc.fillColor(corTexto).font("Helvetica").fontSize(10);

    doc.text(
      dados.isContrato
        ? "Constitui objeto do presente instrumento a prestação de serviços profissionais pela CONTRATADA, de acordo com o escopo detalhado a seguir:"
        : "A seguir apresentamos os serviços a serem executados:",
      configTexto,
    );
    doc.moveDown(1);

    const escopos = [...(dados.topicosPdf || [])];
    escopos.forEach((sessao) => {
      addPageIfNeeded(670);

      doc
        .font("Helvetica-Bold")
        .fillColor(corDestaque)
        .text(sessao.titulo, { width: larguraUtil });

      doc.moveDown(0.2);
      doc.font("Helvetica").fillColor(corTexto);

      const itensTopico =
        sessao.itens ||
        String(sessao.texto || "")
          .split("\n")
          .filter((linha) => linha.trim());

      itensTopico.forEach((item) => {
        addPageIfNeeded(700);

        doc.text(`•  ${item}`, {
          width: larguraUtil,
          indent: 15,
          align: "justify",
          lineGap: 1.5,
        });
      });

      doc.moveDown(0.8);
    });
    const servicosEspeciais = (dados.itens || []).filter(
      (item) =>
        (item.servico === "Proposta Personalizada" ||
          item.servico === "Auditoria") &&
        item.topicosPersonalizados &&
        item.topicosPersonalizados.length,
    );

    if (servicosEspeciais.length) {
      addPageIfNeeded(620);

      doc
        .fillColor(corDestaque)
        .font("Helvetica-Bold")
        .fontSize(12)
        .text("SERVIÇOS ESPECIAIS", 50, doc.y);

      doc.moveDown(0.8);

      servicosEspeciais.forEach((servico) => {
        addPageIfNeeded(660);

        doc
          .fillColor(corPrimaria)
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(servico.servico.toUpperCase(), 50, doc.y);

        doc.moveDown(0.5);

        const linhas = servico.topicosPersonalizados || [];

        linhas.forEach((linha, index) => {
          const texto = String(linha || "").trim();
          if (!texto) return;

          const proximaLinha = String(linhas[index + 1] || "").trim();

          addPageIfNeeded(705);

          const ehBullet = texto.startsWith("-") || texto.startsWith("•");

          const proximaEhBullet =
            proximaLinha.startsWith("-") || proximaLinha.startsWith("•");

          if (!ehBullet && proximaEhBullet) {
            doc.moveDown(0.3);
            doc
              .font("Helvetica-Bold")
              .fontSize(10)
              .fillColor(corDestaque)
              .text(texto.toUpperCase(), {
                width: larguraUtil,
              });

            return;
          }

          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(corTexto)
            .text(`• ${texto.replace(/^-+/, "").replace(/^•+/, "").trim()}`, {
              width: larguraUtil,
              indent: 15,
              align: "justify",
              lineGap: 1.5,
            });
        });
        doc.moveDown(1);
      });
    }

    addPageIfNeeded(600);

    doc
      .fillColor(corDestaque)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(dados.isContrato ? "CLÁUSULA SEGUNDA – DO PREÇO E CONDIÇÕES DE PAGAMENTO" : "INVESTIMENTOS", 50, doc.y);

    doc.moveDown(0.5);
    doc.fillColor(corTexto).font("Helvetica").fontSize(10);

    doc.text(
      dados.isContrato
        ? "Pelos serviços contratados, a CONTRATANTE pagará à CONTRATADA os valores descritos nas tabelas de honorários abaixo:"
        : "A seguir apresentaremos os investimentos para cada serviço a ser contratado:",
      configTexto,
    );

    doc.moveDown(1);

    const itensMensais = dados.itens.filter((item) => {
      const obs = (item.observacao || "").toLowerCase();
      return (
        !obs.includes("pontual") &&
        !obs.includes("implanta") && // cobre "Implantação" e "implanta"
        !obs.includes("taxas") &&
        !obs.includes("emissão") &&
        !obs.includes("renovação")
      );
    });

    const itensPontuais = dados.itens.filter((item) => {
      const obs = (item.observacao || "").toLowerCase();
      return (
        obs.includes("pontual") ||
        obs.includes("implanta") || // cobre "Implantação" e "implanta"
        obs.includes("taxas") ||
        obs.includes("emissão") ||
        obs.includes("renovação")
      );
    });

    let tableY = doc.y;

    function desenharTabela(titulo, itens, totalLabel, totalValor) {
      if (!itens.length) return;

      if (tableY > 640) {
        doc.addPage();
        tableY = 50;
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(corDestaque)
        .text(titulo, 50, tableY);

      tableY += 22;

      doc.rect(50, tableY, larguraUtil, 24).fill("#e2e8f0");
      doc.font("Helvetica-Bold").fillColor(corDestaque).fontSize(10);
      doc.text("Serviço", 65, tableY + 7);
      doc.text("Observação", 280, tableY + 7);
      doc.text("Valor", 340, tableY + 7, { width: 80, align: "right" });
      doc.text("Final", 440, tableY + 7, { width: 90, align: "right" });

      tableY += 24;

      itens.forEach((item, i) => {
        if (tableY > 720) {
          doc.addPage();
          tableY = 50;
        }

        const bgColor = i % 2 === 0 ? "#f8fafc" : "#ffffff";
        doc.rect(50, tableY, larguraUtil, 22).fill(bgColor);

        doc.font("Helvetica").fillColor(corTexto).fontSize(9);
        doc.text(item.servico, 65, tableY + 6, { width: 200 });
        doc.text(item.observacao || "-", 260, tableY + 6, { width: 70 });
        const temDesconto = Number(item.descontoPercentual || 0) > 0;
        const valorOriginal = Number(item.valorOriginal || item.valor || 0);
        const valorFinal = Number(item.valor || 0);

        if (temDesconto) {
          doc.fillColor("#94a3b8").fontSize(8);
          doc.text(formatarMoeda(valorOriginal), 340, tableY + 4, {
            width: 80,
            align: "right",
          });

          doc.fillColor("#ef4444").fontSize(7);
          doc.text(`-${item.descontoPercentual}%`, 340, tableY + 14, {
            width: 80,
            align: "right",
          });

          doc.fillColor(corPrimaria).font("Helvetica-Bold").fontSize(9);
          doc.text(formatarMoeda(valorFinal), 440, tableY + 8, {
            width: 90,
            align: "right",
          });
        } else {
          doc.fillColor(corTexto).fontSize(9);
          doc.text(formatarMoeda(valorFinal), 440, tableY + 8, {
            width: 90,
            align: "right",
          });
        }

        tableY += 22;
      });

      if (tableY > 700) {
        doc.addPage();
        tableY = 50;
      }

      doc.rect(50, tableY, larguraUtil, 28).fill("#e0f2fe");
      doc.font("Helvetica-Bold").fillColor(corDestaque).fontSize(10);
      doc.text(totalLabel, 65, tableY + 9);

      doc.fillColor(corPrimaria).fontSize(11);
      doc.text(formatarMoeda(totalValor), 400, tableY + 8, {
        width: 130,
        align: "right",
      });

      tableY += 42;
    }

    desenharTabela(
      "INVESTIMENTO MENSAL",
      itensMensais,
      "TOTAL MENSAL",
      dados.totalMensal ||
        itensMensais.reduce((acc, item) => acc + (Number(item.valor) || 0), 0),
    );

    desenharTabela(
      "INVESTIMENTO PONTUAL",
      itensPontuais,
      "TOTAL PONTUAL",
      dados.totalPontual ||
        itensPontuais.reduce((acc, item) => acc + (Number(item.valor) || 0), 0),
    );

    const temDesconto = dados.valorDesconto && Number(dados.valorDesconto) > 0;

    if (temDesconto) {
      if (tableY > 690) {
        doc.addPage();
        tableY = 50;
      }

      doc.rect(50, tableY, larguraUtil, 24).fill("#f1f5f9");
      doc.font("Helvetica").fillColor(corTexto).fontSize(10);
      doc.text("Subtotal", 65, tableY + 7);
      doc.text(formatarMoeda(dados.total), 400, tableY + 7, {
        width: 130,
        align: "right",
      });
      tableY += 24;

      doc.rect(50, tableY, larguraUtil, 24).fill("#fef2f2");
      doc.font("Helvetica-Bold").fillColor("#ef4444").fontSize(10);
      doc.text(
        `Desconto Comercial (${Number(dados.percentualDesconto) || 0}%)`,
        65,
        tableY + 7,
      );
      doc.text(`- ${formatarMoeda(dados.valorDesconto)}`, 400, tableY + 7, {
        width: 130,
        align: "right",
      });
      tableY += 24;
    }

    const totalMensalFinal =
      Number(dados.totalMensal || 0) ||
      itensMensais.reduce((acc, item) => acc + Number(item.valor || 0), 0);

    const totalPontualFinal =
      Number(dados.totalPontual || 0) ||
      itensPontuais.reduce((acc, item) => acc + Number(item.valor || 0), 0);

    if (tableY > 660) {
      doc.addPage();
      tableY = 50;
    }

    doc.rect(50, tableY, larguraUtil, 58).fill("#f8fafc");

    doc.font("Helvetica-Bold").fillColor(corDestaque).fontSize(10);
    doc.text("INVESTIMENTO MENSAL", 70, tableY + 12);

    doc.fillColor(corPrimaria).fontSize(13);
    doc.text(formatarMoeda(totalMensalFinal), 70, tableY + 30);

    doc.font("Helvetica-Bold").fillColor(corDestaque).fontSize(10);
    doc.text("INVESTIMENTO PONTUAL", 320, tableY + 12);

    doc.fillColor(corPrimaria).fontSize(13);
    doc.text(formatarMoeda(totalPontualFinal), 320, tableY + 30);

    tableY += 58;
    doc.y = tableY + 28;

    if (doc.y > 660) {
      doc.addPage();
      doc.y = 50;
    }

    doc.x = 50;
    doc
      .font("Helvetica-Bold")
      .fillColor(corDestaque)
      .fontSize(10)
      .text(dados.isContrato ? "PARÁGRAFO ÚNICO – DAS CONDIÇÕES DE FATURAMENTO:" : "Observações, nossos honorários:");

    doc.moveDown(0.3);
    doc.font("Helvetica").fillColor(corTexto);

    const observacoes = dados.isContrato ? [
      "Os honorários mensais contemplam 13 (treze) parcelas anuais, vencendo-se a parcela adicional no mês de dezembro de cada ano correspondente.",
      "Os valores acordados serão revisados trimestralmente, podendo ser ajustados caso haja variação relevante no volume de operações.",
      "As custas, taxas governamentais, alvarás, licenças e multas não integram os honorários descritos, sendo de responsabilidade integral da CONTRATANTE.",
      "Os honorários serão reajustados anualmente no mês de janeiro de acordo com a variação acumulada do salário mínimo nacional.",
    ] : [
      "são compostos de 13 parcelas anuais a qual ocorre no mês de dezembro de cada ano.",
      "são revistos periodicamente, a cada 3 meses, e no caso de variações relevantes nas atividades uma nova proposta pode ser apresentada.",
      "não contemplam taxas/multas.",
      "são corrigidos em janeiro de cada ano de acordo com o índice de variação do salário mínimo nacional.",
    ];

    observacoes.forEach((obs) => {
      addPageIfNeeded(700);

      doc.text(`- ${obs}`, {
        width: larguraUtil,
        indent: 10,
        align: "justify",
        lineGap: 1.5,
      });
    });

    doc.moveDown(1.5);

    doc.text(
      "Agradecemos à oportunidade de apresentar a nossa proposta e esperamos que os temas e as condições abordadas correspondam às expectativas e caso concordem com a presente proposta, agradecemos receber o “de acordo”, que constituirá instrumento contratual para iniciarmos nossos trabalhos.",
      configTexto,
    );

    doc.moveDown(0.5);

    doc.text(
      "Colocamo-nos à disposição de V.Sª. para prestar quaisquer esclarecimentos julgados necessários.",
      configTexto,
    );

    doc.moveDown(2);

    doc
      .font("Helvetica-Bold")
      .fillColor(corDestaque)
      .text(`Atenciosamente,\n${marca.assinatura}`, { width: larguraUtil });

    if (doc.y > 630) {
      doc.addPage();
      doc.y = 50;
    } else {
      doc.moveDown(2);
    }

    // === SEÇÃO CONDIÇÕES GERAIS (togglable) ===
    if (!showCondicoesGerais) {
      // Pular geração das condições gerais
      // (continua para rodapé)
    } else {
    doc
      .fillColor(corDestaque)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("CONDIÇÕES GERAIS", { align: "center" });

    doc.moveDown(1.5);
    doc.fillColor(corTexto).font("Helvetica").fontSize(9);

    const condicoesGerais = [
      {
        titulo: "1. Confidencialidade da Proposta",
        texto:
          "Esta proposta é estritamente confidencial e de propriedade da GRUPO Q-MAX DO BRASIL e, portanto, não deve ser entregue a nenhuma outra parte além da contratante. O conteúdo e o conceito geral desta proposta poderão ser divulgados para cumprimento do previsto na legislação e regulamentação aplicáveis à Contratante, incluindo, sem limitação, a divulgação no site do Grupo Q-Max do Brasil e órgãos competentes, conforme legislação. No caso de V.Sas. não aceitarem esta proposta e escolherem outra empresa para assessorá-los, ou decidirem proceder ao trabalho individualmente, solicitamos a destruição desta.",
      },
      {
        titulo: "2. Validade",
        texto:
          "A presente proposta tem validade de 10 (dez) dias, depois dos quais a GRUPO Q-MAX DO BRASIL pode modificar quaisquer termos e condições aqui estipuladas.",
      },
      {
        titulo: "3. Aceitação da Proposta",
        texto:
          "Esta proposta constitui-se em um acordo fidedigno entre as partes com respeito ao assunto objeto desta e substituirá e cancelará quaisquer outros acordos anteriores, tanto escritos quanto verbais, entre as partes e terceiros, com relação ao seu assunto objeto.",
      },
      {
        titulo: "4. Parcela Adicional",
        texto:
          "A parcela adicional será efetuada anualmente em dezembro, como forma de reconhecimento pelo serviço contínuo prestado ao longo do ano.",
      },
      {
        titulo: "5. Rescisão",
        texto:
          "O compromisso poderá ser rescindido, em comum acordo entre as partes, com 60 dias de antecedência. Caso isto não ocorra, fica estipulado o valor referente a 2 honorários mensais a título de indenização.",
      },
      {
        titulo: "6. Reajustes",
        texto:
          "Nossos honorários serão reajustados todo janeiro do ano subsequente à contratação de acordo com o percentual de aumento do salário mínimo nacional.",
      },
      {
        titulo: "7. Da não contratação de nossos profissionais",
        texto:
          "A CONTRATANTE não fará proposta e tampouco contratará funcionários do GRUPO Q-MAX por um prazo mínimo de 24 meses após o término do relacionamento, sujeito a multa de 50 vezes o valor deste contrato.",
      },
      {
        titulo: "8. Propriedade de Modelos, Ferramentas e Tecnologia",
        texto:
          "Os modelos, ferramentas e tecnologias utilizados na realização dos trabalhos descritos nesta proposta são de propriedade da GRUPO Q-MAX.",
      },
      {
        titulo: "9. Conflito de Interesses",
        texto:
          "Até a presente data, não estamos cientes de situações que possam constituir conflito de interesses ou impedimento para a prestação dos serviços propostos.",
      },
      {
        titulo: "10. Responsabilidade e Indenização",
        texto:
          "A responsabilidade da GRUPO Q-MAX pelas obrigações assumidas nesta proposta será limitada ao valor dos honorários recebidos.",
      },
      {
        titulo: "11. Lei Geral da Proteção de Dados - LGPD",
        texto:
          "Desenvolvemos nossos trabalhos a partir das premissas da LGPD, observando finalidade, adequação, transparência, segurança, prevenção e governança no tratamento dos dados.",
      },
      {
        titulo: "12. Autorização para Publicar",
        texto:
          "Após a conclusão do trabalho e mediante prévia revisão e aprovação de texto, a Administração da Contratante autoriza a GRUPO Q-MAX a publicar esta experiência como referência promocional.",
      },
    ];

    condicoesGerais.forEach((condicao) => {
      addPageIfNeeded(660);

      doc
        .font("Helvetica-Bold")
        .fillColor(corDestaque)
        .text(condicao.titulo, { width: larguraUtil });

      doc.moveDown(0.2);

      doc.font("Helvetica").fillColor(corTexto).text(condicao.texto, {
        width: larguraUtil,
        align: "justify",
        lineGap: 1.5,
      });

      doc.moveDown(0.8);
    });
    } // fim do bloco showCondicoesGerais

    const range = doc.bufferedPageRange();
    const totalPaginas = range.count;

    for (let i = range.start; i < range.start + totalPaginas; i++) {
      doc.switchToPage(i);

      // Moldura do tema Criativo em todas as páginas
      if (pdfTheme === "criativo") {
        doc
          .save()
          .lineWidth(1.5)
          .strokeColor(corBordaFrame || corPrimaria)
          .roundedRect(15, 15, 565, 812, 6)
          .stroke()
          .restore();
      }

      // Moldura externa (Tech mantém original)
      if (tipoProposta === "tech" && pdfTheme !== "criativo") {
        doc
          .save()
          .lineWidth(1)
          .strokeColor("#315cff")
          .roundedRect(20, 20, 555, 790, 10)
          .stroke()
          .restore();

        doc.save().rect(20, 20, 555, 18).fill("#315cff").restore();
      }
      doc.save().rect(50, 755, larguraUtil, 1).fill(pdfTheme === "classico" ? "#ccc" : "#e2e8f0").restore();

      // Link de validação só existe com o token real; prévia (sem proposta salva) não imprime link falso
      const tokenAutenticacao = dados.token_acesso || dados.tokenAcesso || "";
      const shortHash = String(tokenAutenticacao).substring(0, 16);
      const hostValidacao = String(process.env.BASE_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(tokenAutenticacao ? `Autenticação Digital: SHA-256 [${shortHash}...]` : "Prévia - documento sem validação", 50, 762, {
          width: 320,
          lineBreak: false,
        });

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(tokenAutenticacao ? `${marca.nome} • Validação: ${hostValidacao}${process.env.APP_BASE_PATH || "/proposta"}/p/${tokenAutenticacao}` : marca.nome, 50, 772, {
          width: 320,
          lineBreak: false,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#64748b")
        .text(`Página ${i + 1} de ${totalPaginas}`, 400, 765, {
          width: 145,
          align: "right",
          lineBreak: false,
        });
    }

    doc.end();
  });
}
function gerarPDFTech(doc, dados, utils) {
  const {
    corPrimaria,
    corTexto,
    corDestaque,
    larguraUtil,
    formatarMoeda,
    addPageIfNeeded,
    marca,
  } = utils;

  const itens = dados.itens || [];

  const plano = itens.find((item) =>
    String(item.observacao || "")
      .toLowerCase()
      .includes("implanta"), // cobre "Implantação" e "implanta"
  );

  const mensalidade = itens.find((item) =>
    String(item.observacao || "")
      .toLowerCase()
      .includes("mensal"),
  );

  const inclusos = plano?.detalhes || [];

  function titulo(texto) {
    addPageIfNeeded(660);
    doc.moveDown(1);
    doc
      .fillColor(corDestaque)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(texto.toUpperCase(), 50, doc.y, { width: larguraUtil });
    doc.moveDown(0.6);
  }

  function paragrafo(texto) {
    addPageIfNeeded(700);
    doc.fillColor(corTexto).font("Helvetica").fontSize(10).text(texto, {
      width: larguraUtil,
      align: "justify",
      lineGap: 2,
    });
    doc.moveDown(0.6);
  }

  function bullet(texto) {
    addPageIfNeeded(705);
    doc
      .fillColor(corTexto)
      .font("Helvetica")
      .fontSize(10)
      .text(`• ${texto}`, { width: larguraUtil, indent: 15, lineGap: 2 });
  }

  titulo("Apresentação");

  paragrafo(
    `Atendendo à solicitação de ${dados.nomeClinica || "sua empresa"}, temos a satisfação de apresentar a presente proposta comercial para prestação de serviços especializados em tecnologia, presença digital, automação, marketing e soluções digitais.`,
  );

  paragrafo(
    "A QMAX Tech atua no desenvolvimento de soluções personalizadas para empresas que desejam fortalecer sua marca, melhorar sua presença online, estruturar canais digitais e criar processos mais eficientes por meio da tecnologia.",
  );

  paragrafo(
    "Nosso objetivo é entregar uma solução clara, funcional e alinhada à realidade do cliente, buscando unir estratégia, design, performance e tecnologia em uma proposta objetiva e comercialmente aplicável.",
  );

  titulo("Sumário Executivo");

  paragrafo(
    "A presente proposta contempla a estruturação de um plano Tech, composto por implantação inicial e mensalidade recorrente, conforme o pacote selecionado. Os itens inclusos fazem parte do plano contratado e não serão cobrados separadamente.",
  );

  titulo("Plano Contratado");
  doc
    .font("Helvetica")
    .fillColor(corTexto)
    .fontSize(11)
    .text(
      "Solução digital contratada para implementação da estratégia tecnológica da empresa.",
      50,
      doc.y,
      {
        width: larguraUtil,
        align: "center",
      },
    );

  doc.moveDown(1);
  const yPlano = doc.y;

  doc.roundedRect(50, yPlano, larguraUtil, 45, 8).fill("#eef2ff");

  doc
    .fillColor(corPrimaria)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(plano?.servico || "Plano Tech", 65, yPlano + 12);

  doc.y = yPlano + 55;

  doc.moveDown(0.5);

  paragrafo(
    "O plano contratado contempla as soluções descritas abaixo, de acordo com a categoria selecionada no momento da elaboração da proposta.",
  );

  titulo("Soluções Inclusas");

  inclusos.forEach((item) => bullet(item));

  doc.moveDown(0.8);

  paragrafo(
    "Os serviços acima fazem parte do escopo contratado e compõem a entrega prevista dentro do plano escolhido.",
  );

  titulo("Escopo dos Trabalhos");

  bullet("Levantamento inicial das necessidades e objetivos do cliente.");
  bullet("Organização das informações necessárias para execução do projeto.");
  bullet(
    "Criação, configuração ou estruturação das soluções digitais inclusas no plano.",
  );
  bullet("Ajustes técnicos e visuais necessários para entrega do projeto.");
  bullet("Orientações básicas de uso e acompanhamento inicial da solução.");
  bullet("Suporte conforme mensalidade contratada.");

  titulo("Entrega, Documentos e Prazos");

  paragrafo(
    "A execução dos trabalhos terá início após o aceite da proposta e o recebimento das informações necessárias para desenvolvimento do projeto.",
  );

  bullet(
    "Primeira etapa: levantamento de informações e alinhamento do escopo.",
  );
  bullet(
    "Segunda etapa: desenvolvimento/configuração das soluções contratadas.",
  );
  bullet("Terceira etapa: revisão, ajustes e validação final com o cliente.");
  bullet("Quarta etapa: início da mensalidade de acompanhamento e suporte.");

  paragrafo(
    "Os prazos poderão variar conforme a complexidade do projeto, disponibilidade de informações, aprovações do cliente e eventuais demandas adicionais solicitadas durante a execução.",
  );

  titulo("Responsabilidades do Cliente");

  bullet(
    "Fornecer informações, imagens, textos, acessos e materiais necessários.",
  );
  bullet(
    "Validar conteúdos, layouts, páginas e demais entregas dentro dos prazos combinados.",
  );
  bullet(
    "Contratar, quando aplicável, domínio, hospedagem, ferramentas, plugins ou contas externas.",
  );
  bullet(
    "Garantir que os materiais enviados estejam autorizados para uso e em conformidade com a legislação aplicável.",
  );
  bullet("Solicitar alterações dentro do escopo contratado.");

  titulo("Investimentos");

  addPageIfNeeded(620);

  const totalMensal = Number(mensalidade?.valor || 0);
  const totalPontual = Number(plano?.valor || 0);

  let yInvest = doc.y;

  doc.rect(50, yInvest, larguraUtil, 28).fill(corPrimaria);

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("SERVIÇO", 65, yInvest + 9, { width: 220 });
  doc.text("TIPO", 320, yInvest + 9, { width: 80 });
  doc.text("VALOR", 430, yInvest + 9, { width: 90, align: "right" });

  yInvest += 28;

  function linhaInvestimento(nome, tipo, valor, bg) {
    doc.rect(50, yInvest, larguraUtil, 34).fill(bg);

    doc.fillColor(corTexto).font("Helvetica").fontSize(9);
    doc.text(nome, 65, yInvest + 11, { width: 220 });

    doc.text(tipo, 320, yInvest + 11, { width: 80 });

    doc.font("Helvetica-Bold").fillColor(corDestaque);
    doc.text(formatarMoeda(valor), 430, yInvest + 11, {
      width: 90,
      align: "right",
    });

    yInvest += 34;
  }

  linhaInvestimento(
    plano?.servico || "Implantação Tech",
    "Pontual",
    totalPontual,
    "#f8fafc",
  );

  linhaInvestimento(
    mensalidade?.servico || "Mensalidade Tech",
    "Mensal",
    totalMensal,
    "#ffffff",
  );

  yInvest += 18;

  doc.rect(50, yInvest, larguraUtil, 70).fill("#f8fafc");

  doc.fillColor(corDestaque).font("Helvetica-Bold").fontSize(10);
  doc.text("INVESTIMENTO PONTUAL", 70, yInvest + 14);
  doc.fillColor(corPrimaria).fontSize(15);
  doc.text(formatarMoeda(totalPontual), 70, yInvest + 38);

  doc.fillColor(corDestaque).font("Helvetica-Bold").fontSize(10);
  doc.text("INVESTIMENTO MENSAL", 320, yInvest + 14);
  doc.fillColor(corPrimaria).fontSize(15);
  doc.text(formatarMoeda(totalMensal), 320, yInvest + 38);

  doc.y = yInvest + 88;
  titulo("Observações Comerciais");

  bullet("Os itens inclusos no plano não serão cobrados separadamente.");
  bullet(
    "Demandas adicionais não previstas nesta proposta poderão ser orçadas à parte.",
  );
  bullet(
    "Custos com domínio, hospedagem, ferramentas externas, mídia paga, plugins ou licenças são de responsabilidade do cliente, quando aplicável.",
  );
  bullet(
    "A mensalidade contempla acompanhamento e suporte conforme o plano contratado.",
  );

  titulo("Vigência e Condições");

  paragrafo(
    "Esta proposta tem validade de 10 dias. Após esse prazo, valores e condições poderão ser revisados pela QMAX Tech.",
  );

  paragrafo(
    "O início dos trabalhos ocorrerá após o aceite eletrônico da proposta e confirmação das informações necessárias para execução do projeto.",
  );

  titulo("Aceite");

  paragrafo(
    "Agradecemos a oportunidade de apresentar esta proposta e permanecemos à disposição para quaisquer esclarecimentos.",
  );

  doc.moveDown(1.5);

  doc
    .fillColor(corDestaque)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`Atenciosamente,\n${marca.assinatura}`, {
      width: larguraUtil,
    });
}

/**
 * 📑 GERADOR DE ESTUDO DE VIABILIDADE TRIBUTÁRIA & FATOR R (PDF EXECUTIVO)
 */
function gerarPDFEstudoTributario(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      bufferPages: true,
    });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const faturamentoMensal = Number(dados.faturamento || dados.faturamento_mensal || 60000);
    const faturamentoAnual = faturamentoMensal * 12;
    const nomeClinica = dados.nome_clinica || dados.nomeClinica || "Clínica Odontológica";
    const nomeSocio = dados.nome_socio || dados.nomeSocio || "Doutor(a)";
    const cadeiras = dados.cadeiras || 2;
    const func = dados.funcionarios || 2;

    // Cálculos Tributários
    const impostoSemFatorRMensal = faturamentoMensal * 0.133; // 13.3%
    const impostoSemFatorRAnual = impostoSemFatorRMensal * 12;

    const impostoComFatorRMensal = faturamentoMensal * 0.06; // 6.0%
    const impostoComFatorRAnual = impostoComFatorRMensal * 12;

    const economiaMensal = impostoSemFatorRMensal - impostoComFatorRMensal;
    const economiaAnual = economiaMensal * 12;
    const economia5Anos = economiaAnual * 5;
    const proLaboreRecomendado = faturamentoMensal * 0.28;

    const fmt = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // --- CABEÇALHO ---
    doc.save().rect(0, 0, 595.28, 80).fill("#0b0f19").restore();
    doc.fillColor("#10b981").font("Helvetica-Bold").fontSize(18).text("FINORA", 45, 22);
    doc.fillColor("#ffffff").font("Helvetica").fontSize(11).text("ESTUDO DE VIABILIDADE TRIBUTÁRIA & FATOR R", 45, 44);
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(8).text("Planejamento Fiscal Estratégico para Clínicas Odontológicas", 45, 58);
    desenharDente(doc, 535, 40, 26, "#10b981");

    doc.y = 100;

    // --- DADOS DA CLÍNICA ---
    doc.save().roundedRect(45, doc.y, 505, 70, 8).fill("#f8fafc").stroke("#e2e8f0").restore();
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(`Diagnóstico Fiscal: ${nomeClinica}`, 58, doc.y + 12);
    doc.fillColor("#64748b").font("Helvetica").fontSize(9.5).text(`Responsável: ${nomeSocio} | Estrutura: ${cadeiras} Cadeira(s) | ${func} Funcionário(s)`, 58, doc.y + 30);
    doc.fillColor("#0369a1").font("Helvetica-Bold").fontSize(10).text(`Faturamento Analisado: ${fmt(faturamentoMensal)} / mês (${fmt(faturamentoAnual)} / ano)`, 58, doc.y + 48);

    doc.y = 190;

    // --- BOX DE DESTAQUE: ECONOMIA PROJETADA ---
    doc.save().roundedRect(45, doc.y, 505, 80, 10).fill("#ecfdf5").stroke("#10b981").restore();
    doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(11).text("ECONOMIA TRIBUTÁRIA ESTIMADA COM A FINORA", 58, doc.y + 14);
    doc.fillColor("#047857").font("Helvetica-Bold").fontSize(26).text(`${fmt(economiaAnual)} / ano`, 58, doc.y + 32);
    doc.fillColor("#065f46").font("Helvetica").fontSize(9).text(`Projeção de ${fmt(economia5Anos)} economizados em 5 anos de operação regularizada.`, 58, doc.y + 64);

    doc.y = 290;

    // --- TABELA COMPARATIVA ---
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Comparativo de Cenários Fiscais", 45, doc.y);
    doc.moveDown(0.6);

    const yTab = doc.y;
    // Header da tabela
    doc.save().rect(45, yTab, 505, 24).fill("#0f172a").restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    doc.text("Parâmetro de Comparação", 55, yTab + 7);
    doc.text("Cenário Padrão (Sem Fator R)", 220, yTab + 7);
    doc.text("Cenário Otimizado FINORA", 380, yTab + 7);

    // Linha 1: Enquadramento
    let currY = yTab + 24;
    doc.save().rect(45, currY, 505, 22).fill("#ffffff").stroke("#e2e8f0").restore();
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);
    doc.text("Enquadramento Simples Nacional", 55, currY + 6);
    doc.fillColor("#dc2626").text("Anexo V (13,30%)", 220, currY + 6);
    doc.fillColor("#15803d").font("Helvetica-Bold").text("Anexo III (6,00%)", 380, currY + 6);

    // Linha 2: Imposto Mensal
    currY += 22;
    doc.save().rect(45, currY, 505, 22).fill("#f8fafc").stroke("#e2e8f0").restore();
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);
    doc.text("Imposto Mensal Estimado", 55, currY + 6);
    doc.fillColor("#dc2626").text(fmt(impostoSemFatorRMensal), 220, currY + 6);
    doc.fillColor("#15803d").font("Helvetica-Bold").text(fmt(impostoComFatorRMensal), 380, currY + 6);

    // Linha 3: Imposto Anual
    currY += 22;
    doc.save().rect(45, currY, 505, 22).fill("#ffffff").stroke("#e2e8f0").restore();
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);
    doc.text("Custo Tributário Anual", 55, currY + 6);
    doc.fillColor("#dc2626").text(fmt(impostoSemFatorRAnual), 220, currY + 6);
    doc.fillColor("#15803d").font("Helvetica-Bold").text(fmt(impostoComFatorRAnual), 380, currY + 6);

    // Linha 4: Economia Gerada
    currY += 22;
    doc.save().rect(45, currY, 505, 24).fill("#dcfce7").stroke("#86efac").restore();
    doc.fillColor("#166534").font("Helvetica-Bold").fontSize(9);
    doc.text("Resultado Líquido Anual", 55, currY + 7);
    doc.text("R$ 0,00 (Sem Economia)", 220, currY + 7);
    doc.text(`Economia de + ${fmt(economiaAnual)}`, 380, currY + 7);

    doc.y = currY + 40;

    // --- ESTRATÉGIA DE PRÓ-LABORE & BLINDAGEM ---
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Diretrizes de Blindagem & Distribuição de Lucros", 45, doc.y);
    doc.moveDown(0.5);

    doc.fillColor("#475569").font("Helvetica").fontSize(9).text(
      `Para validar o enquadramento na alíquota reduzida de 6,0% (Fator R), estruturamos a folha de pagamento e o Pró-labore dos sócios no percentual exato de 28% (${fmt(proLaboreRecomendado)}/mês).\n\n` +
      `• Isenção Total de IRPF: Todo o lucro remanescente é distribuído aos sócios 100% isento de Imposto de Renda Pessoa Física.\n` +
      `• Conformidade com CRO/CRM & Receita Federal: Eliminação de bitributação entre PF e PJ e zero risco trabalhista com parceiros PJ.\n` +
      `• BPO Financeiro: Conciliação diária de recebíveis de cartão e emissão fiscal automatizada.`
    );

    doc.moveDown(1.5);

    // --- ASSINATURA TÉCNICA E RODAPÉ ---
    doc.save().rect(45, 740, 505, 1).fill("#cbd5e1").restore();
    doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text("FINORA GESTÃO CONTÁBIL & TRIBUTÁRIA ESPECIALIZADA", 45, 750);
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7.5).text("Documento técnico de planejamento tributário emitido em conformidade com as normas do CFC e RFB.", 45, 762);

    doc.end();
  });
}

module.exports = { gerarPDFProposta, gerarPDFEstudoTributario, ehOdonto };

