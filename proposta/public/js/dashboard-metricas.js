function animarContagemHUD(elementoId, valorFinalStr, tipo = 'number') {
  const el = document.getElementById(elementoId);
  if (!el) return;

  if (el.dataset.animationId) {
    cancelAnimationFrame(Number(el.dataset.animationId));
  }

  let valorFinalNum = 0;
  if (tipo === 'currency') {
    const clean = valorFinalStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    valorFinalNum = parseFloat(clean) || 0;
  } else if (tipo === 'percent') {
    valorFinalNum = parseFloat(valorFinalStr.replace("%", "")) || 0;
  } else {
    valorFinalNum = parseFloat(valorFinalStr) || 0;
  }

  const startValue = 0;
  const duration = 500; // 500ms animation duration
  const startTime = performance.now();
  const chars = "0123456789$#%@&";

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing (easeOutQuad)
    const easeProgress = progress * (2 - progress);
    const currentValue = startValue + (valorFinalNum - startValue) * easeProgress;

    let glitchStr = "";
    if (progress < 0.95) {
      glitchStr = chars[Math.floor(Math.random() * chars.length)] + chars[Math.floor(Math.random() * chars.length)];
    }

    let displayStr = "";
    if (progress === 1) {
      displayStr = valorFinalStr;
    } else {
      if (tipo === 'currency') {
        displayStr = formatarMoeda(currentValue) + " " + glitchStr;
      } else if (tipo === 'percent') {
        displayStr = currentValue.toFixed(1) + "% " + glitchStr;
      } else {
        displayStr = Math.floor(currentValue) + " " + glitchStr;
      }
    }

    el.innerText = displayStr;

    if (progress < 1) {
      el.dataset.animationId = requestAnimationFrame(update);
    } else {
      delete el.dataset.animationId;
    }
  }

  el.dataset.animationId = requestAnimationFrame(update);
}

function atualizarMetricasDashboard(propostas) {
  const total = propostas.length;

  const visualizadas = propostas.filter(
    (p) => Number(p.total_visualizacoes || 0) > 0,
  ).length;

  const aprovadas = propostas.filter(
    (p) => String(p.status || "").toLowerCase() === "aprovada",
  ).length;

  const conversao = total > 0 ? ((aprovadas / total) * 100).toFixed(1) : "0.0";

  // D4Sign específicos
  const d4signAssinadas = propostas.filter(
    (p) => String(p.status || "").toLowerCase() === "aprovada" && p.ip_assinatura && p.ip_assinatura.length > 15
  ).length;

  const d4signPendentes = propostas.filter(
    (p) => String(p.status || "").toLowerCase() === "pendente" && p.ip_assinatura && p.ip_assinatura.length > 15
  ).length;

  animarContagemHUD("metricTotalPropostas", total.toString(), "number");
  animarContagemHUD("metricVisualizadas", visualizadas.toString(), "number");
  animarContagemHUD("metricAprovadas", aprovadas.toString(), "number");
  animarContagemHUD("metricConversao", `${conversao}%`, "percent");
  animarContagemHUD("metricD4SignAssinadas", d4signAssinadas.toString(), "number");
  animarContagemHUD("metricD4SignPendentes", d4signPendentes.toString(), "number");
}

function atualizarFunilComercial(propostas) {
  const criadas = propostas.length;

  const visualizadas = propostas.filter(
    (p) => Number(p.total_visualizacoes || 0) > 0,
  ).length;

  const aprovadas = propostas.filter(
    (p) => String(p.status || "").toLowerCase() === "aprovada",
  ).length;

  const aprovadasVisualizadas = propostas.filter(
    (p) =>
      Number(p.total_visualizacoes || 0) > 0 &&
      String(p.status || "").toLowerCase() === "aprovada",
  ).length;

  const pctVisualizacao = criadas > 0 ? ((visualizadas / criadas) * 100).toFixed(1) : "0.0";
  const pctPerdaVisualizacao = criadas > 0 ? (((criadas - visualizadas) / criadas) * 100).toFixed(1) : "0.0";
  const conversaoVisualizacao = visualizadas > 0 ? ((aprovadasVisualizadas / visualizadas) * 100).toFixed(1) : "0.0";
  const pctPerdaFechamento = visualizadas > 0 ? (((visualizadas - aprovadasVisualizadas) / visualizadas) * 100).toFixed(1) : "0.0";

  animarContagemHUD("funilCriadas", criadas.toString(), "number");
  animarContagemHUD("funilVisualizadas", visualizadas.toString(), "number");
  animarContagemHUD("funilAprovadas", aprovadas.toString(), "number");
  
  animarContagemHUD("funilTaxaVisualizacao", `${pctVisualizacao}% visualizaram`, "percent");
  animarContagemHUD("funilPerdaVisualizacao", `${pctPerdaVisualizacao}% não abertas`, "percent");
  animarContagemHUD("funilConversaoVisualizacao", `${conversaoVisualizacao}% de conversão`, "percent");
  animarContagemHUD("funilPerdaFechamento", `${pctPerdaFechamento}% em aberto`, "percent");
}

function atualizarMetricasFinanceiras(propostas, propostasSemFiltroEmpresa) {
  const valorEnviado = propostas.reduce((total, p) => {
    return total + Number(p.valor_total || 0);
  }, 0);

  const propostasAprovadas = propostas.filter(
    (p) => String(p.status || "").toLowerCase() === "aprovada",
  );

  const valorAprovado = propostasAprovadas.reduce((total, p) => {
    return total + Number(p.valor_total || 0);
  }, 0);

  const propostasPendentes = propostas.filter(
    (p) => {
      const st = String(p.status || "").toLowerCase();
      return st === "pendente" || st === "aguardando aprovação" || st === "aguardando-aprovação";
    }
  );

  const valorPipeline = propostasPendentes.reduce((total, p) => {
    return total + Number(p.valor_total || 0);
  }, 0);

  const ticketMedio =
    propostas.length > 0 ? valorEnviado / propostas.length : 0;

  animarContagemHUD("valorEnviadoDashboard", formatarMoeda(valorEnviado), "currency");
  animarContagemHUD("valorAprovadoDashboard", formatarMoeda(valorAprovado), "currency");
  animarContagemHUD("ticketMedioDashboard", formatarMoeda(ticketMedio), "currency");
  animarContagemHUD("valorPipelineDashboard", formatarMoeda(valorPipeline), "currency");

  // Atualizar Barra de Progresso da Meta Comercial (Melhoria 1)
  const metaMensal = 50000;
  const pctMeta = Math.min(100, Math.round((valorAprovado / metaMensal) * 100));
  const lblMeta = document.getElementById("lblPercentualMeta");
  const barMeta = document.getElementById("barProgressoMeta");

  if (lblMeta) lblMeta.innerText = `${pctMeta}% Atingido (${formatarMoeda(valorAprovado)})`;
  if (barMeta) barMeta.style.width = `${pctMeta}%`;

  // Novas rotinas de sub-analytics
  atualizarTicketMedioPorEmpresa(propostasSemFiltroEmpresa || propostas);
  atualizarRankingServicos(propostas);
}

let chartInstance = null;

function processarDadosGrafico(propostas) {
  const agrupamento = document.getElementById("filtroAgrupamentoGrafico")?.value || "mensal";
  const grupos = {};
  
  propostas.forEach(p => {
    if (!p.data_proposta) return;
    const date = new Date(p.data_proposta);
    if (isNaN(date.getTime())) return;
    
    let key = "";
    let label = "";
    
    const dia = date.getDate();
    const mes = date.getMonth();
    const ano = date.getFullYear();
    
    if (agrupamento === "diario") {
      key = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      label = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${String(ano).slice(-2)}`;
    } else if (agrupamento === "anual") {
      key = `${ano}`;
      label = `${ano}`;
    } else { // mensal
      key = `${ano}-${String(mes + 1).padStart(2, '0')}`;
      const nomesMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      label = `${nomesMeses[mes]}/${String(ano).slice(-2)}`;
    }
    
    if (!grupos[key]) {
      grupos[key] = { 
        label: label, 
        enviado: 0, 
        aprovado: 0 
      };
    }
    
    const valor = Number(p.valor_total || 0);
    grupos[key].enviado += valor;
    if (String(p.status || "").toLowerCase() === "aprovada") {
      grupos[key].aprovado += valor;
    }
  });

  // Ordenar pela chave (ano-mês)
  const sortedKeys = Object.keys(grupos).sort();
  
  // Limitar diário aos últimos 15 pontos para evitar poluição visual
  let keysToUse = sortedKeys;
  if (agrupamento === "diario") {
    keysToUse = sortedKeys.slice(-15);
  }
  
  const labels = keysToUse.map(k => grupos[k].label);
  const enviadoData = keysToUse.map(k => grupos[k].enviado);
  const aprovadoData = keysToUse.map(k => grupos[k].aprovado);

  return { labels, enviadoData, aprovadoData };
}

window.alterarAgrupamentoGrafico = function() {
  const select = document.getElementById("filtroAgrupamentoGrafico");
  const titleEl = document.getElementById("chartTitleText");
  if (select && titleEl) {
    const labelsMap = {
      diario: "Análise de Desempenho (Faturamento Diário)",
      mensal: "Análise de Desempenho (Faturamento Mensal)",
      anual: "Análise de Desempenho (Faturamento Anual)"
    };
    titleEl.textContent = labelsMap[select.value] || "Análise de Desempenho";
  }
  
  // Forçar atualização do dashboard e re-renderizar gráfico
  if (typeof aplicarFiltrosDashboard === "function") {
    aplicarFiltrosDashboard();
  }
};

function renderizarGraficoDashboard(propostas) {
  const canvas = document.getElementById("graficoPropostas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { labels, enviadoData, aprovadoData } = processarDadosGrafico(propostas);

  if (chartInstance) {
    chartInstance.destroy();
  }

  // Get current active primary color
  const corTema = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#663399';

  // Initialize Chart.js
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Valor Enviado",
          data: enviadoData,
          backgroundColor: corTema + "b0",
          borderColor: corTema,
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 32,
        },
        {
          label: "Valor Aprovado",
          data: aprovadoData,
          backgroundColor: "#10b981b0",
          borderColor: "#10b981",
          borderWidth: 1.5,
          borderRadius: 6,
          maxBarThickness: 32,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: "#64748b",
            font: {
              family: "Inter, sans-serif",
              weight: "bold",
              size: 11
            },
            padding: 15,
            usePointStyle: true,
            pointStyle: "circle"
          }
        },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#ffffff",
          bodyColor: "#f1f5f9",
          borderColor: "#334155",
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          titleFont: { family: "Inter, sans-serif", weight: "bold" },
          bodyFont: { family: "Inter, sans-serif" },
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatarMoeda(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(148, 163, 184, 0.06)",
            drawBorder: false
          },
          ticks: {
            color: "#64748b",
            font: {
              family: "Inter, sans-serif",
              size: 10
            }
          }
        },
        y: {
          grid: {
            color: "rgba(148, 163, 184, 0.06)",
            drawBorder: false
          },
          ticks: {
            color: "#64748b",
            font: {
              family: "Inter, sans-serif",
              size: 10
            },
            callback: function (value) {
              if (value >= 1000000) {
                return "R$ " + (value / 1000000).toFixed(1) + "M";
              }
              if (value >= 1000) {
                return "R$ " + (value / 1000).toFixed(0) + "k";
              }
              return "R$ " + value;
            }
          }
        }
      }
    }
  });
}

function atualizarTicketMedioPorEmpresa(propostas) {
  const acumuladores = {
    FINORA: { soma: 0, qtd: 0 },
    CONTABIL: { soma: 0, qtd: 0 },
    TECH: { soma: 0, qtd: 0 },
    AUDITORIA: { soma: 0, qtd: 0 }
  };

  propostas.forEach(p => {
    let emp = String(p.tipo_proposta || p.tipoProposta || p.empresa || "FINORA").toUpperCase();
    if (emp === "QMAX") emp = "CONTABIL";
    
    if (acumuladores[emp]) {
      acumuladores[emp].soma += Number(p.valor_total || 0);
      acumuladores[emp].qtd++;
    }
  });

  const ticketFinora = acumuladores.FINORA.qtd > 0 ? acumuladores.FINORA.soma / acumuladores.FINORA.qtd : 0;
  const ticketContabil = acumuladores.CONTABIL.qtd > 0 ? acumuladores.CONTABIL.soma / acumuladores.CONTABIL.qtd : 0;
  const ticketTech = acumuladores.TECH.qtd > 0 ? acumuladores.TECH.soma / acumuladores.TECH.qtd : 0;
  const ticketAuditoria = acumuladores.AUDITORIA.qtd > 0 ? acumuladores.AUDITORIA.soma / acumuladores.AUDITORIA.qtd : 0;

  animarContagemHUD("ticketFinora", formatarMoeda(ticketFinora), "currency");
  animarContagemHUD("ticketContabil", formatarMoeda(ticketContabil), "currency");
  animarContagemHUD("ticketTech", formatarMoeda(ticketTech), "currency");
  animarContagemHUD("ticketAuditoria", formatarMoeda(ticketAuditoria), "currency");
}

function atualizarRankingServicos(propostas) {
  const servicos = {};

  propostas.forEach(p => {
    let itens = [];
    try {
      itens = lerJson(p.itens_json);
    } catch {
      itens = [];
    }

    itens.forEach(item => {
      const nome = item.servico || "Serviço Indefinido";
      const valor = Number(item.valor || 0);

      if (!servicos[nome]) {
        servicos[nome] = { nome, qtd: 0, receita: 0 };
      }
      servicos[nome].qtd++;
      servicos[nome].receita += valor;
    });
  });

  const listaOrdenada = Object.values(servicos).sort((a, b) => b.qtd - a.qtd || b.receita - a.receita);

  const container = document.getElementById("servicosRankingBody");
  if (!container) return;

  if (listaOrdenada.length === 0) {
    container.innerHTML = `
      <div style="color: #64748b; text-align: center; font-size: 13px; padding-top: 20px;">
        Nenhum serviço registrado nas propostas deste filtro.
      </div>
    `;
    return;
  }

  const maxQtd = Math.max(...listaOrdenada.map(s => s.qtd));

  container.innerHTML = listaOrdenada.slice(0, 10).map((srv, index) => {
    const pct = maxQtd > 0 ? (srv.qtd / maxQtd) * 100 : 0;
    
    // top 3 na cor da casa, demais em cinza
    const barColor = index < 3 ? "#1f5a52" : "#c9c1b2";

    return `
      <div class="ranking-servico-row" style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">
          <span>${index + 1}. ${escapeHTML(srv.nome)}</span>
          <span style="color: #64748b;">${srv.qtd}x (${formatarMoeda(srv.receita)})</span>
        </div>
        <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
          <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.6s ease;"></div>
        </div>
      </div>
    `;
  }).join("");
}

