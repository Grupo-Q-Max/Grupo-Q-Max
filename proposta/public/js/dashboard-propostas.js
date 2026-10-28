let TODAS_PROPOSTAS_DASHBOARD = [];
let ULTIMAS_VISUALIZACOES = [];

// Botões da linha passam só o id: texto da proposta dentro de onclick virava código (XSS)
function propostaPorId(id) {
  return TODAS_PROPOSTAS_DASHBOARD.find((p) => Number(p.id) === Number(id));
}

// Mesmo critério de ehUuidD4Sign (services/proposalHelpers.js): ip_assinatura guarda IP do aceite ou UUID do D4Sign
function ehUuidD4SignFront(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor || "").trim());
}

function compartilharWhatsAppPorId(id) {
  const p = propostaPorId(id);
  if (p) compartilharWhatsApp(p.numero_proposta, p.nome_clinica || "", p.nome_socio || "", p.token_acesso, p.tipo_proposta || "");
}
let FILTRO_VISUALIZACAO_DASHBOARD = "";
let FILTRO_OBSERVACAO_DASHBOARD = "";
let FILTRO_DESCONTO_DASHBOARD = "";
let FILTRO_TERMOMETRO_DASHBOARD = "";

function atualizarVisibilidadeCardsEmpresa() {
  const empresa = document.getElementById("filtroEmpresa")?.value || "FINORA";

  document.getElementById("cardFinora").style.display =
    empresa === "FINORA" ? "block" : "none";

  document.getElementById("cardQmax").style.display =
    empresa === "CONTABIL" ? "block" : "none";

  document.getElementById("cardTech").style.display =
    empresa === "TECH" ? "block" : "none";

  const cardAuditoria = document.getElementById("cardAuditoria");
  if (cardAuditoria) {
    cardAuditoria.style.display =
      empresa === "AUDITORIA" ? "block" : "none";
  }
}

function selecionarEmpresaDashboard(empresa) {
  const inputEmpresa = document.getElementById("filtroEmpresa");

  if (inputEmpresa) {
    inputEmpresa.value = empresa;
  }

  if (typeof aplicarTemaEmpresa === "function") {
    aplicarTemaEmpresa(empresa);
  }

  aplicarFiltrosDashboard();
}

function destacarFiltroSelecionado(botaoSelecionado) {
  document
    .querySelectorAll("#filtrosRapidosDashboard button")
    .forEach((btn) => btn.classList.remove("filtro-ativo"));

  if (botaoSelecionado) {
    botaoSelecionado.classList.add("filtro-ativo");
  }
}

function filtroRapidoDashboard(status, botao) {
  const filtroStatus = document.getElementById("filtroStatus");

  if (filtroStatus) {
    filtroStatus.value = status;
  }

  FILTRO_VISUALIZACAO_DASHBOARD = "";
  FILTRO_OBSERVACAO_DASHBOARD = "";
  FILTRO_DESCONTO_DASHBOARD = "";
  FILTRO_TERMOMETRO_DASHBOARD = "";

  destacarFiltroSelecionado(botao);
  aplicarFiltrosDashboard();
}

function filtroVisualizacaoDashboard(tipo, botao) {
  const filtroStatus = document.getElementById("filtroStatus");

  if (filtroStatus) {
    filtroStatus.value = "";
  }

  FILTRO_VISUALIZACAO_DASHBOARD = tipo;
  FILTRO_OBSERVACAO_DASHBOARD = "";
  FILTRO_DESCONTO_DASHBOARD = "";
  FILTRO_TERMOMETRO_DASHBOARD = "";

  destacarFiltroSelecionado(botao);
  aplicarFiltrosDashboard();
}

function filtroObservacaoDashboard(tipo, botao) {
  const filtroStatus = document.getElementById("filtroStatus");

  if (filtroStatus) {
    filtroStatus.value = "";
  }

  FILTRO_VISUALIZACAO_DASHBOARD = "";
  FILTRO_OBSERVACAO_DASHBOARD = tipo;
  FILTRO_DESCONTO_DASHBOARD = "";
  FILTRO_TERMOMETRO_DASHBOARD = "";

  destacarFiltroSelecionado(botao);
  aplicarFiltrosDashboard();
}

function filtroTermometroDashboard(tipo, botao) {
  const filtroStatus = document.getElementById("filtroStatus");

  if (filtroStatus) {
    filtroStatus.value = "";
  }

  FILTRO_VISUALIZACAO_DASHBOARD = "";
  FILTRO_OBSERVACAO_DASHBOARD = "";
  FILTRO_DESCONTO_DASHBOARD = "";
  FILTRO_TERMOMETRO_DASHBOARD = tipo;

  destacarFiltroSelecionado(botao);
  aplicarFiltrosDashboard();
}

function formatarTempoRelativo(dataStr) {
  if (!dataStr) return "Nunca acessada";
  const data = new Date(dataStr);
  const diffMs = Date.now() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffMin < 1) return "Agora mesmo";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHoras < 24) return `Há ${diffHoras}h`;
  if (diffDias === 1) return "Ontem";
  if (diffDias < 7) return `Há ${diffDias} dias`;
  return data.toLocaleDateString("pt-BR");
}

function detectarDispositivo(userAgent) {
  if (!userAgent) return { tipo: "desconhecido", icone: "", label: "" };
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone")) return { tipo: "iphone", icone: "", label: "iPhone" };
  if (ua.includes("ipad")) return { tipo: "ipad", icone: "", label: "iPad" };
  if (ua.includes("android")) return { tipo: "android", icone: "", label: "Android" };
  if (ua.includes("macintosh") || ua.includes("mac os")) return { tipo: "mac", icone: "", label: "Mac" };
  if (ua.includes("windows")) return { tipo: "windows", icone: "", label: "PC" };
  if (ua.includes("linux")) return { tipo: "linux", icone: "", label: "Linux" };
  return { tipo: "outro", icone: "", label: "Web" };
}

function filtroDescontoDashboard(tipo, botao) {
  const filtroStatus = document.getElementById("filtroStatus");

  if (filtroStatus) {
    filtroStatus.value = "";
  }

  FILTRO_VISUALIZACAO_DASHBOARD = "";
  FILTRO_OBSERVACAO_DASHBOARD = "";
  FILTRO_DESCONTO_DASHBOARD = tipo;

  destacarFiltroSelecionado(botao);
  aplicarFiltrosDashboard();
}
function aplicarFiltrosDashboard() {
  const empresa = document.getElementById("filtroEmpresa")?.value || "FINORA";
  if (window.aplicarTemaEmpresa) window.aplicarTemaEmpresa(empresa || "FINORA");
  const status = document.getElementById("filtroStatus")?.value || "";
  const busca = (
    document.getElementById("filtroBusca")?.value || ""
  ).toLowerCase();

  let propostasFiltradas = TODAS_PROPOSTAS_DASHBOARD.filter((p) => {
    const empresaProposta = String(
      p.tipo_proposta || p.tipoProposta || p.empresa || "",
    ).toUpperCase();

    const statusProposta = String(p.status || "");
    const textoBusca = `
      ${p.nome_clinica || ""}
      ${p.email || ""}
      ${p.numero_proposta || ""}
    `.toLowerCase();

    const passaEmpresa = !empresa || empresaProposta === empresa;
    const passaStatus = !status || statusProposta === status;
    const passaBusca = !busca || textoBusca.includes(busca);
    const totalVisualizacoes = Number(p.total_visualizacoes || 0);

    const passaVisualizacao =
      !FILTRO_VISUALIZACAO_DASHBOARD ||
      (FILTRO_VISUALIZACAO_DASHBOARD === "visualizadas" &&
        totalVisualizacoes > 0) ||
      (FILTRO_VISUALIZACAO_DASHBOARD === "nao_visualizadas" &&
        totalVisualizacoes === 0);
    const possuiObservacao =
      p.ultima_observacao && String(p.ultima_observacao).trim() !== "";

    const passaObservacao =
      !FILTRO_OBSERVACAO_DASHBOARD ||
      (FILTRO_OBSERVACAO_DASHBOARD === "com_observacao" && possuiObservacao);

    let itensProposta = [];

    try {
      itensProposta = lerJson(p.itens_json);
    } catch {
      itensProposta = [];
    }

    const possuiDesconto = itensProposta.some(
      (item) => Number(item.descontoPercentual || 0) > 0,
    );

    const passaDesconto =
      !FILTRO_DESCONTO_DASHBOARD ||
      (FILTRO_DESCONTO_DASHBOARD === "com_desconto" && possuiDesconto);

    const termometro = typeof calcularTermometroFechamento === "function" ? calcularTermometroFechamento(p) : { label: "" };
    const passaTermometro =
      !FILTRO_TERMOMETRO_DASHBOARD ||
      termometro.label.toLowerCase().includes(FILTRO_TERMOMETRO_DASHBOARD.toLowerCase());

    return (
      passaEmpresa &&
      passaStatus &&
      passaBusca &&
      passaVisualizacao &&
      passaObservacao &&
      passaDesconto &&
      passaTermometro
    );
  });

  let propostasSemFiltroEmpresa = TODAS_PROPOSTAS_DASHBOARD.filter((p) => {
    const statusProposta = String(p.status || "");
    const textoBusca = `
      ${p.nome_clinica || ""}
      ${p.email || ""}
      ${p.numero_proposta || ""}
    `.toLowerCase();

    const passaStatus = !status || statusProposta === status;
    const passaBusca = !busca || textoBusca.includes(busca);
    const totalVisualizacoes = Number(p.total_visualizacoes || 0);

    const passaVisualizacao =
      !FILTRO_VISUALIZACAO_DASHBOARD ||
      (FILTRO_VISUALIZACAO_DASHBOARD === "visualizadas" &&
        totalVisualizacoes > 0) ||
      (FILTRO_VISUALIZACAO_DASHBOARD === "nao_visualizadas" &&
        totalVisualizacoes === 0);
    const possuiObservacao =
      p.ultima_observacao && String(p.ultima_observacao).trim() !== "";

    const passaObservacao =
      !FILTRO_OBSERVACAO_DASHBOARD ||
      (FILTRO_OBSERVACAO_DASHBOARD === "com_observacao" && possuiObservacao);

    let itensProposta = [];

    try {
      itensProposta = lerJson(p.itens_json);
    } catch {
      itensProposta = [];
    }

    const possuiDesconto = itensProposta.some(
      (item) => Number(item.descontoPercentual || 0) > 0,
    );

    const passaDesconto =
      !FILTRO_DESCONTO_DASHBOARD ||
      (FILTRO_DESCONTO_DASHBOARD === "com_desconto" && possuiDesconto);

    const termometro = typeof calcularTermometroFechamento === "function" ? calcularTermometroFechamento(p) : { label: "" };
    const passaTermometro =
      !FILTRO_TERMOMETRO_DASHBOARD ||
      termometro.label.toLowerCase().includes(FILTRO_TERMOMETRO_DASHBOARD.toLowerCase());

    return (
      passaStatus &&
      passaBusca &&
      passaVisualizacao &&
      passaObservacao &&
      passaDesconto &&
      passaTermometro
    );
  });

  atualizarVisibilidadeCardsEmpresa();
  atualizarMetricasDashboard(propostasFiltradas);
  atualizarFunilComercial(propostasFiltradas);
  renderizarTabelaDashboard(propostasFiltradas);
  atualizarMetricasFinanceiras(propostasFiltradas, propostasSemFiltroEmpresa);
  atualizarRankingVendedores(propostasFiltradas);
  if (typeof renderizarGraficoDashboard === "function") {
    renderizarGraficoDashboard(propostasFiltradas);
  }
}

function renderizarTabelaDashboard(propostas) {
  const propostasParaExibir = propostas;
  const tbodyFinora = document.querySelector("#tabelaFinora tbody");
  const tbodyQmax = document.querySelector("#tabelaQmax tbody");
  const tbodyTech = document.querySelector("#tabelaTech tbody");
  const tbodyAuditoria = document.querySelector("#tabelaAuditoria tbody");

  if (!tbodyFinora || !tbodyQmax || !tbodyTech || !tbodyAuditoria) {
    console.error("Uma ou mais tabelas não foram encontradas.");
    return;
  }

  let htmlFinora = "";
  let htmlQmax = "";
  let htmlTech = "";
  let htmlAuditoria = "";

  propostasParaExibir.forEach((p) => {
    let itens = [];

    try {
      itens = lerJson(p.itens_json);
    } catch {
      itens = [];
    }

    const itensMensais = itens.filter((item) => tipoItem(item) === "Mensal");
    const itensPontuais = itens.filter((item) => tipoItem(item) === "Pontual");

    const totalMensal = itensMensais.reduce(
      (acc, item) => acc + Number(item.valor || 0),
      0,
    );
    const totalPontual = itensPontuais.reduce(
      (acc, item) => acc + Number(item.valor || 0),
      0,
    );

    const temDesconto = itens.some(
      (item) => Number(item.descontoPercentual || 0) > 0,
    );

    const empresaProposta = String(
      p.tipo_proposta || p.tipoProposta || p.empresa || "FINORA",
    ).toUpperCase();

    const ehTech = empresaProposta === "TECH";
    const ehContabil = empresaProposta === "CONTABIL" || empresaProposta === "QMAX";
    const ehAuditoria = empresaProposta === "AUDITORIA";

    let paramsHtml = `
      <div><span>Razão Social</span><strong>${escapeHTML(p.razao_social || "-")}</strong></div>
      <div><span>CNPJ</span><strong>${escapeHTML(p.cnpj || "-")}</strong></div>
      <div><span>Responsável</span><strong>${escapeHTML(p.nome_socio || "-")}</strong></div>
      <div><span>CPF Sócio</span><strong>${escapeHTML(p.cpf_socio || "-")}</strong></div>
      <div><span>Telefone</span><strong>${escapeHTML(p.telefone || "-")}</strong></div>
      <div><span>E-mail</span><strong>${escapeHTML(p.email || "-")}</strong></div>
    `;

    if (!ehTech && !ehAuditoria) {
      paramsHtml += `<div><span>Endereço</span><strong>${escapeHTML(p.endereco_clinica || "-")}</strong></div>`;
      if (!ehContabil) {
        paramsHtml += `<div><span>Cadeiras</span><strong>${p.cadeiras || 0}</strong></div>`;
      }
      paramsHtml += `<div><span>Faturamento</span><strong>${p.faturamento ? formatador.format(p.faturamento) : "R$ 0,00"}</strong></div>`;
      paramsHtml += `<div><span>Regime Fiscal</span><strong>${escapeHTML(p.regime_fiscal || "-")}</strong></div>`;
      if (!ehContabil) {
        paramsHtml += `<div><span>Regime Híbrido</span><strong>${escapeHTML(p.regime_hibrido || "-")}</strong></div>`;
      }
      paramsHtml += `<div><span>Funcionários</span><strong>${p.funcionarios || 0}</strong></div>`;
      paramsHtml += `<div><span>Sócios</span><strong>${p.socios || 0}</strong></div>`;
      if (!ehContabil) {
        paramsHtml += `<div><span>Metragem</span><strong>${p.metragem || 0} m²</strong></div>`;
        paramsHtml += `<div><span>Distância</span><strong>${p.distancia_km || 0} KM</strong></div>`;
      }
    }

    const linhaHtml = `
      <tr>
        <td>
          <strong>${p.numero_proposta}</strong><br>
          <small>${formatarData(p.data_proposta)}</small><br>
          <a class="btn-ver-olhinho" target="_blank" href="${APP_BASE_PATH}/visualizar.html?token=${p.token_acesso}" title="Visualizar Proposta">
            Ver
          </a>
        </td>

        <td>
          <strong>${escapeHTML(p.nome_clinica)}</strong><br>
          <small>${escapeHTML(p.email || "-")}</small><br>
          <small>Criado por: ${escapeHTML(p.criador || "-")}</small>
          ${temDesconto ? `<br><small style="color:#ef4444;font-weight:700;">Com desconto</small>` : ""}
          <div id="ultimaObs-${p.id}" class="ultima-observacao">
            ${
              p.ultima_observacao
                ? `<strong>Última obs.:</strong> ${escapeHTML(p.ultima_observacao)}<br>
                   <small>${formatarData(p.ultima_observacao_data)}</small>`
                : "Sem observações ainda."
            }
          </div>
        </td>

        <td><strong>${formatador.format(totalMensal)}</strong></td>
        <td><strong>${formatador.format(totalPontual)}</strong></td>

        <td>
          <span class="status-badge status-${String(p.status || "").replace(/\s/g, "-")}">
            ${escapeHTML(p.status)}
          </span>
        </td>

        <td onclick="abrirModalVisualizacoes(${p.id})" style="cursor: pointer;" title="Clique para ver o histórico detalhado de acessos">
          ${(() => {
            const horasDesdeCriacao = (Date.now() - new Date(p.criado_em || p.data_proposta || Date.now()).getTime()) / (3600 * 1000);
            const precisaFollowUp = p.status === "Pendente" && horasDesdeCriacao >= 48;
            const linkWaFollowUp = `https://wa.me/55${(p.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Olá, tudo bem? Passando para saber se conseguiu analisar a proposta que enviamos para a ' + (p.nome_clinica || 'clínica') + '!')}`;

            if (Number(p.total_visualizacoes || 0) > 0) {
              const dev = detectarDispositivo(p.ultimo_user_agent);
              const labelDev = dev.label ? ` • ${dev.icone} ${dev.label}` : "";
              const termometro = calcularTermometroFechamento(p);
              return `<div style="display:inline-flex; align-items:center; gap:4px; background:#dcfce7; color:#15803d; border:1px solid #86efac; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:800;">
                   Aberta (${p.total_visualizacoes}x)${labelDev}
                 </div>
                 <div style="margin-top:4px;">
                   <span style="background:${termometro.bg}; color:${termometro.cor}; border:1px solid ${termometro.border}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; display:inline-block;">
                     ${termometro.label}
                   </span>
                 </div>
                 <small style="color:#64748b; font-size:10px; margin-top:3px; display:inline-block;">
                   Última: ${formatarTempoRelativo(p.ultima_visualizacao)}
                 </small>
                 ${precisaFollowUp ? `
                   <div style="margin-top:4px;">
                     <a href="${linkWaFollowUp}" target="_blank" onclick="event.stopPropagation()" style="background:#fff1f2; color:#be123c; border:1px solid #fecdd3; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                       Parada (+48h) • Follow-up
                     </a>
                   </div>` : ''}
              `;
            }
            const termometro = calcularTermometroFechamento(p);
            return `<div style="display:inline-flex; align-items:center; gap:4px; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding:3px 8px; border-radius:8px; font-size:11px; font-weight:700;">
                   Aguardando leitura
                 </div>
                 <div style="margin-top:4px;">
                   <span style="background:${termometro.bg}; color:${termometro.cor}; border:1px solid ${termometro.border}; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; display:inline-block;">
                     ${termometro.label}
                   </span>
                 </div>
                 ${precisaFollowUp ? `
                   <div style="margin-top:4px;">
                     <a href="${linkWaFollowUp}" target="_blank" onclick="event.stopPropagation()" style="background:#fff1f2; color:#be123c; border:1px solid #fecdd3; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
                       Sem retorno (+48h) • Chamar
                     </a>
                   </div>` : ''}
            `;
          })()}
        </td>

        <td>
          <div class="acoes-proposta">
            <button class="btn-action-icon btn-action-detail" onclick="toggleDetalhes(${p.id}, this)" title="Ver Detalhes">
              ▼
            </button>

            <button class="btn-action-icon" onclick="abrirModalDescontoItens(propostaPorId(${Number(p.id)}))" title="Aplicar Desconto">
              ％
            </button>

            <button class="btn-action-icon" onclick="abrirModalObservacoes(${p.id})" title="Observações">
              ✎
            </button>

            <button class="btn-action-icon" onclick="abrirLinhaDoTempo(${p.id})" title="Linha do Tempo / Histórico">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            </button>

            <button class="btn-action-icon" onclick="abrirRaioXProposta('${p.numero_proposta}', ${p.total_visualizacoes || 1}, ${p.tempo_total_segundos || 75})" title="Raio-X de Engajamento & Atenção" style="background:#f0fdf4; border-color:#86efac;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>

            <button class="btn-action-icon btn-action-whatsapp" onclick="compartilharWhatsAppPorId(${Number(p.id)})" title="Enviar por WhatsApp">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="vertical-align: middle;">
                <path d="M13.601 2.326A7.882 7.882 0 0 0 8 0C3.58 0 .005 3.525 0 7.92c-.004 1.4.368 2.765 1.07 3.97L0 16l4.22-1.088A7.87 7.87 0 0 0 8 16c4.417 0 7.994-3.525 8-7.92a7.882 7.882 0 0 0-2.399-5.754H13.6zM8 14.707a6.68 6.68 0 0 1-3.39-.922l-.24-.143-2.52.65.666-2.433-.156-.251a6.69 6.69 0 0 1-1.007-3.505C1.353 3.513 5.487 1.352 8.01 1.352c3.55 0 6.44 2.89 6.446 6.44a6.45 6.45 0 0 1-1.913 4.562 6.4 6.4 0 0 1-4.561 1.91zM11.536 9.47c-.194-.097-1.146-.566-1.324-.631-.178-.065-.307-.097-.437.097-.13.194-.501.631-.614.76-.113.13-.226.146-.42.049-.194-.097-.82-.303-1.562-.962-.577-.515-.967-1.15-1.08-1.346-.113-.194-.012-.299.085-.396.088-.088.194-.226.29-.339.097-.113.13-.194.194-.323.065-.13.032-.243-.016-.34-.049-.097-.437-1.053-.6-1.44-.158-.38-.34-.33-.467-.33H4.9c-.13 0-.34.049-.518.243-.178.194-.68.663-.68 1.617 0 .955.696 1.876.793 2.006.097.13 1.37 2.1 3.32 2.946.464.2.827.321 1.11.41.467.15 0 .257-.156.243-.346-.013-1.146-.47-1.324-1.262-.178-.793-.178-1.472-.13-1.617.049-.146.178-.226.372-.323z"/>
              </svg>
            </button>

            <button class="btn-action-icon" onclick="reenviarProposta(${p.id})" title="Reenviar por E-mail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7l9 6 9-6"/></svg>
            </button>
            ${p.status === "Pendente" && propostaVencidaFront(p) ? `
            <button class="btn-action-icon" onclick="renovarValidadeProposta(${Number(p.id)})" title="Validade vencida: renovar por mais 10 dias" aria-label="Renovar validade da proposta" style="background:#fffbeb; border-color:#fcd34d;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
            </button>` : ""}
          </div>
        </td>
      </tr>

      <tr id="detalhes-${p.id}" class="hidden">
        <td colspan="7">
          <div class="proposta-grid">
            <div class="proposta-box">
              <h4>Investimento total mensal</h4>
              ${renderItens(itensMensais)}
            </div>

            <div class="proposta-box">
              <h4>Investimento total pontual</h4>
              ${renderItens(itensPontuais)}
            </div>

            <div class="proposta-box">
              <h4>Parâmetros da Proposta</h4>
              <div class="infos-proposta-grid">
                ${paramsHtml}
              </div>
            </div>

            <div class="proposta-box">
              <h4>Assinatura Eletrônica & D4Sign</h4>
              <div style="font-size:12px; line-height:1.6; color:#334155;">
                <div style="margin-bottom:6px;">
                  <strong style="color:#64748b; font-size:11px; text-transform:uppercase;">Status da Assinatura:</strong><br>
                  ${
                    p.status === "Aprovada"
                      ? `<span style="background:#dcfce7; color:#15803d; font-weight:800; padding:2px 8px; border-radius:6px; font-size:11px; display:inline-block; margin-top:2px;">
                           Documento Assinado & Aprovado
                         </span>`
                      : `<span style="background:#fef3c7; color:#b45309; font-weight:800; padding:2px 8px; border-radius:6px; font-size:11px; display:inline-block; margin-top:2px;">
                           Aguardando Assinatura do Cliente
                         </span>`
                  }
                </div>

                <div style="margin-bottom:6px;">
                  <strong style="color:#64748b; font-size:11px; text-transform:uppercase;">Protocolo / UUID D4Sign:</strong><br>
                  <code style="font-size:11px; background:#f1f5f9; padding:2px 6px; border-radius:4px; color:#0f172a; word-break:break-all;">
                    ${p.ip_assinatura || "Integrado com D4Sign"}
                  </code>
                </div>

                ${
                  p.data_decisao
                    ? `<div style="margin-bottom:8px;">
                         <strong style="color:#64748b; font-size:11px; text-transform:uppercase;">Data de Autenticação:</strong><br>
                         <span style="font-size:12px; color:#0f172a;">${formatarData(p.data_decisao)}</span>
                       </div>`
                    : ""
                }

                <div style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
                  <button class="btn-mini" style="background:#0f172a; color:#fff; padding:4px 10px; font-weight:800; border-radius:6px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="abrirModalAuditoriaD4Sign(${p.id})">
                    Auditoria D4Sign Completa
                  </button>
                  <button class="btn-mini" style="background:#0284c7; color:#fff; padding:4px 10px; font-weight:800; border-radius:6px; border:none; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="abrirModalDocumentosDashboard(${p.id})">
                    Documentos Anexados
                  </button>
                  <a href="/api/propostas/${p.token_acesso}/contrato" target="_blank" class="btn-mini btn-mini-light" style="text-decoration:none; padding:4px 10px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                    Minuta Contrato
                  </a>
                  <a href="/proposta/visualizar.html?token=${p.token_acesso}" target="_blank" class="btn-mini btn-mini-light" style="text-decoration:none; padding:4px 10px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                    Ver Ambiente do Cliente
                  </a>
                  <a href="/api/propostas/${p.token_acesso}/pdf" target="_blank" class="btn-mini btn-mini-light" style="text-decoration:none; padding:4px 10px; font-weight:700; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                    PDF Oficial
                  </a>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;

    if (empresaProposta === "TECH") {
      htmlTech += linhaHtml;
    } else if (empresaProposta === "CONTABIL" || empresaProposta === "QMAX") {
      htmlQmax += linhaHtml;
    } else if (empresaProposta === "AUDITORIA") {
      htmlAuditoria += linhaHtml;
    } else {
      htmlFinora += linhaHtml;
    }
  });

  tbodyFinora.innerHTML =
    htmlFinora ||
    '<tr><td colspan="7" style="text-align:center;">Nenhuma proposta FINORA encontrada.</td></tr>';
  tbodyQmax.innerHTML =
    htmlQmax ||
    '<tr><td colspan="7" style="text-align:center;">Nenhuma proposta QMAX encontrada.</td></tr>';
  tbodyTech.innerHTML =
    htmlTech ||
    '<tr><td colspan="7" style="text-align:center;">Nenhuma proposta TECH encontrada.</td></tr>';
  tbodyAuditoria.innerHTML =
    htmlAuditoria ||
    '<tr><td colspan="7" style="text-align:center;">Nenhuma proposta AUDITORIA encontrada.</td></tr>';
}

// Mesma regra de propostaVencida (services/proposalHelpers.js): 10 dias a partir da renovação ou da criação
function propostaVencidaFront(p) {
  const base = p.validade_inicia_em || p.criado_em;
  return Boolean(base) && Date.now() > new Date(base).getTime() + 10 * 24 * 60 * 60 * 1000;
}

async function renovarValidadeProposta(id) {
  if (!confirm("Renovar a validade desta proposta por mais 10 dias? O cliente poderá aprovar de novo pelo mesmo link.")) return;
  try {
    const res = await fetch(`/api/propostas/${id}/renovar-validade`, { method: "POST", headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    alert(res.ok ? data.message : data.error || "Erro ao renovar a validade.");
    if (res.ok) carregarPropostas();
  } catch (error) {
    alert("Erro de conexão ao renovar a validade.");
  }
}

async function reenviarProposta(id) {
  if (!confirm("Deseja reenviar esta proposta por email para o cliente?")) {
    return;
  }

  try {
    const token = localStorage.getItem("finora_token");

    const res = await fetch(`/api/propostas/${id}/reenviar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao reenviar proposta.");
      return;
    }

    alert(data.message || "Proposta reenviada por email com sucesso!");
  } catch (error) {
    console.error(error);
    alert("Erro de conexão ao reenviar proposta.");
  }
}

async function carregarPropostas() {
  const res = await fetch("/api/propostas", { headers: authHeaders });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "/proposta/login.html";
    }
    return;
  }
  const propostas = await res.json();

  if (Array.isArray(propostas)) {
    TODAS_PROPOSTAS_DASHBOARD = propostas;
    aplicarFiltrosDashboard();
  }
}

function toggleDetalhes(id, botao) {
  const detalhes = document.getElementById(`detalhes-${id}`);
  detalhes.classList.toggle("hidden");

  botao.innerHTML = detalhes.classList.contains("hidden")
    ? "▼"
    : "▲";
}

async function abrirModalObservacoes(propostaId) {
  document.getElementById("obsPropostaId").value = propostaId;
  document.getElementById("novaObservacao").value = "";

  abrirModal("modalObservacoes");
  await carregarObservacoes(propostaId);
}

async function carregarObservacoes(propostaId) {
  const res = await fetch(`/api/propostas/${propostaId}/observacoes`, {
    headers: authHeaders,
  });

  const observacoes = await res.json();
  const lista = document.getElementById("listaObservacoes");

  if (!observacoes.length) {
    lista.innerHTML = `
      <div style="color:#64748b; font-size:13px;">
        Nenhuma observação registrada ainda.
      </div>
    `;
    return;
  }

  lista.innerHTML = observacoes
    .map((obs) => {
      const data = new Date(obs.criado_em).toLocaleString("pt-BR");

      return `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:10px;">
          <div style="font-size:12px; color:#64748b; margin-bottom:6px;">
            <strong>${escapeHTML(obs.usuario || "Usuário")}</strong> • ${data}
          </div>
          <div style="font-size:14px; color:#1e293b;">
            ${escapeHTML(obs.observacao)}
          </div>
        </div>
      `;
    })
    .join("");
}

async function salvarObservacao() {
  const propostaId = document.getElementById("obsPropostaId").value;
  const observacao = document.getElementById("novaObservacao").value || "";

  if (observacao.trim().length < 5) {
    alert("Digite uma observação com pelo menos 5 caracteres.");
    return;
  }

  const res = await fetch(`/api/propostas/${propostaId}/observacoes`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ observacao: observacao.trim() }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar observação.");
    return;
  }

  document.getElementById("novaObservacao").value = "";
  await carregarObservacoes(propostaId);
  await carregarUltimaObservacao(propostaId);
}

async function carregarUltimaObservacao(propostaId) {
  const campo = document.getElementById(`ultimaObs-${propostaId}`);
  if (!campo) return;

  try {
    const res = await fetch(`/api/propostas/${propostaId}/observacoes`, {
      headers: authHeaders,
    });

    if (!res.ok) {
      campo.innerHTML = "Sem observações ainda.";
      return;
    }

    const observacoes = await res.json();

    if (!Array.isArray(observacoes) || observacoes.length === 0) {
      campo.innerHTML = "Sem observações ainda.";
      return;
    }

    const ultima = observacoes[0];
    const data = new Date(ultima.criado_em).toLocaleDateString("pt-BR");

    campo.innerHTML = `
      <strong>Última obs.:</strong> ${escapeHTML(ultima.observacao)}<br>
      <small>${escapeHTML(ultima.usuario || "Usuário")} • ${data}</small>
    `;
  } catch (error) {
    campo.innerHTML = "Sem observações ainda.";
  }
}

async function abrirLinhaDoTempo(id) {
  const container = document.getElementById("timelineContainer");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">Carregando histórico...</div>';
  abrirModal("modalLinhaTempo");

  try {
    const res = await fetch(`/api/propostas/${id}/historico`, { headers: authHeaders });
    if (!res.ok) {
      container.innerHTML = '<div class="viewer-error">Erro ao carregar histórico.</div>';
      return;
    }

    const historico = await res.json();
    if (!Array.isArray(historico) || historico.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">Nenhuma proposta encontrada na linha do tempo.</div>';
      return;
    }

    let html = '<div class="qmax-timeline">';
    historico.forEach((p) => {
      const statusClean = String(p.status || "").replace(/\s/g, "-");
      const dataCriacao = new Date(p.criado_em).toLocaleString("pt-BR");
      const isCurrent = p.id === id;

      let descHtml = "";
      if (Number(p.percentual_desconto || 0) > 0) {
        descHtml = `<div class="timeline-discount">Desconto de ${p.percentual_desconto}% (-${formatador.format(p.valor_desconto)})</div>`;
      }

      html += `
        <div class="timeline-item ${isCurrent ? "current-item" : ""}">
          <div class="timeline-badge badge-${statusClean}"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-title">Proposta #${p.numero_proposta}</span>
              <span class="status-badge status-${statusClean}">${escapeHTML(p.status)}</span>
            </div>
            <div class="timeline-body">
              <div class="timeline-meta">
                <span>${dataCriacao}</span>
                <span>${escapeHTML(p.criador || "Vendedor")}</span>
              </div>
              <div class="timeline-value">Valor Total: <strong>${formatador.format(p.valor_total)}</strong></div>
              ${descHtml}
            </div>
            ${isCurrent ? '<div class="current-label">Visualizando esta versão</div>' : ""}
          </div>
        </div>
      `;
    });
    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    console.error("Erro na requisição da linha do tempo:", error);
    container.innerHTML = '<div class="viewer-error">Erro de conexão ao carregar histórico.</div>';
  }
}

function compartilharWhatsApp(numeroProposta, nomeClinica, nomeSocio, tokenAcesso, tipoProposta) {
  const linkAcesso = `${window.location.origin}${APP_BASE_PATH}/p/${tokenAcesso}`;
  const empresa = String(tipoProposta || "FINORA").toUpperCase();
  
  // Saudação amigável personalizada
  const saudacao = nomeSocio ? `Olá, ${nomeSocio}!` : `Olá!`;
  
  const mensagem = `${saudacao}\n\nAqui está a proposta comercial da *${empresa}* para a clínica *${nomeClinica}* (Proposta nº ${numeroProposta}):\n\n🔗 ${linkAcesso}\n\nQualquer dúvida estou à disposição!`;
  
  const urlEncoded = encodeURIComponent(mensagem);
  window.open(`https://api.whatsapp.com/send?text=${urlEncoded}`, '_blank');
}

function interpretarUserAgent(ua) {
  const uaLower = String(ua || "").toLowerCase();
  let dispositivo = "Computador";
  let icone = "desktop";
  
  if (uaLower.includes("mobi") || uaLower.includes("android") || uaLower.includes("iphone") || uaLower.includes("ipod")) {
    dispositivo = "Celular";
    icone = "mobile";
  } else if (uaLower.includes("ipad") || uaLower.includes("tablet")) {
    dispositivo = "Tablet";
    icone = "tablet";
  }
  
  // Detectar Navegador
  let navegador = "Navegador Desconhecido";
  if (uaLower.includes("chrome") || uaLower.includes("crios")) navegador = "Chrome";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome") && !uaLower.includes("android")) navegador = "Safari";
  else if (uaLower.includes("firefox")) navegador = "Firefox";
  else if (uaLower.includes("edge") || uaLower.includes("edg/")) navegador = "Edge";
  
  // Detectar SO
  let so = "SO Desconhecido";
  if (uaLower.includes("windows")) so = "Windows";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) so = "iOS";
  else if (uaLower.includes("macintosh") || uaLower.includes("mac os")) so = "macOS";
  else if (uaLower.includes("android")) so = "Android";
  else if (uaLower.includes("linux")) so = "Linux";
  
  return { dispositivo, navegador, so, icone };
}

function tempoRelativo(dataStr) {
  const agora = new Date();
  const data = new Date(dataStr);
  const diffMs = agora - data;
  const diffSeg = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSeg / 60);
  const diffHoras = Math.floor(diffMin / 60);
  const diffDias = Math.floor(diffHoras / 24);

  if (diffSeg < 60) return "Agora mesmo";
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHoras < 24) return `Há ${diffHoras}h`;
  if (diffDias === 1) return "Ontem";
  if (diffDias < 7) return `Há ${diffDias} dias`;
  if (diffDias < 30) return `Há ${Math.floor(diffDias / 7)} sem`;
  return new Date(dataStr).toLocaleDateString("pt-BR");
}

function gerarResumoVisualizacoes(visualizacoes) {
  const total = visualizacoes.length;
  const ipsUnicos = new Set(visualizacoes.map(v => v.ip)).size;
  const dispositivosUnicos = new Set(visualizacoes.map(v => {
    const ua = interpretarUserAgent(v.user_agent);
    return `${ua.icone}-${ua.navegador}-${ua.so}`;
  })).size;

  const celulares = visualizacoes.filter(v => interpretarUserAgent(v.user_agent).icone === "mobile").length;
  const desktops = visualizacoes.filter(v => interpretarUserAgent(v.user_agent).icone === "desktop").length;
  const tablets = visualizacoes.filter(v => interpretarUserAgent(v.user_agent).icone === "tablet").length;

  const ultimoAcesso = visualizacoes.length > 0 ? tempoRelativo(visualizacoes[0].visualizado_em) : "—";

  return { total, ipsUnicos, dispositivosUnicos, celulares, desktops, tablets, ultimoAcesso };
}

function exportarVisualizacoesCSV(visualizacoes) {
  const linhas = [["Data/Hora", "Dispositivo", "Navegador", "SO", "IP"]];

  visualizacoes.forEach(v => {
    const ua = interpretarUserAgent(v.user_agent);
    linhas.push([
      new Date(v.visualizado_em).toLocaleString("pt-BR"),
      ua.dispositivo.replace(/[^\w\s]/g, "").trim(),
      ua.navegador,
      ua.so,
      v.ip || "Desconhecido"
    ]);
  });

  const csvContent = linhas.map(l => l.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `historico_visualizacoes_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function abrirModalVisualizacoes(propostaId) {
  fecharModal("modalLinhaTempo");
  fecharModal("modalObservacoes");
  fecharModal("modalDesconto");

  abrirModal("modalVisualizacoes");
  const container = document.getElementById("visualizacoesContainer");
  container.innerHTML = `
    <div style="text-align:center; padding: 40px;">
      <div class="loading-spinner"></div>
      <p style="color: var(--muted); margin-top: 12px; font-size: 13px;">Carregando histórico de acessos...</p>
    </div>
  `;

  try {
    const res = await fetch(`/api/propostas/${propostaId}/visualizacoes`, {
      headers: authHeaders
    });

    if (!res.ok) throw new Error("Erro na requisição");
    const visualizacoes = await res.json();

    if (visualizacoes.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px;">
          
          <p style="color: var(--muted); font-size: 14px; font-weight: 600;">Nenhum acesso registrado</p>
          <p style="color: var(--muted); font-size: 12px; opacity: 0.7;">O cliente ainda não abriu esta proposta.</p>
        </div>
      `;
      return;
    }

    // user_agent vem do navegador do cliente: guardado aqui em vez de serializado no onclick
    ULTIMAS_VISUALIZACOES = visualizacoes;
    const resumo = gerarResumoVisualizacoes(visualizacoes);

    let html = `
      <div class="access-summary">
        <div class="access-summary-item">
          <span class="access-summary-value">${resumo.total}</span>
          <span class="access-summary-label">Acessos</span>
        </div>
        <div class="access-summary-item">
          <span class="access-summary-value">${resumo.ipsUnicos}</span>
          <span class="access-summary-label">IPs Únicos</span>
        </div>
        <div class="access-summary-item">
          <span class="access-summary-value">${resumo.dispositivosUnicos}</span>
          <span class="access-summary-label">Dispositivos</span>
        </div>
        <div class="access-summary-item">
          <span class="access-summary-value">${resumo.ultimoAcesso}</span>
          <span class="access-summary-label">Último Acesso</span>
        </div>
      </div>

      <div class="access-device-bar">
        ${resumo.desktops > 0 ? `<div class="device-bar-segment desktop" style="flex:${resumo.desktops}" title="${resumo.desktops} acesso(s) via Desktop">${resumo.desktops}</div>` : ""}
        ${resumo.celulares > 0 ? `<div class="device-bar-segment mobile" style="flex:${resumo.celulares}" title="${resumo.celulares} acesso(s) via Celular">${resumo.celulares}</div>` : ""}
        ${resumo.tablets > 0 ? `<div class="device-bar-segment tablet" style="flex:${resumo.tablets}" title="${resumo.tablets} acesso(s) via Tablet">${resumo.tablets}</div>` : ""}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <span style="font-size:12px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Detalhamento por acesso</span>
        <button class="btn-export-csv" onclick="exportarVisualizacoesCSV(ULTIMAS_VISUALIZACOES)" title="Exportar para CSV">
          Exportar CSV
        </button>
      </div>

      <div class="visual-access-list">
    `;

    visualizacoes.forEach((v, index) => {
      const parsedUA = interpretarUserAgent(v.user_agent);
      const dataAcesso = new Date(v.visualizado_em).toLocaleString("pt-BR");
      const relativo = tempoRelativo(v.visualizado_em);
      const durSec = Number(v.duracao_segundos || 0);
      let durBadge = "";
      if (durSec > 0) {
        const min = Math.floor(durSec / 60);
        const sec = durSec % 60;
        const txt = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
        const corBg = durSec >= 120 ? '#fef3c7' : '#ecfdf5';
        const corTxt = durSec >= 120 ? '#92400e' : '#065f46';
        durBadge = `<span style="background:${corBg}; color:${corTxt}; padding:2px 6px; border-radius:6px; font-size:11px; font-weight:800; margin-left:6px;">${txt} ${durSec >= 120 ? 'Alto Interesse' : ''}</span>`;
      }

      html += `
        <div class="access-item" style="animation-delay: ${index * 0.05}s;">
          <div class="access-icon-wrapper ${parsedUA.icone}">
            ${parsedUA.dispositivo.split(" ")[0]}
          </div>
          <div class="access-info">
            <div class="access-header">
              <span class="access-device">${parsedUA.dispositivo}${durBadge}</span>
              <span class="access-time" title="${dataAcesso}">${relativo}</span>
            </div>
            <div class="access-details">
              <span><strong>Navegador:</strong> ${parsedUA.navegador} (${parsedUA.so})</span>
              <span><strong>IP:</strong> ${escapeHTML(v.ip || "Desconhecido")}</span>
              <span class="access-date-full">${dataAcesso}</span>
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error("Erro ao carregar visualizações:", error);
    container.innerHTML = `
      <div style="text-align:center; padding: 40px;">
        
        <p style="color: #ef4444; font-size: 14px; font-weight: 600;">Erro ao carregar histórico</p>
        <p style="color: var(--muted); font-size: 12px;">Verifique sua conexão e tente novamente.</p>
      </div>
    `;
  }
}

// ==========================================
// FILTROS INTERATIVOS DO FUNIL COMERCIAL
// ==========================================
let ACTIVE_FUNNEL_STAGE = ""; // "criadas", "visualizadas", "aprovadas"
let ACTIVE_FUNNEL_STAT = "";  // "visualizaram", "pendentes", "conversao", "em_aberto"

function cliqueEstagioFunil(estagio, elemento) {
  // Desmarcar todos os outros elementos do funil
  document.querySelectorAll(".funnel-stage").forEach(el => el.classList.remove("stage-active"));
  document.querySelectorAll(".funnel-stat-rate, .funnel-stat-loss").forEach(el => el.classList.remove("stat-active"));
  
  if (ACTIVE_FUNNEL_STAGE === estagio) {
    // Se clicou no mesmo, desativa o filtro
    ACTIVE_FUNNEL_STAGE = "";
    ACTIVE_FUNNEL_STAT = "";
  } else {
    ACTIVE_FUNNEL_STAGE = estagio;
    ACTIVE_FUNNEL_STAT = "";
    elemento.classList.add("stage-active");
  }

  aplicarFiltrosEspeciaisFunil();
}

function cliqueTaxaFunil(taxa, elemento) {
  document.querySelectorAll(".funnel-stage").forEach(el => el.classList.remove("stage-active"));
  document.querySelectorAll(".funnel-stat-rate, .funnel-stat-loss").forEach(el => el.classList.remove("stat-active"));

  if (ACTIVE_FUNNEL_STAT === taxa) {
    ACTIVE_FUNNEL_STAGE = "";
    ACTIVE_FUNNEL_STAT = "";
  } else {
    ACTIVE_FUNNEL_STAGE = "";
    ACTIVE_FUNNEL_STAT = taxa;
    elemento.classList.add("stat-active");
  }

  aplicarFiltrosEspeciaisFunil();
}

function aplicarFiltrosEspeciaisFunil() {
  const filtroStatus = document.getElementById("filtroStatus");

  // Resetar os filtros padrão que conflitam com o funil
  if (filtroStatus) filtroStatus.value = "";
  FILTRO_VISUALIZACAO_DASHBOARD = "";
  FILTRO_OBSERVACAO_DASHBOARD = "";
  FILTRO_DESCONTO_DASHBOARD = "";

  // Aplicar as regras baseadas no estado ativo do funil
  if (ACTIVE_FUNNEL_STAGE === "criadas") {
    // Sem filtros extras, exibe todas
  } else if (ACTIVE_FUNNEL_STAGE === "visualizadas") {
    FILTRO_VISUALIZACAO_DASHBOARD = "visualizadas";
  } else if (ACTIVE_FUNNEL_STAGE === "aprovadas") {
    if (filtroStatus) filtroStatus.value = "Aprovada";
  } else if (ACTIVE_FUNNEL_STAT === "visualizaram") {
    FILTRO_VISUALIZACAO_DASHBOARD = "visualizadas";
  } else if (ACTIVE_FUNNEL_STAT === "pendentes") {
    FILTRO_VISUALIZACAO_DASHBOARD = "nao_visualizadas";
  } else if (ACTIVE_FUNNEL_STAT === "conversao") {
    if (filtroStatus) filtroStatus.value = "Aprovada";
  } else if (ACTIVE_FUNNEL_STAT === "em_aberto") {
    if (filtroStatus) filtroStatus.value = "Pendente";
  }

  // Destacar filtros rápidos neutros
  destacarFiltroSelecionado(null);
  aplicarFiltrosDashboard();
}

// 🛡️ MODAL DE AUDITORIA COMPLETA D4SIGN & ASSINATURA DIGITAL
window.abrirModalAuditoriaD4Sign = async function(propostaId) {
  const p = TODAS_PROPOSTAS_DASHBOARD.find(item => item.id === Number(propostaId));
  if (!p) return;

  const container = document.getElementById("conteudoAuditoriaD4Sign");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:30px; color:#64748b;">
      
      Carregando histórico e certificado digital...
    </div>
  `;

  abrirModal("modalAuditoriaD4Sign");

  // Buscar visualizações
  let visualizacoes = [];
  try {
    const res = await fetch(`/api/propostas/${propostaId}/visualizacoes`, { headers: authHeaders });
    if (res.ok) visualizacoes = await res.json();
  } catch (e) {
    console.warn("Erro ao buscar visualizações:", e);
  }

  const isAprovada = p.status === "Aprovada";
  const dataDecisaoFmt = p.data_decisao ? formatarData(p.data_decisao) : "Aguardando assinatura";
  // Só o UUID real do D4Sign; antes inventava um "protocolo" a partir do token numa tela de auditoria
  const uuidProtocolo = ehUuidD4SignFront(p.ip_assinatura) ? p.ip_assinatura : "Contrato ainda não gerado no D4Sign";
  const totalFmt = formatarMoeda(Number(p.valor_total || 0));

  let htmlVisitas = "";
  if (visualizacoes.length > 0) {
    htmlVisitas = visualizacoes.map((v, idx) => {
      const dataVisita = new Date(v.visualizado_em).toLocaleString("pt-BR");
      const dev = detectarDispositivo(v.user_agent);
      const durSec = Number(v.duracao_segundos || 0);
      let durTxt = "";
      if (durSec > 0) {
        const min = Math.floor(durSec / 60);
        const sec = durSec % 60;
        const formatted = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
        durTxt = ` • <span style="color:#059669; font-weight:700;">${formatted} ${durSec >= 120 ? '' : ''}</span>`;
      }

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-radius:6px; font-size:12px; margin-bottom:4px; border:1px solid #f1f5f9;">
          <div>
            <strong>Acesso #${visualizacoes.length - idx}</strong> • <span style="color:#0284c7; font-weight:700;">${dev.label || "Dispositivo"}</span>${durTxt}
            <div style="color:#64748b; font-size:11px;">IP: <code>${escapeHTML(v.ip || 'Não registrado')}</code></div>
          </div>
          <span style="color:#334155; font-size:11px; font-weight:600;">${dataVisita}</span>
        </div>
      `;
    }).join("");
  } else {
    htmlVisitas = `<div style="font-size:12px; color:#64748b; padding:10px;">Nenhum acesso registrado ainda.</div>`;
  }

  container.innerHTML = `
    <!-- Header de Status de Autenticidade -->
    <div style="background:${isAprovada ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'linear-gradient(135deg, #fffbeb, #fef3c7)'}; border:1.5px solid ${isAprovada ? '#10b981' : '#f59e0b'}; border-radius:14px; padding:16px 20px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; color:${isAprovada ? '#065f46' : '#92400e'}; letter-spacing:0.5px;">
          Status de Integridade do Documento
        </div>
        <div style="font-size:17px; font-weight:900; color:${isAprovada ? '#047857' : '#b45309'}; margin-top:2px;">
          ${isAprovada ? 'Documento Assinado com Validade Jurídica' : 'Aguardando Assinatura do Signatário'}
        </div>
      </div>
      <div style="text-align:right;">
        <span style="font-size:11px; color:#64748b; display:block;">Valor Total</span>
        <strong style="font-size:16px; color:#0f172a;">${totalFmt}</strong>
      </div>
    </div>

    <!-- Grid de Informações Técnicas do Envelope -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px;">
      <!-- Box 1: Dados do Envelope / D4Sign -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#0f172a; display:flex; align-items:center; gap:6px;">
          Dados do Envelope & Protocolo
        </h4>
        <div style="font-size:12px; line-height:1.7; color:#334155;">
          <div><strong style="color:#64748b;">Nº Proposta:</strong> #${p.numero_proposta}</div>
          <div><strong style="color:#64748b;">Protocolo / UUID:</strong> <code style="background:#e2e8f0; padding:1px 4px; border-radius:4px; font-size:11px;">${escapeHTML(uuidProtocolo)}</code></div>
          <div><strong style="color:#64748b;">Data de Criação:</strong> ${formatarData(p.criado_em)}</div>
          <div><strong style="color:#64748b;">Data da Assinatura:</strong> ${dataDecisaoFmt}</div>
          <div><strong style="color:#64748b;">Normativa Legal:</strong> MP 2.200-2/2001 & Lei 14.063/2020</div>
        </div>
      </div>

      <!-- Box 2: Signatário Responsável -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px;">
        <h4 style="margin:0 0 10px 0; font-size:13px; color:#0f172a; display:flex; align-items:center; gap:6px;">
          Signatário Principal
        </h4>
        <div style="font-size:12px; line-height:1.7; color:#334155;">
          <div><strong style="color:#64748b;">Nome:</strong> ${escapeHTML(p.nome_socio || p.nome_clinica || 'Não informado')}</div>
          <div><strong style="color:#64748b;">Clínica:</strong> ${escapeHTML(p.nome_clinica)}</div>
          <div><strong style="color:#64748b;">E-mail:</strong> ${escapeHTML(p.email || 'Não informado')}</div>
          <div><strong style="color:#64748b;">Telefone:</strong> ${escapeHTML(p.telefone || 'Não informado')}</div>
          <div><strong style="color:#64748b;">CNPJ / CPF:</strong> ${escapeHTML(p.cnpj || p.cpf_socio || 'Não informado')}</div>
        </div>
      </div>
    </div>

    <!-- Trilha de Acessos / Visualizações -->
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:20px;">
      <h4 style="margin:0 0 10px 0; font-size:13px; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
        <span>Trilha de Auditoria & Acessos do Cliente</span>
        <span style="font-size:11px; background:#e0f2fe; color:#0369a1; font-weight:700; padding:2px 8px; border-radius:999px;">
          ${visualizacoes.length} acesso(s)
        </span>
      </h4>
      <div style="max-height:180px; overflow-y:auto;">
        ${htmlVisitas}
      </div>
    </div>

    <!-- Ações Finais -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; border-top:1px solid #e2e8f0; padding-top:14px;">
      <div style="display:flex; gap:8px;">
        <a href="/api/propostas/${p.token_acesso}/pdf" target="_blank" class="btn-secondary" style="font-size:12px; font-weight:800; text-decoration:none; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
          Baixar PDF com Registro Digital
        </a>
        <a href="/proposta/visualizar.html?token=${p.token_acesso}" target="_blank" class="btn-secondary" style="font-size:12px; font-weight:800; text-decoration:none; padding:8px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
          Ver Ambiente do Cliente
        </a>
      </div>
      <button type="button" class="btn-primary" style="padding:8px 20px; font-weight:800; border-radius:8px;" onclick="fecharModal('modalAuditoriaD4Sign')">
        Fechar
      </button>
    </div>
  `;
};

// 📊 EXPORTAÇÃO DE RELATÓRIO COMERCIAL (EXCEL / CSV)
window.exportarRelatorioExcelCSV = function() {
  const lista = TODAS_PROPOSTAS_DASHBOARD || [];
  if (lista.length === 0) {
    alert("Nenhuma proposta disponível para exportação.");
    return;
  }

  const cabecalhos = [
    "ID Proposta",
    "Nº Proposta",
    "Unidade",
    "Clínica",
    "CNPJ",
    "Sócio Responsável",
    "E-mail",
    "Telefone",
    "Investimento Mensal (R$)",
    "Investimento Pontual (R$)",
    "Valor Total (R$)",
    "Status",
    "Visualizações",
    "Data de Criação",
    "Data de Assinatura / Decisão",
    "Link Ambiente do Cliente"
  ];

  const linhas = lista.map((p) => {
    const empresa = (p.tipo_proposta || p.tipoProposta || "FINORA").toUpperCase();
    const mensal = Number(p.investimento_mensal || 0).toFixed(2).replace(".", ",");
    const pontual = Number(p.investimento_pontual || 0).toFixed(2).replace(".", ",");
    const total = Number(p.valor_total || 0).toFixed(2).replace(".", ",");
    const criacao = p.criado_em ? new Date(p.criado_em).toLocaleDateString("pt-BR") : "";
    const decisao = p.data_decisao ? new Date(p.data_decisao).toLocaleDateString("pt-BR") : "Aguardando";
    const link = `${window.location.origin}/proposta/p/${p.token_acesso}`;

    return [
      p.id,
      `#${p.numero_proposta || p.id}`,
      `"${empresa}"`,
      `"${(p.nome_clinica || '').replace(/"/g, '""')}"`,
      `"${p.cnpj || ''}"`,
      `"${(p.nome_socio || '').replace(/"/g, '""')}"`,
      `"${p.email || ''}"`,
      `"${p.telefone || ''}"`,
      `"${mensal}"`,
      `"${pontual}"`,
      `"${total}"`,
      `"${p.status || 'Pendente'}"`,
      p.total_visualizacoes || 0,
      `"${criacao}"`,
      `"${decisao}"`,
      `"${link}"`
    ].join(";");
  });

  const conteudoCsv = "\uFEFF" + cabecalhos.join(";") + "\n" + linhas.join("\n");
  const blob = new Blob([conteudoCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const dataHoje = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_propostas_comerciais_${dataHoje}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 🔥 TERMÔMETRO INTELIGENTE DE PROBABILIDADE DE FECHAMENTO
function calcularTermometroFechamento(p) {
  if (p.status === "Aprovada") {
    return { score: 100, label: "Contrato Fechado", cor: "#15803d", bg: "#dcfce7", border: "#86efac" };
  }
  if (p.status === "Recusada") {
    return { score: 0, label: "Recusada", cor: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" };
  }

  let score = 20; // Base
  const views = Number(p.total_visualizacoes || 0);
  if (views >= 1) score += 25;
  if (views >= 3) score += 20;
  if (views >= 5) score += 15;

  if (p.ultima_visualizacao) {
    const diffHoras = (Date.now() - new Date(p.ultima_visualizacao).getTime()) / (1000 * 60 * 60);
    if (diffHoras < 24) score += 15;
    else if (diffHoras > 72) score -= 15;
  }

  score = Math.max(10, Math.min(95, score));

  if (score >= 70) {
    return { score, label: `${score}% Fechamento Quente`, cor: "#c2410c", bg: "#fff7ed", border: "#fed7aa" };
  } else if (score >= 40) {
    return { score, label: `${score}% Interesse Médio`, cor: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" };
  } else {
    return { score, label: `${score}% Contato Frio`, cor: "#475569", bg: "#f1f5f9", border: "#cbd5e1" };
  }
}

// 📁 MODAL DE DOCUMENTOS DE ONBOARDING NO DASHBOARD
window.abrirModalDocumentosDashboard = async function(propostaId) {
  const p = TODAS_PROPOSTAS_DASHBOARD.find(item => item.id === propostaId);
  const container = document.getElementById("conteudoDocumentosDashboard");
  const titulo = document.getElementById("tituloModalDocumentos");
  if (!container) return;

  if (titulo && p) {
    titulo.innerText = `Documentos: ${p.nome_clinica} (#${p.numero_proposta})`;
  }

  container.innerHTML = `<div style="text-align:center; padding:24px; color:#64748b;">Carregando documentos anexados...</div>`;
  abrirModal("modalDocumentosDashboard");

  try {
    const token = localStorage.getItem("finora_token");
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/propostas/${propostaId}/documentos-internos`, { headers: authHeaders });

    if (!res.ok) {
      container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:20px;">Não foi possível carregar os documentos.</div>`;
      return;
    }

    const docs = await res.json();

    if (docs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px;">
          
          <strong style="color:#0f172a; font-size:14px; display:block;">Nenhum documento anexado ainda</strong>
          <p style="color:#64748b; font-size:12px; margin-top:4px;">
            O cliente ainda não enviou os documentos ou optou por enviar diretamente pelo WhatsApp.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display:grid; gap:10px; margin-bottom:16px;">
        ${docs.map(doc => {
          const kb = (Number(doc.tamanho_bytes || 0) / 1024).toFixed(1);
          const dataEnvio = new Date(doc.enviado_em).toLocaleString("pt-BR");
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 16px;">
              <div>
                <strong style="color:#0f172a; font-size:13px; display:block;">${escapeHTML(doc.tipo_documento)}</strong>
                <span style="color:#64748b; font-size:11px; overflow-wrap:anywhere;">${escapeHTML(doc.nome_original)} (${kb} KB) • Enviado em ${dataEnvio}</span>
              </div>
              <a href="#" onclick="baixarDocumentoDashboard(event, ${Number(doc.id)}, this.dataset.nome)" data-nome="${escapeHTML(doc.nome_original)}" class="btn-mini" style="background:#0284c7; color:#fff; font-weight:800; text-decoration:none; padding:6px 14px; border-radius:8px; display:inline-flex; align-items:center; gap:4px; font-size:12px;">
                Baixar
              </a>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-primary" style="padding:8px 20px; font-weight:800; border-radius:8px;" onclick="fecharModal('modalDocumentosDashboard')">
          Fechar
        </button>
      </div>
    `;
  } catch (err) {
    console.error("Erro ao carregar documentos:", err);
    container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:20px;">Erro de conexão ao buscar documentos.</div>`;
  }
};

// Download via fetch para mandar o JWT no header (link <a> puro não envia Authorization)
window.baixarDocumentoDashboard = async function(event, docId, nome) {
  event.preventDefault();
  const token = localStorage.getItem("finora_token");
  const res = await fetch(`/api/documentos/${docId}/download`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return alert("Não foi possível baixar o documento.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nome || "documento";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * 🔥 ALERTA FLUTUANTE DE LEAD QUENTE EM TEMPO REAL
 */
window.exibirAlertaLeadQuente = function(dados) {
  let toastContainer = document.getElementById("toastContainerHotLead");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainerHotLead";
    toastContainer.style.cssText = "position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:12px; max-width:380px;";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.style.cssText = "background:rgba(15,23,42,0.95); backdrop-filter:blur(12px); border:1.5px solid #10b981; border-radius:16px; padding:16px 18px; color:#ffffff; box-shadow:0 20px 40px rgba(0,0,0,0.3); display:flex; gap:12px; align-items:flex-start; animation:slideUp 0.3s ease;";
  
  const clinica = dados.clinica || "Clínica Interessada";
  const tempo = dados.tempo || "agora";
  const tel = (dados.telefone || "").replace(/\D/g, "");
  const whatsappUrl = tel ? `https://wa.me/55${tel}?text=Ol%C3%A1%2C%20tudo%20bem%3F%20Vi%20que%20est%C3%A1%20analisando%20nossa%20proposta%20comercial!` : "#";

  toast.innerHTML = `
    
    <div style="flex:1;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#34d399; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">Lead Quente na Proposta!</strong>
        <span style="font-size:11px; color:#94a3b8;">${escapeHTML(tempo)}</span>
      </div>
      <div style="font-size:14px; font-weight:800; margin:4px 0 8px 0; color:#ffffff;">${escapeHTML(clinica)}</div>
      <div style="display:flex; gap:8px;">
        ${tel ? `<a href="${whatsappUrl}" target="_blank" style="background:#25d366; color:#fff; font-size:11.5px; font-weight:800; text-decoration:none; padding:6px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">Chamar no WhatsApp</a>` : ''}
        <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background:rgba(255,255,255,0.1); border:none; color:#cbd5e1; font-size:11.5px; font-weight:700; padding:6px 10px; border-radius:8px; cursor:pointer;">Dispensar</button>
      </div>
    </div>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 12000);
};




