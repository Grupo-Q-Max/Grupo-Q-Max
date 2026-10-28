let propostaSelecionadaDesconto = null;
let configServicos = [];
let configTopicos = [];
let configRegras = [];
let regraPrecoSelecionada = null;
let servicosRegrasGerais = [];
let PLANOS_TECH_DASH = [];

async function carregarSolicitacoes() {
  const res = await fetch("/api/solicitacoes", { headers: authHeaders });
  if (!res.ok) {
    if (res.status === 403) window.location.href = "/proposta/dashboard.html"; // Comercial na tela de Diretor
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = "/proposta/login.html";
    }
    return;
  }

  const solicitacoes = await res.json();
  const tbody = document.querySelector("#tabelaSolicitacoes tbody");
  tbody.innerHTML = "";

  if (solicitacoes.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;">Nenhuma solicitação pendente.</td></tr>';
    return;
  }

  solicitacoes.forEach((s) => {
    let itens = [];
    try {
      itens = lerJson(s.itens_json);
    } catch {
      itens = [];
    }

    const itensMensais = itens.filter((item) => tipoItem(item) === "Mensal");
    const itensPontuais = itens.filter((item) => tipoItem(item) === "Pontual");

    tbody.innerHTML += `
        <tr>
          <td><strong>${s.numero_proposta}</strong><br><small>${escapeHTML(s.nome_clinica)}</small></td>
          <td>${escapeHTML(s.vendedor)}</td>
          <td style="color: #ef4444; font-weight: bold;">${s.percentual_solicitado || "-"}%</td>
          <td>${escapeHTML(s.justificativa || "-")}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn-action-icon btn-action-approve" onclick="responderSolicitacao(${s.id}, 'Aprovar', '${s.tipo_solicitacao}')" title="Aprovar Desconto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><path d="M20 6L9 17l-5-5"/></svg></button>
              ${
                s.tipo_solicitacao === 'item'
                  ? ""
                  : `<button class="btn-action-icon btn-action-alter" onclick="alterarSolicitacaoDesconto(${s.id}, ${s.percentual_solicitado})" title="Alterar Desconto">✎</button>`
              }
              <button class="btn-action-icon btn-action-reject" onclick="responderSolicitacao(${s.id}, 'Recusar', '${s.tipo_solicitacao}')" title="Recusar Desconto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:middle"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
              <button class="btn-action-icon btn-action-detail" onclick="toggleDetalhesSolicitacao(${s.id}, this)" title="Ver Detalhes">▼</button>
            </div>
          </td>
        </tr>
        <tr id="detalhes-solicitacao-${s.id}" class="hidden">
          <td colspan="5">
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
                  <div><span>Razão Social</span><strong>${escapeHTML(s.razao_social || "-")}</strong></div>
                  <div><span>CNPJ</span><strong>${escapeHTML(s.cnpj || "-")}</strong></div>
                  <div><span>Responsável</span><strong>${escapeHTML(s.nome_socio || "-")}</strong></div>
                  <div><span>CPF Sócio</span><strong>${escapeHTML(s.cpf_socio || "-")}</strong></div>
                  <div><span>Telefone</span><strong>${escapeHTML(s.telefone || "-")}</strong></div>
                  <div><span>E-mail</span><strong>${escapeHTML(s.email || "-")}</strong></div>
                  <div><span>Endereço</span><strong>${escapeHTML(s.endereco_clinica || "-")}</strong></div>
                  <div><span>Cadeiras</span><strong>${s.cadeiras || 0}</strong></div>
                  <div><span>Faturamento</span><strong>${s.faturamento ? formatador.format(s.faturamento) : "R$ 0,00"}</strong></div>
                  <div><span>Regime Fiscal</span><strong>${s.regime_fiscal || "-"}</strong></div>
                  <div><span>Regime Híbrido</span><strong>${s.regime_hibrido || "-"}</strong></div>
                  <div><span>Funcionários</span><strong>${s.funcionarios || 0}</strong></div>
                  <div><span>Sócios</span><strong>${s.socios || 0}</strong></div>
                  <div><span>Metragem</span><strong>${s.metragem || 0} m²</strong></div>
                  <div><span>Distância</span><strong>${s.distancia_km || 0} KM</strong></div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
  });
}

function toggleDetalhesSolicitacao(id, botao) {
  const detalhes = document.getElementById(`detalhes-solicitacao-${id}`);
  detalhes.classList.toggle("hidden");
  botao.innerHTML = detalhes.classList.contains("hidden") ? "▼" : "▲";
}

async function alterarSolicitacaoDesconto(id, percentualAtual) {
  const novoPercentual = prompt("Digite o novo percentual de desconto (%):", percentualAtual);
  if (novoPercentual === null) return;
  const val = parseFloat(novoPercentual);
  if (isNaN(val) || val < 0 || val > 100) {
    alert("Por favor, insira um valor válido de 0 a 100.");
    return;
  }

  const res = await fetch(`/api/solicitacoes/${id}/alterar`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ percentual: val }),
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.message || "Desconto alterado!");
    carregarSolicitacoes();
  } else {
    alert(data.error || "Erro ao alterar desconto.");
  }
}

async function responderSolicitacao(id, acao, tipo = 'global') {
  if (!confirm(`Tem certeza que deseja ${acao} este desconto?`)) return;

  const res = await fetch(`/api/solicitacoes/${id}/responder`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ acao, tipo }),
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (res.ok) {
    carregarSolicitacoes();
    carregarPropostas();
  }
}

async function criarUsuario() {
  const body = JSON.stringify({
    nome: document.getElementById("cadNome").value,
    email: document.getElementById("cadEmail").value,
    senha: document.getElementById("cadSenha").value,
    role: document.getElementById("cadRole").value,
    // Aparece para o cliente no botão de WhatsApp e no cartão de contato da proposta
    telefone: document.getElementById("cadTelefone")?.value || "",
  });

  const res = await fetch("/api/usuarios", {
    method: "POST",
    headers: authHeaders,
    body,
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (res.ok) fecharModal("modalUsuario");
}

function abrirModalDescontoItens(proposta) {
  propostaSelecionadaDesconto = proposta;

  document.getElementById("descPropostaId").value = proposta.id;
  document.getElementById("descJustificativa").value = "";

  let itens = [];

  try {
    itens = lerJson(proposta.itens_json);
  } catch {
    itens = [];
  }

  const lista = document.getElementById("listaItensDescontoDashboard");

  lista.innerHTML = `
    <table class="styled-table">
      <thead>
        <tr>
          <th>Serviço</th>
          <th>Valor atual</th>
          <th>Desconto %</th>
          <th>Valor final</th>
        </tr>
      </thead>
      <tbody>
        ${itens
          .map((item, index) => {
            const valor = Number(item.valor || 0);

            return `
              <tr>
                <td>
                  <strong>${escapeHTML(item.servico)}</strong><br>
                  <small style="color:#64748b;">${escapeHTML(item.observacao || "-")}</small>
                </td>
                <td>${formatador.format(valor)}</td>
                <td>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value="0"
                    class="input-desconto-dashboard"
                    data-index="${index}"
                    oninput="atualizarResumoDescontoDashboard()"
                  />
                </td>
                <td id="valorFinalDash-${index}">
                  <strong>${formatador.format(valor)}</strong>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>

    <div class="resumo-grid" style="margin-top:16px;">
      <div><span>Total mensal</span><strong id="dashTotalMensalDesconto">R$ 0,00</strong></div>
      <div><span>Total pontual</span><strong id="dashTotalPontualDesconto">R$ 0,00</strong></div>
      <div><span>Total geral</span><strong id="dashTotalGeralDesconto">R$ 0,00</strong></div>
    </div>
  `;

  abrirModal("modalDesconto");
  atualizarResumoDescontoDashboard();
}

function atualizarResumoDescontoDashboard() {
  if (!propostaSelecionadaDesconto) return;

  let itens = [];

  try {
    itens = lerJson(propostaSelecionadaDesconto.itens_json);
  } catch {
    itens = [];
  }

  let temMaiorQue20 = false;

  const itensComDesconto = itens.map((item, index) => {
    const input = document.querySelector(
      `.input-desconto-dashboard[data-index="${index}"]`,
    );

    const desconto = Math.min(Math.max(Number(input?.value || 0), 0), 100);
    const valorOriginal = Number(item.valor || 0);
    const valorDesconto = valorOriginal * (desconto / 100);
    const valorFinal = valorOriginal - valorDesconto;

    if (desconto > 20) temMaiorQue20 = true;

    const campoValorFinal = document.getElementById(`valorFinalDash-${index}`);
    if (campoValorFinal) {
      campoValorFinal.innerHTML = `<strong>${formatador.format(valorFinal)}</strong>`;
    }

    return {
      ...item,
      valorOriginal,
      descontoPercentual: desconto,
      valorDesconto,
      valor: valorFinal,
    };
  });

  const mensais = itensComDesconto.filter(
    (item) => tipoItem(item) === "Mensal",
  );
  const pontuais = itensComDesconto.filter(
    (item) => tipoItem(item) === "Pontual",
  );

  const totalMensal = mensais.reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  const totalPontual = pontuais.reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  const totalGeral = totalMensal + totalPontual;

  document.getElementById("dashTotalMensalDesconto").innerText =
    formatador.format(totalMensal);
  document.getElementById("dashTotalPontualDesconto").innerText =
    formatador.format(totalPontual);
  document.getElementById("dashTotalGeralDesconto").innerText =
    formatador.format(totalGeral);

  const caixaAuth = document.getElementById("caixaAuthDiretor");
  const btn = document.getElementById("btnConfirmaDesconto");

  if (role === "Comercial" && temMaiorQue20) {
    caixaAuth.style.display = "block";
    btn.innerText = "Enviar para aprovação";
  } else {
    caixaAuth.style.display = "none";
    btn.innerText = "Gerar nova proposta";
  }
}

async function enviarDescontoItensDashboard() {
  if (!propostaSelecionadaDesconto) return;

  let itens = [];

  try {
    itens = lerJson(propostaSelecionadaDesconto.itens_json);
  } catch {
    itens = [];
  }

  const itensComDesconto = itens.map((item, index) => {
    const input = document.querySelector(
      `.input-desconto-dashboard[data-index="${index}"]`,
    );

    const desconto = Math.min(Math.max(Number(input?.value || 0), 0), 100);
    const valorOriginal = Number(item.valor || 0);
    const valorDesconto = valorOriginal * (desconto / 100);
    const valorFinal = valorOriginal - valorDesconto;

    return {
      ...item,
      valorOriginal,
      descontoPercentual: desconto,
      valorDesconto,
      valor: valorFinal,
    };
  });

  const mensais = itensComDesconto.filter(
    (item) => tipoItem(item) === "Mensal",
  );
  const pontuais = itensComDesconto.filter(
    (item) => tipoItem(item) === "Pontual",
  );

  const totalMensal = mensais.reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  const totalPontual = pontuais.reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  const totalGeral = totalMensal + totalPontual;

  const body = {
    propostaOriginalId: propostaSelecionadaDesconto.id,
    justificativaDesconto: document.getElementById("descJustificativa").value,
    totalMensal,
    totalPontual,
    total: totalGeral,
    itens: itensComDesconto,
  };

  const btn = document.getElementById("btnConfirmaDesconto");
  const textoOriginal = btn.innerText;

  btn.innerText = "Processando...";
  btn.disabled = true;

  try {
    const res = await fetch(
      `/api/propostas/${propostaSelecionadaDesconto.id}/desconto-itens`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();
    alert(data.message || data.error);

    if (res.ok) {
      fecharModal("modalDesconto");
      carregarPropostas();

      if (role === "Diretor") {
        carregarSolicitacoes();
      }
    }
  } finally {
    btn.innerText = textoOriginal;
    btn.disabled = false;
  }
}

async function abrirModalConfigPdf() {
  abrirModal("modalConfigPdf");
  await carregarConfigPdf();
}

async function carregarConfigPdf() {
  const [resRegras, resTopicos] = await Promise.all([
    fetch("/api/config/servicos-topicos", { headers: authHeaders }),
    fetch("/api/config/topicos", { headers: authHeaders }),
  ]);

  configRegras = await resRegras.json();
  configTopicos = await resTopicos.json();

  const lista = document.getElementById("listaConfigPdf");

  if (!resRegras.ok || !resTopicos.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar configurações.</p>`;
    return;
  }

  const servicosMap = {};

  configRegras.forEach((item) => {
    if (!servicosMap[item.servico_id]) {
      servicosMap[item.servico_id] = {
        id: item.servico_id,
        nome: item.servico_nome,
        tipo: item.servico_tipo,
      };
    }
  });

  configServicos = Object.values(servicosMap);

  lista.innerHTML = `
    <div class="config-pdf-layout">
      <div class="config-servicos-lista">
        <h4>Serviços</h4>
        ${configServicos
          .map(
            (servico, index) => `
          <button 
            type="button"
            class="servico-config-btn ${index === 0 ? "ativo" : ""}"
            onclick="selecionarServicoConfig(${servico.id}, this)"
          >
            <span>${servico.nome}</span>
            <small>${servico.tipo}</small>
          </button>
        `,
          )
          .join("")}
      </div>

      <div class="config-topicos-painel">
        <div id="painelTopicosServico"></div>
      </div>
    </div>
  `;

  if (configServicos.length) {
    renderizarTopicosServico(configServicos[0].id);
  }
}

function selecionarServicoConfig(servicoId, botao) {
  document.querySelectorAll(".servico-config-btn").forEach((btn) => {
    btn.classList.remove("ativo");
  });

  botao.classList.add("ativo");
  renderizarTopicosServico(servicoId);
}

function renderizarTopicosServico(servicoId) {
  const servico = configServicos.find(
    (s) => Number(s.id) === Number(servicoId),
  );
  const painel = document.getElementById("painelTopicosServico");

  const regrasDoServico = {};
  configRegras.forEach((regra) => {
    if (Number(regra.servico_id) === Number(servicoId) && regra.topico_id) {
      regrasDoServico[regra.topico_id] = Number(regra.mostrar) === 1;
    }
  });

  painel.innerHTML = `
    <div class="config-painel-header">
      <div>
        <h4>${servico.nome}</h4>
        <small>Selecione quais tópicos aparecem no PDF quando este serviço estiver na proposta.</small>
      </div>
    </div>

    <div class="config-topicos-grid">
      ${configTopicos
        .map((topico) => {
          const marcado = regrasDoServico[topico.id] === true;

          return `
          <div class="topico-config-card ${marcado ? "ativo" : ""}">
            <div class="topico-card-top">
              <label style="display:flex; gap:10px; align-items:flex-start;">
                <input
                  type="checkbox"
                  ${marcado ? "checked" : ""}
                  onchange="alterarRegraServicoTopico(${servicoId}, ${topico.id}, this.checked); this.closest('.topico-config-card').classList.toggle('ativo', this.checked)"
                />
                <div>
                  <div class="topico-titulo">${escapeHTML(topico.titulo)}</div>
                  <div class="topico-desc">Ordem: ${topico.ordem || 0}</div>
                </div>
              </label>
            </div>

            <div class="topico-actions">
              <button 
                type="button" 
                class="btn-config btn-config-primary"
                onclick="abrirEditorTopico(configTopicos.find((t) => t.id === ${Number(topico.id)}))"
              >
                Editar texto
              </button>

              <button 
                type="button" 
                class="btn-config btn-config-light"
                onclick="visualizarTextoTopico(configTopicos.find((t) => t.id === ${Number(topico.id)}))"
              >
                Visualizar
              </button>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

function abrirEditorTopico(topico) {
  document.getElementById("editTopicoId").value = topico.id;
  document.getElementById("editTopicoTitulo").value = topico.titulo;
  document.getElementById("editTopicoOrdem").value = topico.ordem || 0;
  document.getElementById("editTopicoTexto").value = topico.texto || "";

  abrirModal("modalEditarTopico");
}

async function salvarEdicaoTopico() {
  const id = document.getElementById("editTopicoId").value;

  const body = {
    titulo: document.getElementById("editTopicoTitulo").value,
    ordem: document.getElementById("editTopicoOrdem").value,
    texto: document.getElementById("editTopicoTexto").value,
  };

  const res = await fetch(`/api/config/topicos/${id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar tópico.");
    return;
  }

  alert(data.message || "Tópico salvo.");
  fecharModal("modalEditarTopico");
  await carregarConfigPdf();
}

function abrirNovoTopicoPdf() {
  const form = document.getElementById("formNovoTopicoPdf");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function salvarNovoTopicoPdf() {
  const body = {
    titulo: document.getElementById("novoTopicoTitulo").value,
    ordem: document.getElementById("novoTopicoOrdem").value,
    texto: document.getElementById("novoTopicoTexto").value,
  };

  const res = await fetch("/api/config/topicos", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao criar tópico.");
    return;
  }

  alert(data.message || "Tópico criado.");

  document.getElementById("novoTopicoTitulo").value = "";
  document.getElementById("novoTopicoOrdem").value = "0";
  document.getElementById("novoTopicoTexto").value = "";
  document.getElementById("formNovoTopicoPdf").style.display = "none";

  await carregarConfigPdf();
}

async function alterarRegraServicoTopico(servicoId, topicoId, mostrar) {
  try {
    const res = await fetch(
      `/api/config/servicos/${servicoId}/topicos/${topicoId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ mostrar }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Erro ao salvar vínculo do tópico.");
      await carregarConfigPdf();
      return;
    }

    const regraExistente = configRegras.find(
      (regra) =>
        Number(regra.servico_id) === Number(servicoId) &&
        Number(regra.topico_id) === Number(topicoId),
    );

    if (regraExistente) {
      regraExistente.mostrar = mostrar ? 1 : 0;
    } else {
      configRegras.push({
        servico_id: servicoId,
        topico_id: topicoId,
        mostrar: mostrar ? 1 : 0,
      });
    }
  } catch (error) {
    alert("Erro ao salvar vínculo do tópico.");
    await carregarConfigPdf();
  }
}

let empresaPrecoSelecionada = "FINORA";

function filtrarEmpresaTabelaPreco(empresa, btn) {
  empresaPrecoSelecionada = empresa;
  document.querySelectorAll("#filtrosEmpresaPreco button").forEach((b) => {
    b.classList.remove("filtro-ativo");
    b.classList.add("btn-mini-light");
  });
  btn.classList.add("filtro-ativo");
  btn.classList.remove("btn-mini-light");
  carregarTabelaPrecos();
}
window.filtrarEmpresaTabelaPreco = filtrarEmpresaTabelaPreco;

async function abrirModalTabelaPrecos() {
  abrirModal("modalTabelaPrecos");
  await carregarTabelaPrecos();
}

async function carregarTabelaPrecos() {
  const lista = document.getElementById("listaTabelaPrecos");

  lista.innerHTML = `<p style="color:#64748b;">Carregando produtos...</p>`;

  const res = await fetch("/api/regras-precificacao", {
    headers: authHeaders,
  });

  const regras = await res.json();

  if (!res.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar produtos.</p>`;
    return;
  }

  // Filter based on the selected company (including plano_ and mensalidade_ rules so the user can edit all)
  const itens = regras.filter((r) => (r.empresa || "FINORA") === empresaPrecoSelecionada);

  const cores = {
    FINORA: "#663399",
    CONTABIL: "#12c8c2",
    TECH: "#315cff",
    AUDITORIA: "#1e3a5f",
    LAGERHAUS: "#b45309",
  };
  const titulos = {
    FINORA: "FINORA Intelligence",
    CONTABIL: "Q-MAX Contábil",
    TECH: "Q-MAX Tech",
    AUDITORIA: "Q-MAX Auditoria",
    LAGERHAUS: "LAGERHAUS",
  };

  const cor = cores[empresaPrecoSelecionada] || "#663399";
  const titulo = titulos[empresaPrecoSelecionada] || empresaPrecoSelecionada;

  lista.innerHTML = `
    <div style="margin-bottom:26px;">
      <h3 style="color:${cor}; margin-bottom:12px;">Serviços cadastrados (${titulo})</h3>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:18px;">
        ${itens
          .map(
            (regra) => `
          <div style="border:1px solid #e2e8f0; border-radius:18px; padding:20px; background:#fff; position: relative;">
            <div style="display:flex; justify-content:space-between; gap:12px;">
              <div>
                <small style="color:#64748b;">Código: ${regra.codigo}</small>
                <input 
                  type="text" 
                  id="precoNome-${regra.id}" 
                  value="${escapeHTML(regra.nome || "")}" 
                  style="width:100%; margin-top:6px; font-weight:800;"
                />
              </div>

              <label style="display:flex; gap:6px; align-items:center; font-size:13px; font-weight:700;">
                <input 
                  type="checkbox" 
                  id="precoAtivo-${regra.id}" 
                  ${Number(regra.ativo) === 1 ? "checked" : ""}
                />
                Ativo
              </label>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px;">
              <div>
                <label style="font-size:12px; color:#64748b; font-weight:700;">Empresa</label>
                <select id="precoEmpresa-${regra.id}" style="width:100%; margin-top:6px;">
                  <option value="FINORA" ${(regra.empresa || "FINORA") === "FINORA" ? "selected" : ""}>FINORA</option>
                  <option value="CONTABIL" ${regra.empresa === "CONTABIL" ? "selected" : ""}>Q-MAX Contábil</option>
                  <option value="TECH" ${regra.empresa === "TECH" ? "selected" : ""}>Q-MAX Tech</option>
                  <option value="AUDITORIA" ${regra.empresa === "AUDITORIA" ? "selected" : ""}>Q-MAX Auditoria</option>
                  <option value="LAGERHAUS" ${regra.empresa === "LAGERHAUS" ? "selected" : ""}>LAGERHAUS</option>
                </select>
              </div>

              <div>
                <label style="font-size:12px; color:#64748b; font-weight:700;">Tipo</label>
                <select id="precoTipo-${regra.id}" style="width:100%; margin-top:6px;">
                  <option value="Mensal" ${regra.tipo === "Mensal" ? "selected" : ""}>Mensal</option>
                  <option value="Pontual" ${regra.tipo === "Pontual" ? "selected" : ""}>Pontual</option>
                </select>
              </div>
            </div>

            <div style="margin-top:14px;">
              <label style="font-size:12px; color:#64748b; font-weight:700;">Valor Base Padrão</label>
              <input 
                type="number" 
                id="precoValor-${regra.id}" 
                value="${Number(regra.valor_base || 0)}"
                step="0.01"
                style="width:100%; margin-top:6px;"
              />
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:12px; background:#f8fafc; padding:10px; border-radius:12px;">
              <div>
                <label style="font-size:11px; color:#475569; font-weight:700;">Valor PF (R$)</label>
                <input 
                  type="number" 
                  id="precoValorPf-${regra.id}" 
                  value="${regra.valor_base_pf !== null && regra.valor_base_pf !== undefined ? Number(regra.valor_base_pf) : ""}"
                  step="0.01"
                  placeholder="Padrão"
                  style="width:100%; margin-top:4px; font-size:12px;"
                />
              </div>
              <div>
                <label style="font-size:11px; color:#475569; font-weight:700;">Valor PJ (R$)</label>
                <input 
                  type="number" 
                  id="precoValorPj-${regra.id}" 
                  value="${regra.valor_base_pj !== null && regra.valor_base_pj !== undefined ? Number(regra.valor_base_pj) : ""}"
                  step="0.01"
                  placeholder="Padrão"
                  style="width:100%; margin-top:4px; font-size:12px;"
                />
              </div>
              <div>
                <label style="font-size:11px; color:#475569; font-weight:700;">Valor Híbrido (R$)</label>
                <input 
                  type="number" 
                  id="precoValorHibrido-${regra.id}" 
                  value="${regra.valor_base_hibrido !== null && regra.valor_base_hibrido !== undefined ? Number(regra.valor_base_hibrido) : ""}"
                  step="0.01"
                  placeholder="Padrão"
                  style="width:100%; margin-top:4px; font-size:12px;"
                />
              </div>
            </div>

            <div style="margin-top:14px;">
              <label style="font-size:12px; color:#64748b; font-weight:700;">Descrição comercial</label>
              <textarea 
                id="precoDescricao-${regra.id}"
                style="width:100%; margin-top:6px; min-height:80px;"
              >${escapeHTML(regra.descricao || "")}</textarea>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:18px;">
              <button 
                class="btn-mini" 
                style="width:100%; background:${cor};"
                onclick="salvarPreco(${regra.id})">
                Salvar
              </button>

              <button 
                class="btn-mini" 
                style="width:100%; background:#ef4444;"
                onclick="excluirServicoPreco(${Number(regra.id)}, document.getElementById('precoNome-${Number(regra.id)}').value)">
                Excluir
              </button>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
}

async function salvarPreco(id) {
  const nome = document.getElementById(`precoNome-${id}`).value;
  const tipo = document.getElementById(`precoTipo-${id}`).value;
  const valor = document.getElementById(`precoValor-${id}`).value;
  const valor_base_pf = document.getElementById(`precoValorPf-${id}`).value;
  const valor_base_pj = document.getElementById(`precoValorPj-${id}`).value;
  const valor_base_hibrido = document.getElementById(`precoValorHibrido-${id}`).value;
  const ativo = document.getElementById(`precoAtivo-${id}`).checked;
  const descricao = document.getElementById(`precoDescricao-${id}`).value;
  const empresa = document.getElementById(`precoEmpresa-${id}`).value;

  const res = await fetch(`/api/regras-precificacao/${id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      nome,
      tipo,
      valor_base: valor,
      valor_base_pf,
      valor_base_pj,
      valor_base_hibrido,
      ativo,
      descricao,
      empresa,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar produto.");
    return;
  }

  alert("Produto atualizado com sucesso.");
  await carregarTabelaPrecos();
}

async function excluirServicoPreco(id, nome) {
  const confirmar = confirm(
    `Tem certeza que deseja remover o serviço "${nome}"?\n\nEle será desativado e não aparecerá mais nas propostas novas.`,
  );

  if (!confirmar) return;

  const res = await fetch(`/api/regras-precificacao/${id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao remover serviço.");
    return;
  }

  alert(data.message || "Serviço removido.");
  await carregarTabelaPrecos();
}

function abrirNovoServicoPreco() {
  const form = document.getElementById("formNovoServicoPreco");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function salvarNovoServicoPreco() {
  const body = {
    codigo: document.getElementById("novoPrecoCodigo").value,
    nome: document.getElementById("novoPrecoNome").value,
    tipo: document.getElementById("novoPrecoTipo").value,
    valor_base: document.getElementById("novoPrecoValor").value,
    valor_base_pf: document.getElementById("novoPrecoValorPf")?.value,
    valor_base_pj: document.getElementById("novoPrecoValorPj")?.value,
    valor_base_hibrido: document.getElementById("novoPrecoValorHibrido")?.value,
    descricao: document.getElementById("novoPrecoDescricao").value,
    empresa: document.getElementById("novoPrecoEmpresa").value,
  };

  const res = await fetch("/api/regras-precificacao", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao criar serviço.");
    return;
  }

  alert(data.message || "Serviço criado.");

  document.getElementById("novoPrecoCodigo").value = "";
  document.getElementById("novoPrecoNome").value = "";
  document.getElementById("novoPrecoValor").value = "";
  if (document.getElementById("novoPrecoValorPf")) document.getElementById("novoPrecoValorPf").value = "";
  if (document.getElementById("novoPrecoValorPj")) document.getElementById("novoPrecoValorPj").value = "";
  if (document.getElementById("novoPrecoValorHibrido")) document.getElementById("novoPrecoValorHibrido").value = "";
  document.getElementById("novoPrecoDescricao").value = "";
  document.getElementById("novoPrecoEmpresa").value = "FINORA";
  document.getElementById("formNovoServicoPreco").style.display = "none";

  await carregarTabelaPrecos();
}

async function abrirModalRegrasPreco(regra) {
  regraPrecoSelecionada = regra;

  document.getElementById("nomeServicoRegra").innerText = regra.nome;

  const lista = document.getElementById("listaRegrasCalculo");
  lista.innerHTML = `<p style="color:#64748b;">Carregando regras...</p>`;

  abrirModal("modalRegrasPreco");

  const res = await fetch(`/api/regras-precificacao/${regra.id}/regras`, {
    headers: authHeaders,
  });

  const regras = await res.json();

  if (!res.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar regras.</p>`;
    return;
  }

  lista.innerHTML = regras
    .map(
      (r) => `
    <label style="display:block; padding:12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:10px;">
      <input 
        type="checkbox"
        ${Number(r.vinculado) === 1 ? "checked" : ""}
        onchange="alterarRegraCalculoServico(${regra.id}, ${r.id}, this.checked)"
      />
      <strong>${escapeHTML(r.nome)}</strong>
      <br>
      <small style="color:#64748b;">${escapeHTML(r.descricao || "-")}</small>
    </label>
  `,
    )
    .join("");
}

async function alterarRegraCalculoServico(servicoId, regraId, ativo) {
  const res = await fetch(
    `/api/regras-precificacao/${servicoId}/regras/${regraId}`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ ativo }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao atualizar regra.");
    return;
  }
}

function abrirFormNovaRegra() {
  const form = document.getElementById("formNovaRegra");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function salvarNovaRegraCalculo() {
  const body = {
    codigo: document.getElementById("novaRegraCodigo").value,
    nome: document.getElementById("novaRegraNome").value,
    descricao: document.getElementById("novaRegraDescricao").value,
    campo_base: document.getElementById("novaRegraCampoBase").value,
    operador: document.getElementById("novaRegraOperador").value,
    valor_comparacao: document.getElementById("novaRegraValorComparacao").value,
    fator: document.getElementById("novaRegraFator").value,
  };

  const res = await fetch("/api/regras-calculo", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao criar regra.");
    return;
  }

  alert(data.message || "Regra criada.");

  document.getElementById("novaRegraCodigo").value = "";
  document.getElementById("novaRegraNome").value = "";
  document.getElementById("novaRegraDescricao").value = "";
  document.getElementById("formNovaRegra").style.display = "none";

  if (regraPrecoSelecionada) {
    await abrirModalRegrasPreco(regraPrecoSelecionada);
  }
}

async function abrirModalRegrasGerais() {
  abrirModal("modalRegrasGerais");

  const lista = document.getElementById("listaRegrasGerais");
  lista.innerHTML = `<p style="color:#64748b;">Carregando regras...</p>`;

  const res = await fetch("/api/regras-precificacao", {
    headers: authHeaders,
  });

  servicosRegrasGerais = await res.json();

  if (!res.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar regras.</p>`;
    return;
  }

  lista.innerHTML = `
    <div style="display:grid; grid-template-columns:320px 1fr; gap:22px; height:70vh;">
      <div style="background:#f8fafc; border-radius:18px; padding:16px; overflow-y:auto;">
        <h4 style="margin:0 0 14px 0;">Serviços</h4>

        ${servicosRegrasGerais
          .map(
            (servico, index) => `
          <button
            type="button"
            class="servico-regra-btn ${index === 0 ? "ativo" : ""}"
            onclick="selecionarServicoRegra(${servico.id}, this)"
          >
            <strong>${servico.nome}</strong>
            <small>${servico.categoria || "Serviço"} • ${servico.tipo}</small>
          </button>
        `,
          )
          .join("")}
      </div>

      <div id="painelServicoRegra" style="overflow-y:auto;"></div>
    </div>
  `;

  if (servicosRegrasGerais.length) {
    renderizarPainelServicoRegra(servicosRegrasGerais[0].id);
  }
}

async function salvarConfiguracaoCalculo(id, nome, tipo, valorBase, ativo) {
  const categoria = document.getElementById(`regraCategoria-${id}`).value;
  const modo_calculo = document.getElementById(`regraModo-${id}`).value;
  const campo_quantidade = document.getElementById(`regraCampo-${id}`).value;

  const res = await fetch(`/api/regras-precificacao/${id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      nome,
      tipo,
      valor_base: valorBase,
      ativo,
      categoria,
      modo_calculo,
      campo_quantidade,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar configuração.");
    return;
  }

  alert("Configuração salva com sucesso.");
}

function selecionarServicoRegra(servicoId, botao) {
  document.querySelectorAll(".servico-regra-btn").forEach((btn) => {
    btn.classList.remove("ativo");
  });

  botao.classList.add("ativo");
  renderizarPainelServicoRegra(servicoId);
}

async function renderizarPainelServicoRegra(servicoId) {
  const servico = servicosRegrasGerais.find(
    (s) => Number(s.id) === Number(servicoId),
  );
  const painel = document.getElementById("painelServicoRegra");

  if (!servico || !painel) return;

  painel.innerHTML = `
    <div style="background:#0f172a; color:white; border-radius:18px; padding:22px; margin-bottom:18px;">
      <h3 style="margin:0;">${servico.nome}</h3>
      <p style="margin:6px 0 0 0; color:#cbd5e1;">Código: ${servico.codigo}</p>
    </div>

    <div style="background:white; border:1px solid #e2e8f0; border-radius:18px; padding:20px;">
      <h4 style="margin-top:0;">Configuração de cálculo</h4>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px;">
        <div>
          <label style="font-size:12px; color:#64748b; font-weight:700;">Categoria</label>
          <select id="painelCategoria-${servico.id}" style="width:100%; margin-top:5px;">
            <option value="Servico" ${servico.categoria === "Servico" ? "selected" : ""}>Serviço</option>
            <option value="Base Auxiliar" ${servico.categoria === "Base Auxiliar" ? "selected" : ""}>Base Auxiliar</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; color:#64748b; font-weight:700;">Modo cálculo</label>
          <select id="painelModo-${servico.id}" style="width:100%; margin-top:5px;">
            <option value="fixo" ${servico.modo_calculo === "fixo" ? "selected" : ""}>Fixo</option>
            <option value="por_quantidade" ${servico.modo_calculo === "por_quantidade" ? "selected" : ""}>Por quantidade</option>
          </select>
        </div>

        <div>
          <label style="font-size:12px; color:#64748b; font-weight:700;">Campo quantidade</label>
          <select id="painelCampo-${servico.id}" style="width:100%; margin-top:5px;">
            <option value="" ${!servico.campo_quantidade ? "selected" : ""}>Nenhum</option>
            <option value="socios" ${servico.campo_quantidade === "socios" ? "selected" : ""}>Sócios</option>
            <option value="funcionarios" ${servico.campo_quantidade === "funcionarios" ? "selected" : ""}>Funcionários</option>
            <option value="cadeiras" ${servico.campo_quantidade === "cadeiras" ? "selected" : ""}>Cadeiras</option>
            <option value="metragem" ${servico.campo_quantidade === "metragem" ? "selected" : ""}>Metragem</option>
            <option value="distanciaKm" ${servico.campo_quantidade === "distanciaKm" ? "selected" : ""}>Distância KM</option>
          </select>
        </div>
      </div>

      <button 
        class="btn-primary" 
        style="margin-top:18px;"
        onclick="salvarConfiguracaoPainel(${servico.id})">
        Salvar configuração
      </button>
    </div>

    <div style="background:white; border:1px solid #e2e8f0; border-radius:18px; padding:20px; margin-top:18px;">
      <h4 style="margin-top:0;">Regras aplicadas</h4>
      <div id="listaRegrasServicoPainel">
        Carregando regras...
      </div>
    </div>
  `;

  await carregarRegrasDoServicoPainel(servico.id);
}

async function carregarRegrasDoServicoPainel(servicoId) {
  const lista = document.getElementById("listaRegrasServicoPainel");

  const res = await fetch(`/api/regras-precificacao/${servicoId}/regras`, {
    headers: authHeaders,
  });

  const regras = await res.json();

  if (!res.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar regras.</p>`;
    return;
  }

  lista.innerHTML = regras
    .map(
      (r) => `
    <label style="display:block; padding:12px; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:10px;">
      <input 
        type="checkbox"
        ${Number(r.vinculado) === 1 ? "checked" : ""}
        onchange="alterarRegraCalculoServico(${servicoId}, ${r.id}, this.checked)"
      />
      <strong>${escapeHTML(r.nome)}</strong>
      <br>
      <small style="color:#64748b;">${escapeHTML(r.descricao || "-")}</small>
    </label>
  `,
    )
    .join("");
}

async function salvarConfiguracaoPainel(id) {
  const servico = servicosRegrasGerais.find((s) => Number(s.id) === Number(id));
  if (!servico) return;

  const categoria = document.getElementById(`painelCategoria-${id}`).value;
  const modo_calculo = document.getElementById(`painelModo-${id}`).value;
  const campo_quantidade = document.getElementById(`painelCampo-${id}`).value;

  const res = await fetch(`/api/regras-precificacao/${id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      nome: servico.nome,
      tipo: servico.tipo,
      valor_base: servico.valor_base,
      ativo: Number(servico.ativo) === 1,
      categoria,
      modo_calculo,
      campo_quantidade,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar configuração.");
    return;
  }

  servico.categoria = categoria;
  servico.modo_calculo = modo_calculo;
  servico.campo_quantidade = campo_quantidade;

  alert("Configuração salva com sucesso.");
}

function abrirModalPlanosTech() {
  abrirModal("modalPlanosTech");
  carregarPlanosTech();
}

async function carregarPlanosTech() {
  const lista = document.getElementById("listaPlanosTech");
  lista.innerHTML = `<p style="color:#64748b;">Carregando planos...</p>`;

  const res = await fetch("/api/tech-planos", {
    headers: authHeaders,
  });

  PLANOS_TECH_DASH = await res.json();

  if (!res.ok) {
    lista.innerHTML = `<p style="color:#ef4444;">Erro ao carregar planos Tech.</p>`;
    return;
  }

  lista.innerHTML = `
  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:18px;">
    ${PLANOS_TECH_DASH.map(
      (plano) => `
      <div style="border:1px solid #e2e8f0; border-radius:18px; padding:20px; background:#fff;">
        <small style="color:#64748b;">Código</small>
        <input id="techCodigo-${plano.id}" value="${plano.codigo}" style="width:100%; margin-bottom:10px;" />

        <small style="color:#64748b;">Nome</small>
        <input id="techNome-${plano.id}" value="${plano.nome}" style="width:100%; margin-bottom:10px;" />

        <small style="color:#64748b;">Implantação</small>
        <input type="number" id="techImplantacao-${plano.id}" value="${plano.valor_implantacao}" style="width:100%; margin-bottom:10px;" />

        <small style="color:#64748b;">Mensalidade</small>
        <input type="number" id="techMensalidade-${plano.id}" value="${plano.valor_mensalidade}" style="width:100%; margin-bottom:10px;" />

        <small style="color:#64748b;">Serviços inclusos</small>
        <textarea id="techServicos-${plano.id}" style="width:100%; min-height:120px;">${(plano.servicos || []).join("\n")}</textarea>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px;">
          <button class="btn-mini" onclick="salvarPlanoTech(${plano.id})">Salvar</button>
          <button class="btn-mini" style="background:#ef4444;" onclick="excluirPlanoTech(${plano.id}, '${plano.nome.replace(/'/g, "\\'")}')">Excluir</button>
        </div>
      </div>
    `,
    ).join("")}
  </div>
`;
}

function abrirNovoPlanoTech() {
  const form = document.getElementById("formNovoPlanoTech");

  form.style.display = form.style.display === "none" ? "block" : "none";
}

async function salvarPlanoTech(id) {
  const servicos = document
    .getElementById(`techServicos-${id}`)
    .value.split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);

  const body = {
    codigo: document.getElementById(`techCodigo-${id}`).value,
    nome: document.getElementById(`techNome-${id}`).value,
    valor_implantacao: document.getElementById(`techImplantacao-${id}`).value,
    valor_mensalidade: document.getElementById(`techMensalidade-${id}`).value,
    servicos,
  };

  const res = await fetch(`/api/tech-planos/${id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao salvar plano Tech.");
    return;
  }

  alert(data.message || "Plano Tech atualizado.");
  await carregarPlanosTech();
}

async function excluirPlanoTech(id, nome) {
  const confirmar = confirm(
    `Tem certeza que deseja remover o plano "${nome}"?\n\nEle será desativado e não aparecerá em propostas novas.`,
  );

  if (!confirmar) return;

  const res = await fetch(`/api/tech-planos/${id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao excluir plano Tech.");
    return;
  }

  alert(data.message || "Plano Tech removido.");
  await carregarPlanosTech();
}

async function salvarNovoPlanoTech() {
  const servicosTexto =
    document.getElementById("novoPlanoServicos")?.value || "";
  const servicos = servicosTexto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);

  const body = {
    codigo: document.getElementById("novoPlanoCodigo").value,
    nome: document.getElementById("novoPlanoNome").value,
    valor_implantacao: document.getElementById("novoPlanoImplantacao").value,
    valor_mensalidade: document.getElementById("novoPlanoMensalidade").value,
    servicos,
  };

  const res = await fetch("/api/tech-planos", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Erro ao criar plano Tech.");
    return;
  }

  alert(data.message || "Plano Tech criado.");

  document.getElementById("novoPlanoCodigo").value = "";
  document.getElementById("novoPlanoNome").value = "";
  document.getElementById("novoPlanoImplantacao").value = "";
  document.getElementById("novoPlanoMensalidade").value = "";

  const campoServicos = document.getElementById("novoPlanoServicos");
  if (campoServicos) campoServicos.value = "";

  document.getElementById("formNovoPlanoTech").style.display = "none";

  await carregarPlanosTech();
}

function trocarAbaD4Sign(abaId, btnElement) {
  document.querySelectorAll(".d4-tab-content").forEach((el) => (el.style.display = "none"));
  document.querySelectorAll(".d4-tab-btn").forEach((btn) => {
    btn.style.background = "transparent";
    btn.style.color = "#94a3b8";
    btn.classList.remove("active");
  });

  const activeContent = document.getElementById(abaId);
  if (activeContent) activeContent.style.display = "block";

  if (btnElement) {
    btnElement.style.background = "#2563eb";
    btnElement.style.color = "#fff";
    btnElement.classList.add("active");
  }
}

// Contratada por marca (aba 5 do modal D4Sign): edições ficam aqui até salvar; chave contratada_<marca> em JSON
const CAMPOS_CONTRATADA = ["razao_social", "cnpj", "endereco", "qualificacao", "representante"];
let CONTRATADAS_EDICAO = {};
let MARCA_CONTRATADA_ATUAL = "finora";

function guardarCamposContratada() {
  CONTRATADAS_EDICAO[MARCA_CONTRATADA_ATUAL] = Object.fromEntries(
    CAMPOS_CONTRATADA.map((c) => [c, (document.getElementById(`contratada_${c}`)?.value || "").trim()])
  );
}

// carregando = true ao abrir o modal: não guarda o que sobrou nos campos da abertura anterior
function trocarMarcaContratada(marca, carregando = false) {
  if (!carregando) guardarCamposContratada();
  MARCA_CONTRATADA_ATUAL = marca;
  const dados = CONTRATADAS_EDICAO[marca] || {};
  CAMPOS_CONTRATADA.forEach((c) => {
    const el = document.getElementById(`contratada_${c}`);
    if (el) el.value = dados[c] || "";
  });
}

async function abrirModalD4Sign() {
  abrirModal("modalConfigD4Sign");

  // Resetar mensagens de teste
  const resDiv = document.getElementById("d4signResultadoTeste");
  if (resDiv) {
    resDiv.style.display = "none";
    resDiv.innerHTML = "";
  }

  // Buscar configurações atuais do backend
  try {
    const res = await fetch("/api/config/sistema", { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();

      // Aba 5: Contratada por marca
      CONTRATADAS_EDICAO = {};
      ["finora", "contabil", "tech", "auditoria", "lagerhaus"].forEach((m) => {
        try {
          const v = data[`contratada_${m}`];
          CONTRATADAS_EDICAO[m] = v ? (typeof v === "string" ? JSON.parse(v) : v) : {};
        } catch (e) {
          CONTRATADAS_EDICAO[m] = {};
        }
      });
      MARCA_CONTRATADA_ATUAL = "finora";
      const selMarca = document.getElementById("configContratadaMarca");
      if (selMarca) selMarca.value = "finora";
      trocarMarcaContratada("finora", true);

      // Aba 1: Conexão & API
      if (document.getElementById("configD4Ambiente"))
        document.getElementById("configD4Ambiente").value = data.d4sign_ambiente || "sandbox";
      if (document.getElementById("configD4Token"))
        document.getElementById("configD4Token").value = data.d4sign_token || "";
      if (document.getElementById("configD4Secret"))
        document.getElementById("configD4Secret").value = data.d4sign_secret || "";
      if (document.getElementById("configD4Cofre"))
        document.getElementById("configD4Cofre").value = data.d4sign_cofre || "";

      // Aba 2: Fluxo & Prazos
      if (document.getElementById("configFluxoD4Sign"))
        document.getElementById("configFluxoD4Sign").value = data.d4sign_fluxo || data.fluxo_d4sign || "ordenado";
      if (document.getElementById("configD4Expiracao"))
        document.getElementById("configD4Expiracao").value = data.d4sign_expiracao_dias || "30";
      if (document.getElementById("configD4Lembrete"))
        document.getElementById("configD4Lembrete").value = data.d4sign_lembrete_dias || "0";

      // Aba 3: Autenticação & Compliance
      if (document.getElementById("configD4ExigirSms"))
        document.getElementById("configD4ExigirSms").checked = data.d4sign_exigir_sms === "1";
      if (document.getElementById("configD4ExigirWhatsapp"))
        document.getElementById("configD4ExigirWhatsapp").checked = data.d4sign_exigir_whatsapp === "1";
      if (document.getElementById("configD4ExigirSelfie"))
        document.getElementById("configD4ExigirSelfie").checked = data.d4sign_exigir_selfie === "1";
      if (document.getElementById("configD4ExigirDocFoto"))
        document.getElementById("configD4ExigirDocFoto").checked = data.d4sign_exigir_doc_foto === "1";
      if (document.getElementById("configD4ExigirIcp"))
        document.getElementById("configD4ExigirIcp").checked = data.d4sign_exigir_icp === "1";

      // Aba 4: Mensagens & Envio
      if (document.getElementById("configD4Mensagem"))
        document.getElementById("configD4Mensagem").value =
          data.d4sign_mensagem_personalizada ||
          "Por favor, realize a assinatura eletrônica do contrato de prestação de serviços contábeis com a Finora.";
      if (document.getElementById("configD4NomeRep"))
        document.getElementById("configD4NomeRep").value = data.d4sign_nome_representante || "Representante Q-MAX / Finora";
      if (document.getElementById("configD4EmailRep"))
        document.getElementById("configD4EmailRep").value = data.d4sign_email_representante || "contato@grupoqmax.com.br";
      if (document.getElementById("configD4UrlRetorno"))
        document.getElementById("configD4UrlRetorno").value = data.d4sign_url_retorno || "/proposta/sucesso.html";
    }
  } catch (err) {
    console.error("Erro ao carregar configurações do D4Sign:", err);
  }
}

async function salvarConfigD4Sign() {
  guardarCamposContratada();
  const contratadas = Object.fromEntries(
    Object.entries(CONTRATADAS_EDICAO).map(([m, dados]) => [`contratada_${m}`, JSON.stringify(dados || {})])
  );
  const payload = {
    ...contratadas,
    // Conexão
    d4sign_ambiente: document.getElementById("configD4Ambiente")?.value || "sandbox",
    d4sign_token: document.getElementById("configD4Token")?.value?.trim() || "",
    d4sign_secret: document.getElementById("configD4Secret")?.value?.trim() || "",
    d4sign_cofre: document.getElementById("configD4Cofre")?.value?.trim() || "",

    // Fluxo & Prazos
    d4sign_fluxo: document.getElementById("configFluxoD4Sign")?.value || "ordenado",
    fluxo_d4sign: document.getElementById("configFluxoD4Sign")?.value || "ordenado", // Retrocompatibilidade
    d4sign_expiracao_dias: document.getElementById("configD4Expiracao")?.value || "30",
    d4sign_lembrete_dias: document.getElementById("configD4Lembrete")?.value || "0",

    // Segurança & Compliance
    d4sign_exigir_sms: document.getElementById("configD4ExigirSms")?.checked ? "1" : "0",
    d4sign_exigir_whatsapp: document.getElementById("configD4ExigirWhatsapp")?.checked ? "1" : "0",
    d4sign_exigir_selfie: document.getElementById("configD4ExigirSelfie")?.checked ? "1" : "0",
    d4sign_exigir_doc_foto: document.getElementById("configD4ExigirDocFoto")?.checked ? "1" : "0",
    d4sign_exigir_icp: document.getElementById("configD4ExigirIcp")?.checked ? "1" : "0",

    // Mensagens & Representante
    d4sign_mensagem_personalizada: document.getElementById("configD4Mensagem")?.value?.trim() || "",
    d4sign_nome_representante: document.getElementById("configD4NomeRep")?.value?.trim() || "",
    d4sign_email_representante: document.getElementById("configD4EmailRep")?.value?.trim() || "",
    // D4Sign redireciona a partir do domínio dela: caminho relativo virava d4sign.com.br/proposta/sucesso.html
    d4sign_url_retorno: new URL(document.getElementById("configD4UrlRetorno")?.value?.trim() || "/proposta/sucesso.html", window.location.origin).href,
  };

  try {
    const res = await fetch("/api/config/sistema", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok) {
      alert("Configurações da D4Sign salvas com sucesso!");
      fecharModal("modalConfigD4Sign");
    } else {
      alert(data.error || "Erro ao salvar configurações.");
    }
  } catch (err) {
    console.error("Erro ao salvar configurações do D4Sign:", err);
    alert("Erro ao conectar com o servidor para salvar configurações.");
  }
}

async function testarConexaoD4SignUI() {
  const btn = document.getElementById("btnTestarD4Sign");
  const resDiv = document.getElementById("d4signResultadoTeste");
  const badge = document.getElementById("d4signStatusBadge");

  const originalText = btn.innerHTML;
  btn.innerHTML = "Testando...";
  btn.disabled = true;

  const payload = {
    ambiente: document.getElementById("configD4Ambiente")?.value || "sandbox",
    token: document.getElementById("configD4Token")?.value?.trim() || "",
    secret: document.getElementById("configD4Secret")?.value?.trim() || "",
    cofre: document.getElementById("configD4Cofre")?.value?.trim() || "",
  };

  try {
    const res = await fetch("/api/d4sign/testar-conexao", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    resDiv.style.display = "block";

    if (res.ok && data.success) {
      if (badge) {
        badge.style.background = "rgba(16, 185, 129, 0.2)";
        badge.style.color = "#10b981";
        badge.innerText = `● Conectado (${data.ambiente.toUpperCase()})`;
      }

      resDiv.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 12px; border-radius: 8px;">
          <strong>Conexão Bem-Sucedida!</strong><br>
          • Ambiente: ${data.ambiente === "sandbox" ? "Sandbox / Homologação" : "Produção Oficial"}<br>
          • Total de Cofres Localizados na Conta: ${data.totalCofres}<br>
          • Cofre Padrão: ${escapeHTML(data.cofreConfigurado)}
        </div>
      `;
    } else {
      if (badge) {
        badge.style.background = "rgba(239, 68, 68, 0.2)";
        badge.style.color = "#ef4444";
        badge.innerText = `● Erro de Conexão`;
      }

      resDiv.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 12px; border-radius: 8px;">
          <strong>Falha na Validação das Credenciais:</strong><br>
          ${escapeHTML(data.erro || "Verifique se o token e o cryptKey estão corretos para o ambiente selecionado.")}
        </div>
      `;
    }
  } catch (err) {
    resDiv.style.display = "block";
    resDiv.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 12px; border-radius: 8px;">
        <strong>Erro de Comunicação:</strong> ${escapeHTML(err.message)}
      </div>
    `;
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// === ESTABILIDADE & MONITORAMENTO DO SISTEMA ===
function abrirModalStatusSistema() {
  abrirModal("modalStatusSistema");
  carregarHealthCheck();
  carregarLogsSistema();
}

async function carregarHealthCheck() {
  try {
    const res = await fetch("/api/admin/health-check", { headers: authHeaders });
    if (!res.ok) return;
    const data = await res.json();

    // DB
    const dbStatusEl = document.getElementById("healthDbStatus");
    const dbDetEl = document.getElementById("healthDbDetails");
    if (dbStatusEl) {
      dbStatusEl.innerText = data.database.status === "ok" ? "Operacional" : "Falha";
      dbStatusEl.style.color = data.database.status === "ok" ? "#10b981" : "#ef4444";
    }
    if (dbDetEl) {
      dbDetEl.innerText = `Ping: ${data.database.latencyMs}ms | ${data.database.totalPropostas} propostas`;
    }

    // Email
    const emailStatusEl = document.getElementById("healthEmailStatus");
    const emailDetEl = document.getElementById("healthEmailDetails");
    if (emailStatusEl) {
      emailStatusEl.innerText = "Conectado";
    }
    if (emailDetEl) {
      emailDetEl.innerText = `${data.emailService.method} (${data.emailService.account})`;
    }

    // D4Sign
    const d4StatusEl = document.getElementById("healthD4Status");
    const d4DetEl = document.getElementById("healthD4Details");
    if (d4StatusEl) {
      d4StatusEl.innerText = data.d4sign.status === "ok" ? "Ativo" : (data.d4sign.status === "warning" ? "Alerta" : "Erro");
      d4StatusEl.style.color = data.d4sign.status === "ok" ? "#10b981" : (data.d4sign.status === "warning" ? "#f59e0b" : "#ef4444");
    }
    if (d4DetEl) {
      d4DetEl.innerText = data.d4sign.message || `Cofre: ${data.d4sign.vault}`;
    }

    // Server
    const serverStatusEl = document.getElementById("healthServerStatus");
    const serverDetEl = document.getElementById("healthServerDetails");
    if (serverStatusEl) {
      serverStatusEl.innerText = `${data.uptimeFormatted}`;
    }
    if (serverDetEl) {
      serverDetEl.innerText = `RAM: ${data.memoryRamMb} MB | SSE Online: ${data.realtimeClients}`;
    }
  } catch (err) {
    console.error("Erro ao carregar Health Check:", err);
  }
}

async function carregarLogsSistema() {
  const terminal = document.getElementById("containerLogsTerminal");
  if (!terminal) return;
  const level = document.getElementById("selectFiltroLevelLog")?.value || "todos";

  try {
    const res = await fetch(`/api/admin/logs?level=${encodeURIComponent(level)}`, { headers: authHeaders });
    if (!res.ok) return;
    const logs = await res.json();

    if (!Array.isArray(logs) || logs.length === 0) {
      terminal.innerHTML = `<div style="color: #64748b; text-align: center; padding: 20px;">Nenhum log registrado para este filtro.</div>`;
      return;
    }

    terminal.innerHTML = logs.map((l) => {
      let cor = "#cbd5e1";
      let badge = "";
      if (l.level === "error") { cor = "#f87171"; badge = ""; }
      else if (l.level === "warn") { cor = "#fbbf24"; badge = ""; }
      else if (l.level === "success") { cor = "#34d399"; badge = ""; }

      const hora = new Date(l.timestamp).toLocaleTimeString();
      return `<div style="margin-bottom: 6px; color: ${cor}; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 4px;">
        <span style="color: #64748b;">[${hora}]</span> 
        <span style="font-weight: bold; color: #94a3b8;">[${escapeHTML(l.component)}]</span> 
        ${badge} ${escapeHTML(l.message)}
        ${l.details ? `<div style="color: #475569; font-size: 11px; margin-left: 20px;">${escapeHTML(l.details)}</div>` : ""}
      </div>`;
    }).join("");
  } catch (err) {
    terminal.innerHTML = `<div style="color: #ef4444;">Erro ao buscar logs do servidor.</div>`;
  }
}

async function limparLogsSistema() {
  if (!confirm("Deseja realmente limpar todos os logs registrados no sistema?")) return;
  try {
    await fetch("/api/admin/logs", { method: "DELETE", headers: authHeaders });
    carregarLogsSistema();
  } catch (err) {
    alert("Erro ao limpar logs.");
  }
}

