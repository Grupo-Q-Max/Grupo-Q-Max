// Lógica Principal do CRM Kanban de Leads
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

let leads = [];
let vendedores = [];
let crmEtapas = [];
let leadSelecionado = null;
let sseSource = null;
let currentFunilId = localStorage.getItem('finora_funil_id') || 1;
let funis = [];

// Inicialização na carga da página
document.addEventListener("DOMContentLoaded", () => {
  // Exibir nome do usuário logado
  const nomeUserDiv = document.getElementById("nomeUser");
  if (nomeUserDiv) {
    nomeUserDiv.innerText = `${localStorage.getItem("finora_nome")} (${localStorage.getItem("finora_role")})`;
  }

  // Carregar dados
  carregarFunis().then(() => {
    carregarVendedores().then(() => {
      carregarEtapasCRM().then(() => {
        carregarLeads();
      });
    });
  });

  // Conectar SSE Stream
  conectarSSE();

  // Exibir botão de configuração do CRM apenas para Diretores/Sócios
  if (localStorage.getItem("finora_role") === "Diretor") {
    const togglesContainer = document.getElementById("btnToggleMetrics")?.parentElement;
    if (togglesContainer) {
      const configButton = document.createElement("button");
      configButton.id = "btnCrmConfig";
      configButton.className = "btn-secondary";
      configButton.innerHTML = "Configurações CRM";
      configButton.onclick = () => {
        window.location.href = "crm-config.html";
      };
      configButton.style.borderRadius = "12px";
      configButton.style.fontSize = "13px";
      configButton.style.fontWeight = "700";
      configButton.style.display = "flex";
      configButton.style.alignItems = "center";
      configButton.style.gap = "6px";
      configButton.style.height = "38px";
      configButton.style.padding = "0 16px";
      configButton.style.marginRight = "10px";
      configButton.style.cursor = "pointer";
      togglesContainer.insertBefore(configButton, document.getElementById("btnToggleMetrics"));
    }
  }
});

// --- API CALL HELPERS ---
async function fetchAuth(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  // Só 401 é sessão inválida; 403 é falta de permissão (botão de Diretor, lead de colega) e não pode deslogar
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = "/proposta/login.html";
    throw new Error("Sessão expirada");
  }
  return response;
}

// --- CARREGAR VENDEDORES (PARA FILTROS E CADASTROS) ---
async function carregarVendedores() {
  try {
    const res = await fetchAuth("/api/usuarios/vendedores");
    if (!res.ok) throw new Error("Erro ao carregar vendedores");

    vendedores = await res.json();

    // Popular filtro
    const filterSelect = document.getElementById("vendedorFilter");
    const modalSelect = document.getElementById("leadVendedor");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">Todos os Responsáveis</option>` +
        vendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nome)} (${escapeHTML(v.role)})</option>`).join("");
    }

    if (modalSelect) {
      modalSelect.innerHTML = `<option value="">Selecione um vendedor</option>` +
        vendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nome)}</option>`).join("");
    }
  } catch (error) {
    console.error("Erro em carregarVendedores:", error);
    mostrarToast("Erro ao buscar usuários do sistema.", "error");
  }
}

// --- CARREGAR ETAPAS CRM ---
async function carregarEtapasCRM() {
  try {
    const res = await fetchAuth(`/api/crm/etapas?funil_id=${currentFunilId}`);
    if (!res.ok) throw new Error("Erro ao buscar etapas");
    crmEtapas = await res.json();
    
    // Atualizar selects de status comercial nos modais do lead
    const selectsStatus = [document.getElementById("leadStatus"), document.getElementById("detStatus")];
    selectsStatus.forEach(sel => {
      if (sel) {
        sel.innerHTML = crmEtapas.map(e => `<option value="${escapeHTML(e.nome)}">${escapeHTML(e.nome)}</option>`).join("");
      }
    });
  } catch (error) {
    console.error("Erro em carregarEtapasCRM:", error);
    mostrarToast("Erro ao carregar etapas do CRM.", "error");
  }
}

// --- CARREGAR LEADS ---
async function carregarLeads() {
  try {
    const res = await fetchAuth(`/api/leads?funil_id=${currentFunilId}`);
    if (!res.ok) throw new Error("Erro ao buscar leads");

    leads = await res.json();
    renderizarKanban();
    renderizarClientesGanhos();
    carregarEstatisticas();
  } catch (error) {
    console.error("Erro ao carregar leads:", error);
    mostrarToast("Erro ao buscar leads do servidor.", "error");
  }
}

// --- CARREGAR E SELECIONAR FUNIS ---
async function carregarFunis() {
  try {
    const res = await fetchAuth("/api/crm/funis");
    if (!res.ok) throw new Error("Erro ao buscar funis");
    const data = await res.json();
    funis = data.funis;
    
    const selector = document.getElementById("funilSelector");
    if (selector) {
      selector.innerHTML = funis.map(f => `<option value="${escapeHTML(f.id)}">${escapeHTML(f.nome)}</option>`).join("");
      selector.value = currentFunilId;
    }

    // Renderizar Pílulas Rápidas de Seleção de Funil / Pipeline
    const quickPills = document.getElementById("pipelineQuickPills");
    if (quickPills) {
      quickPills.innerHTML = funis.map(f => {
        const isSelected = Number(f.id) === Number(currentFunilId);
        const isPropostas = Number(f.id) === 3 || f.nome.toLowerCase().includes("proposta");
        const icon = isPropostas ? "⚡" : "📊";
        const badgeStyle = isSelected
          ? "background: #0f172a; color: #38bdf8; border-color: #38bdf8; font-weight: 700; box-shadow: 0 4px 12px rgba(15,23,42,0.18);"
          : "background: white; color: #475569; border-color: #cbd5e1; font-weight: 600;";
        
        return `
          <button type="button" onclick="alterarFunil(${Number(f.id)})" class="pipeline-pill-btn" style="${badgeStyle} padding: 6px 14px; border-radius: 10px; font-size: 12px; border: 1.5px solid; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
            <span>${icon}</span>
            <span>${escapeHTML(f.nome)}</span>
            ${isPropostas ? `<span style="font-size: 10px; background: rgba(56,189,248,0.2); color: ${isSelected ? '#38bdf8' : '#0284c7'}; padding: 1px 6px; border-radius: 999px; font-weight: 800;">PROPOSTAS</span>` : ""}
          </button>
        `;
      }).join("");
    }
  } catch (error) {
    console.error("Erro em carregarFunis:", error);
  }
}

async function alterarFunil(funil_id) {
  currentFunilId = funil_id;
  localStorage.setItem('finora_funil_id', funil_id);
  const selector = document.getElementById("funilSelector");
  if (selector) selector.value = funil_id;
  await carregarFunis();
  await carregarEtapasCRM();
  await carregarLeads();
}


// Helper para gerar avatares coloridos dinamicamente baseados no nome do vendedor
function gerarAvatarHTML(nome) {
  if (!nome || nome === "Sem responsável" || nome === "Ninguém") {
    return `<div style="width:24px; height:24px; border-radius:50%; background:#cbd5e1; color:#475569; display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:700;" title="Sem responsável">?</div>`;
  }
  
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const iniciais = nome.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  
  return `<div style="width:24px; height:24px; border-radius:50%; background:hsl(${hue}, 60%, 42%); color:white; display:flex; align-items:center; justify-content:center; font-size:9.5px; font-weight:700; box-shadow:0 2px 4px rgba(0,0,0,0.12);" title="Responsável: ${escapeHTML(nome)}">${escapeHTML(iniciais)}</div>`;
}

// Helper para formatar faturamento de forma curta (ex: R$ 50k)
function formatarFaturamentoCurto(valor) {
  if (!valor) return "";
  const num = Number(valor);
  if (num >= 1000000) {
    return `R$ ${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `R$ ${(num / 1000).toFixed(0)}k`;
  }
  return `R$ ${num}`;
}

// --- FILTRAR E RENDERIZAR O KANBAN ---
function renderizarKanban() {
  const searchTerm = document.getElementById("searchFilter").value.toLowerCase();
  const vendedorIdFilter = document.getElementById("vendedorFilter").value;
  const origemFilter = document.getElementById("origemFilter").value;

  // Filtragem dos leads
  const leadsFiltrados = leads.filter(lead => {
    const matchSearch =
      lead.nome_cliente.toLowerCase().includes(searchTerm) ||
      (lead.nome_clinica && lead.nome_clinica.toLowerCase().includes(searchTerm));

    const matchVendedor = !vendedorIdFilter || Number(lead.vendedor_id) === Number(vendedorIdFilter);
    const matchOrigem = !origemFilter || lead.origem === origemFilter;

    return matchSearch && matchVendedor && matchOrigem;
  });

  // Agrupamento dinâmico baseado em crmEtapas
  const colunas = {};
  crmEtapas.forEach(etapa => {
    colunas[etapa.nome] = [];
  });

  leadsFiltrados.forEach(lead => {
    if (colunas[lead.status] !== undefined) {
      colunas[lead.status].push(lead);
    } else if (crmEtapas.length > 0) {
      colunas[crmEtapas[0].nome].push(lead);
    }
  });

  // Renderizar o container do Kanban Board dinamicamente
  const kanbanBoard = document.getElementById("kanbanBoard");
  if (!kanbanBoard) return;

  kanbanBoard.innerHTML = crmEtapas.map(etapa => {
    const listLeads = colunas[etapa.nome] || [];
    const statusId = etapa.nome;
    const cor = etapa.cor || "#94a3b8";
    const valorTotalEtapa = listLeads.reduce((acc, l) => acc + Number(l.valor_estimado || l.proposta_valor_total || 0), 0);

    return `
      <div class="kanban-column" data-status="${escapeHTML(statusId)}" ondragover="allowDrop(event)" ondragleave="dragLeave(event)" ondrop="dropLead(event)">
        <div class="kanban-column-header">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span class="kanban-column-title" style="display:flex; align-items:center; gap:8px;">
              <span class="kanban-column-title-dot" style="background:${escapeHTML(cor)}; box-shadow: 0 0 8px ${escapeHTML(cor)};"></span>
              <span style="font-weight:700;">${escapeHTML(etapa.nome)}</span>
              <span class="edit-col-cog" onclick="abrirModalEditarColuna(${Number(etapa.id)})" style="cursor:pointer; font-size:11px; opacity:0.5; margin-left:4px;" title="Editar coluna"></span>
            </span>
            <span style="font-size:11px; font-weight:700; color:#64748b; margin-left:14px;">${moeda.format(valorTotalEtapa)}</span>
          </div>
          <span class="kanban-column-count">${listLeads.length}</span>
        </div>
        <div class="kanban-cards-container" id="container-${escapeHTML(statusId.replace(/\s+/g, '-'))}">
          ${listLeads.map(lead => {
            const tagClass = getTagClass(lead.origem);
            const respNome = lead.vendedor_nome || lead.vendedor_name || "Sem responsável";
            const totalComents = lead.total_comentarios || 0;
            const fatCurto = formatarFaturamentoCurto(lead.faturamento);
            
            let infoBadgeContent = "";
            if (lead.marca === "lagerhaus") {
              const area = lead.area_m2 ? `${lead.area_m2}m² ` : "";
              const posicoes = lead.posicoes_coworking ? `${lead.posicoes_coworking} ` : "";
              infoBadgeContent = [area, posicoes].filter(Boolean).join(" | ");
            } else if (lead.marca === "finora") {
              const cadeiras = lead.cadeiras ? `${lead.cadeiras} ` : "";
              infoBadgeContent = [cadeiras, fatCurto ? `${fatCurto}` : ""].filter(Boolean).join(" | ");
            } else {
              infoBadgeContent = fatCurto ? `${fatCurto}` : "";
            }

            const clinicaInfoBadge = infoBadgeContent
              ? `<div class="lead-card-empresa-info" style="margin-top: 6px; font-size: 11px; color: #475569; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; display: inline-flex; gap: 8px; font-weight: 500;">
                  <span>${infoBadgeContent}</span>
                 </div>`
              : "";

            // Badges e informações da Proposta / D4Sign
            const temProposta = Boolean(lead.proposta_id);
            const numProposta = lead.proposta_numero || (lead.proposta_id ? `P-${lead.proposta_id}` : "");
            const statusProposta = lead.proposta_status || (lead.status === "Assinada" ? "Aprovada" : lead.status);
            const temD4Sign = Boolean(lead.d4sign_uuid);

            let statusPropostaBadge = "";
            if (temProposta) {
              let bg = "#f1f5f9", textCor = "#475569", borderCor = "#cbd5e1", icone = "📄";
              const s = (statusProposta || "").toLowerCase();
              if (s.includes("rascunho")) {
                bg = "#fef9c3"; textCor = "#a16207"; borderCor = "#fde047"; icone = "✏️";
              } else if (s.includes("visualiz")) {
                bg = "#f3e8ff"; textCor = "#7e22ce"; borderCor = "#d8b4fe"; icone = "👁️";
              } else if (s.includes("assinatura") || s.includes("d4sign")) {
                bg = "#fef3c7"; textCor = "#b45309"; borderCor = "#fde68a"; icone = "✍️";
              } else if (s.includes("aprovad") || s.includes("assinad") || s.includes("ganh")) {
                bg = "#dcfce7"; textCor = "#15803d"; borderCor = "#86efac"; icone = "✅";
              } else if (s.includes("declin") || s.includes("perdid")) {
                bg = "#fee2e2"; textCor = "#b91c1c"; borderCor = "#fca5a5"; icone = "❌";
              } else {
                bg = "#e0f2fe"; textCor = "#0369a1"; borderCor = "#7dd3fc"; icone = "📤";
              }

              statusPropostaBadge = `
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px;">
                  <span style="font-size:10.5px; font-weight:700; background:#0f172a; color:#38bdf8; padding:2px 6px; border-radius:6px; cursor:pointer;" onclick="abrirDetailsComAba(${lead.id}, 'd4sign')" title="Proposta #${escapeHTML(numProposta)}">#${escapeHTML(numProposta)}</span>
                  <span style="font-size:10.5px; font-weight:700; background:${bg}; color:${textCor}; border:1px solid ${borderCor}; padding:2px 7px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">
                    ${icone} ${escapeHTML(statusProposta)}
                  </span>
                  ${temD4Sign ? `<span style="font-size:10px; font-weight:700; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:2px 6px; border-radius:6px;" title="Integrado com D4Sign">✍️ D4Sign</span>` : ""}
                </div>
              `;
            }

            const valorExibir = Number(lead.valor_estimado || lead.proposta_valor_total || 0);

            return `
              <div class="lead-card" id="lead-${lead.id}" draggable="true" ondragstart="dragLeadStart(event, ${lead.id})" ondragend="dragLeadEnd(event)" style="border-left: 3px solid ${escapeHTML(cor)}; display: flex; flex-direction: column; gap: 4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div class="lead-card-title">${escapeHTML(lead.nome_cliente)}</div>
                  <span style="font-size:10px; font-weight:700; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:4px;" title="Tempo na etapa">Hoje</span>
                </div>
                <div class="lead-card-subtitle">${escapeHTML(lead.nome_clinica || "Empresa não informada")}</div>
                
                ${clinicaInfoBadge}
                ${statusPropostaBadge}
                
                <div class="lead-card-value" style="margin-top: 4px;">${moeda.format(valorExibir)}</div>
                
                <div class="lead-card-footer" style="margin-top: 10px; border-top: 1px dashed #f1f5f9; padding-top: 8px; display:flex; align-items:center; justify-content:space-between;">
                  <span class="lead-card-badge ${tagClass}">${escapeHTML(lead.origem || "Outro")}</span>
                  
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="lead-card-comments-indicator" onclick="abrirDetails(${lead.id})" style="font-size: 12px; cursor: pointer; color: #64748b;">
                      ${totalComents}
                    </span>
                    ${gerarAvatarHTML(respNome)}
                  </div>
                </div>
                
                <div style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
                  ${temProposta && lead.token_acesso ? `
                    <a href="/proposta/p/${encodeURIComponent(lead.token_acesso)}" target="_blank" class="btn-mini-light" style="border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #38bdf8; background: #f0f9ff; color: #0284c7; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Visualizar proposta pública">Ver ↗</a>
                  ` : ""}
                  ${temProposta ? `
                    <button class="btn-mini-light" onclick="abrirDetailsComAba(${lead.id}, 'd4sign')" style="border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #cbd5e1; background: #fafafa; color: #334155; font-weight: 700;">✍️ Signatários</button>
                  ` : ""}
                  <button class="btn-mini-light" onclick="abrirDetails(${lead.id})" style="border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; border: 1px solid #cbd5e1; background: white;">Detalhes</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("");
}

// --- CRIAR/EDITAR COLUNA ---
function abrirModalCriarColuna() {
  document.getElementById("modalCriarColuna").style.display = "flex";
  document.getElementById("criarColunaNome").focus();
}

function fecharModalCriarColuna() {
  document.getElementById("modalCriarColuna").style.display = "none";
  document.getElementById("criarColunaNome").value = "";
  document.getElementById("criarColunaCor").value = "#3b82f6";
}

async function salvarNovaColuna(e) {
  e.preventDefault();
  const nome = document.getElementById("criarColunaNome").value.trim();
  const cor = document.getElementById("criarColunaCor").value;

  try {
    const res = await fetchAuth("/api/crm/etapas", {
      method: "POST",
      body: JSON.stringify({ nome, cor })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao criar coluna");

    mostrarToast("Nova coluna criada com sucesso!", "success");
    fecharModalCriarColuna();
    
    await carregarEtapasCRM();
    carregarLeads();
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Erro ao criar coluna.", "error");
  }
}

function abrirModalEditarColuna(id) {
  const etapa = crmEtapas.find(e => Number(e.id) === Number(id));
  if (!etapa) return;
  document.getElementById("editColunaId").value = etapa.id;
  document.getElementById("editColunaNome").value = etapa.nome;
  document.getElementById("editColunaCor").value = etapa.cor || "#94a3b8";
  document.getElementById("modalEditarColuna").style.display = "flex";
}

function fecharModalEditarColuna() {
  document.getElementById("modalEditarColuna").style.display = "none";
}

async function salvarEdicaoColuna(e) {
  e.preventDefault();
  const id = document.getElementById("editColunaId").value;
  const nome = document.getElementById("editColunaNome").value.trim();
  const cor = document.getElementById("editColunaCor").value;

  try {
    const res = await fetchAuth(`/api/crm/etapas/${id}`, {
      method: "PUT",
      body: JSON.stringify({ nome, cor })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar coluna");

    mostrarToast("Coluna atualizada com sucesso!", "success");
    fecharModalEditarColuna();
    
    await carregarEtapasCRM();
    carregarLeads();
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Erro ao editar coluna.", "error");
  }
}

async function deletarColunaCRM() {
  const id = document.getElementById("editColunaId").value;
  if (!confirm("Aviso: Excluir esta coluna não apagará os seus leads, eles serão movidos para a primeira etapa ativa. Tem certeza?")) {
    return;
  }

  try {
    const res = await fetchAuth(`/api/crm/etapas/${id}`, {
      method: "DELETE"
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao remover coluna");

    mostrarToast("Coluna removida com sucesso!", "info");
    fecharModalEditarColuna();
    
    await carregarEtapasCRM();
    carregarLeads();
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "Erro ao remover coluna.", "error");
  }
}

function getTagClass(origem) {
  const norm = String(origem || "").toLowerCase().trim();
  if (norm.includes("google")) return "tag-google";
  if (norm.includes("instagram")) return "tag-instagram";
  if (norm.includes("whatsapp")) return "tag-whatsapp";
  if (norm.includes("indicação")) return "tag-indicacao";
  if (norm.includes("prospecção")) return "tag-outbound";
  return "tag-outro";
}

function filtrarLeads() {
  renderizarKanban();
}

// --- DRAG AND DROP HANDLERS (NATIVE HTML5) ---
let isDraggingLead = false;
let currentMouseX = 0;
let dragScrollAnimationFrame = null;

function handleDragScroll() {
  if (!isDraggingLead) return;
  
  const board = document.querySelector(".kanban-board");
  if (board) {
    const scrollThreshold = 200; // Começa a rolar quando chegar a 200px da borda
    const maxSpeed = 35; // Velocidade máxima mais rápida
    const boardRect = board.getBoundingClientRect();
    
    // Usa window.innerWidth para ignorar a sidebar (se arrastar perto do canto esquerdo da tela toda)
    let speed = 0;
    
    if (currentMouseX > window.innerWidth - scrollThreshold) {
      speed = maxSpeed * (1 - (window.innerWidth - currentMouseX) / scrollThreshold);
      board.scrollLeft += speed;
    } else if (currentMouseX > boardRect.right - scrollThreshold) {
      speed = maxSpeed * (1 - (boardRect.right - currentMouseX) / scrollThreshold);
      board.scrollLeft += speed;
    } else if (currentMouseX < scrollThreshold) {
      speed = maxSpeed * (1 - currentMouseX / scrollThreshold);
      board.scrollLeft -= speed;
    } else if (currentMouseX < boardRect.left + scrollThreshold) {
      speed = maxSpeed * (1 - (currentMouseX - boardRect.left) / scrollThreshold);
      board.scrollLeft -= speed;
    }
  }
  
  dragScrollAnimationFrame = requestAnimationFrame(handleDragScroll);
}

document.addEventListener("dragover", (e) => {
  currentMouseX = e.clientX;
});

function dragLeadStart(e, leadId) {
  e.dataTransfer.setData("text/plain", leadId);
  const card = document.getElementById(`lead-${leadId}`);
  if (card) {
    card.classList.add("dragging");
  }
  isDraggingLead = true;
  if (dragScrollAnimationFrame) cancelAnimationFrame(dragScrollAnimationFrame);
  dragScrollAnimationFrame = requestAnimationFrame(handleDragScroll);
}

function dragLeadEnd(e) {
  const draggingCard = document.querySelector(".lead-card.dragging");
  if (draggingCard) {
    draggingCard.classList.remove("dragging");
  }
  isDraggingLead = false;
  if (dragScrollAnimationFrame) cancelAnimationFrame(dragScrollAnimationFrame);
}

function allowDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.add("drag-over");
}

function dragLeave(e) {
  const col = e.currentTarget;
  col.classList.remove("drag-over");
}

async function dropLead(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove("drag-over");

  const newStatus = col.getAttribute("data-status");
  const leadId = e.dataTransfer.getData("text/plain");

  if (!leadId || !newStatus) return;

  // Atualizar visualmente de forma imediata (otimista)
  const lead = leads.find(l => Number(l.id) === Number(leadId));
  if (!lead || lead.status === newStatus) return;

  // Se o novo status for Perdido, abrir modal de justificativa de perda
  if (newStatus === "Perdido") {
    abrirModalLoss(leadId);
    return;
  }

  const statusAntigo = lead.status;
  lead.status = newStatus;
  lead.atualizado_em = new Date().toISOString();
  renderizarKanban();

  try {
    const res = await fetchAuth(`/api/leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) throw new Error("Erro na API ao atualizar status do lead");
    
    // Atualizar dados completos do backend em seguida
    carregarLeads();
    mostrarToast(`Lead movido para "${newStatus}"`, "success");
  } catch (error) {
    console.error("Erro ao mover lead:", error);
    // Rollback otimista
    lead.status = statusAntigo;
    renderizarKanban();
    mostrarToast("Erro ao salvar mudança de status do lead.", "error");
  }
}

// --- MODAL: CADASTRO E EDIÇÃO DE LEAD ---
function adaptarCamposFormLead() {
  const marca = document.getElementById("leadMarca").value;
  
  // Esconder todas as seções primeiro
  document.getElementById("secaoFinora").style.display = "none";
  document.getElementById("secaoLagerhaus").style.display = "none";
  document.getElementById("secaoQmax").style.display = "none";
  
  if (marca === "finora") {
    document.getElementById("secaoFinora").style.display = "block";
  } else if (marca === "lagerhaus") {
    document.getElementById("secaoLagerhaus").style.display = "block";
  } else {
    document.getElementById("secaoQmax").style.display = "block";
  }
}

function adaptarCamposFormDetails() {
  const marca = document.getElementById("detMarca").value;
  
  document.getElementById("detSecaoFinora").style.display = "none";
  document.getElementById("detSecaoLagerhaus").style.display = "none";
  document.getElementById("detSecaoQmax").style.display = "none";
  
  if (marca === "finora") {
    document.getElementById("detSecaoFinora").style.display = "block";
  } else if (marca === "lagerhaus") {
    document.getElementById("detSecaoLagerhaus").style.display = "block";
  } else {
    document.getElementById("detSecaoQmax").style.display = "block";
  }
}

function abrirModalCriarLead() {
  document.getElementById("leadForm").reset();
  document.getElementById("leadId").value = "";
  document.getElementById("leadMarca").value = "finora";
  adaptarCamposFormLead();
  document.getElementById("leadStatus").disabled = false;
  document.getElementById("modalLeadTitulo").innerText = "Cadastrar Novo Lead";
  document.getElementById("autocompleteSugestoes").style.display = "none";
  
  // Forçar o vendedor logado e desativar select para todos os usuários
  const userSelect = document.getElementById("leadVendedor");
  if (userSelect) {
    // finora_id nunca foi gravado no login: o id vem do próprio JWT
    let idLogado = "";
    try {
      const t = localStorage.getItem("finora_token") || "";
      idLogado = String(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))).id || "");
    } catch (e) { /* token ausente: fica sem vendedor e o servidor distribui pela fila */ }
    userSelect.value = idLogado;
    userSelect.disabled = true;
  }

  document.getElementById("modalLead").style.display = "flex";
}

function abrirEdicaoRapida() {
  if (!leadSelecionado) return;
  
  document.getElementById("modalLeadTitulo").innerText = "Editar Lead";
  document.getElementById("leadId").value = leadSelecionado.id;
  document.getElementById("leadNomeCliente").value = leadSelecionado.nome_cliente;
  document.getElementById("leadNomeClinica").value = leadSelecionado.nome_clinica || "";
  document.getElementById("leadCnpj").value = leadSelecionado.cnpj || "";
  document.getElementById("leadMarca").value = leadSelecionado.marca || "finora";
  adaptarCamposFormLead();
  
  document.getElementById("leadCargo").value = leadSelecionado.cargo || "";
  document.getElementById("leadEmail").value = leadSelecionado.email || "";
  document.getElementById("leadTelefone").value = leadSelecionado.telefone || "";
  document.getElementById("leadCadeiras").value = leadSelecionado.cadeiras !== null && leadSelecionado.cadeiras !== undefined ? leadSelecionado.cadeiras : "";
  document.getElementById("leadFaturamento").value = leadSelecionado.faturamento !== null && leadSelecionado.faturamento !== undefined ? leadSelecionado.faturamento : "";
  document.getElementById("leadAreaM2").value = leadSelecionado.area_m2 !== null && leadSelecionado.area_m2 !== undefined ? leadSelecionado.area_m2 : "";
  document.getElementById("leadPosicoesCoworking").value = leadSelecionado.posicoes_coworking !== null && leadSelecionado.posicoes_coworking !== undefined ? leadSelecionado.posicoes_coworking : "";
  document.getElementById("leadTipoEspaco").value = leadSelecionado.tipo_espaco || "Coworking - Posição Individual";
  
  if (leadSelecionado.marca !== "finora" && leadSelecionado.marca !== "lagerhaus") {
    document.getElementById("leadFaturamentoGeral").value = leadSelecionado.faturamento !== null && leadSelecionado.faturamento !== undefined ? leadSelecionado.faturamento : "";
  }
  
  document.getElementById("leadOrigem").value = leadSelecionado.origem || "Outro";
  document.getElementById("leadValorEstimado").value = leadSelecionado.valor_estimado || 0;
  document.getElementById("leadStatus").value = leadSelecionado.status;
  
  const userSelect = document.getElementById("leadVendedor");
  if (userSelect) {
    userSelect.value = leadSelecionado.vendedor_id || "";
    
    const userRole = localStorage.getItem("finora_role");
    // Se for comercial OU se o lead já tem um vendedor fixado, desabilitar alteração
    if (userRole === "Comercial" || leadSelecionado.vendedor_id) {
      userSelect.disabled = true;
    } else {
      userSelect.disabled = false;
    }
  }
  
  document.getElementById("autocompleteSugestoes").style.display = "none";

  // Fechar o modal de detalhes e abrir o de edição
  fecharModalDetails();
  document.getElementById("modalLead").style.display = "flex";
}

function fecharModalLead() {
  document.getElementById("modalLead").style.display = "none";
  document.getElementById("autocompleteSugestoes").style.display = "none";
}

async function salvarLead(e) {
  e.preventDefault();

  const id = document.getElementById("leadId").value;
  const marca = document.getElementById("leadMarca").value;
  
  let fatVal = null;
  let cadeirasVal = null;
  let areaVal = null;
  let posVal = null;
  let tipoEspVal = "";
  
  if (marca === "finora") {
    cadeirasVal = document.getElementById("leadCadeiras").value ? parseInt(document.getElementById("leadCadeiras").value) : null;
    fatVal = document.getElementById("leadFaturamento").value ? parseFloat(document.getElementById("leadFaturamento").value) : null;
  } else if (marca === "lagerhaus") {
    areaVal = document.getElementById("leadAreaM2").value ? parseFloat(document.getElementById("leadAreaM2").value) : null;
    posVal = document.getElementById("leadPosicoesCoworking").value ? parseInt(document.getElementById("leadPosicoesCoworking").value) : null;
    tipoEspVal = document.getElementById("leadTipoEspaco").value;
  } else {
    fatVal = document.getElementById("leadFaturamentoGeral").value ? parseFloat(document.getElementById("leadFaturamentoGeral").value) : null;
  }

  const dados = {
    nome_cliente: document.getElementById("leadNomeCliente").value,
    nome_clinica: document.getElementById("leadNomeClinica").value,
    cnpj: document.getElementById("leadCnpj").value,
    cargo: document.getElementById("leadCargo").value,
    email: document.getElementById("leadEmail").value,
    telefone: document.getElementById("leadTelefone").value,
    marca: marca,
    cadeiras: cadeirasVal,
    faturamento: fatVal,
    area_m2: areaVal,
    posicoes_coworking: posVal,
    tipo_espaco: tipoEspVal,
    origem: document.getElementById("leadOrigem").value,
    valor_estimado: parseFloat(document.getElementById("leadValorEstimado").value || 0),
    status: document.getElementById("leadStatus").value,
    funil_id: currentFunilId
  };

  const isEdit = !!id;
  const url = isEdit ? `/api/leads/${id}` : "/api/leads";
  const method = isEdit ? "PUT" : "POST";

  try {
    const res = await fetchAuth(url, {
      method,
      body: JSON.stringify(dados),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData.error || "Erro ao salvar lead");
    }

    fecharModalLead();
    mostrarToast(resData.message || "Lead salvo com sucesso!", "success");
    carregarLeads();
    
    // Se for edição e o modal de detalhes estava focado, reabrir detalhes atualizados
    if (isEdit) {
      abrirDetails(id);
    }
  } catch (error) {
    console.error("Erro no submit do lead:", error);
    mostrarToast(error.message || "Erro ao cadastrar lead.", "error");
  }
}

// --- LOGICA DE AUTOCOMPLETE PARA CLIENTE REUSADO ---
async function buscarSugestoesCliente(texto) {
  const container = document.getElementById("autocompleteSugestoes");
  if (!container) return;

  if (!texto || texto.trim().length < 2) {
    container.style.display = "none";
    return;
  }

  try {
    const res = await fetchAuth(`/api/crm/pesquisa-clientes?q=${encodeURIComponent(texto)}`);
    if (!res.ok) throw new Error();

    const sugestoes = await res.json();
    if (sugestoes.length === 0) {
      container.style.display = "none";
      return;
    }

    // Só o índice vai no onclick: nome do lead vem do formulário público e quebrava o atributo (XSS)
    SUGESTOES_CLIENTE = sugestoes;
    container.innerHTML = sugestoes.map((cli, indice) => {
      return `
        <div 
          onclick="selecionarSugestaoCliente(SUGESTOES_CLIENTE[${indice}])"
          style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 13px; text-align: left; transition: background 0.2s;"
          onmouseover="this.style.background='#f8fafc'"
          onmouseout="this.style.background='white'"
        >
          <strong style="color:var(--brand-primary); display:block;">${escapeHTML(cli.nome_cliente)}</strong>
          <span style="font-size: 11px; color: #64748b;">Clínica: ${escapeHTML(cli.nome_clinica || "Não cadastrada")} | Tel: ${escapeHTML(cli.telefone || "-")}</span>
        </div>
      `;
    }).join("");

    container.style.display = "block";
  } catch (err) {
    console.error("Erro no autocomplete:", err);
  }
}

function selecionarSugestaoCliente(cli) {
  document.getElementById("leadNomeCliente").value = cli.nome_cliente;
  document.getElementById("leadNomeClinica").value = cli.nome_clinica || "";
  document.getElementById("leadCargo").value = cli.cargo || "";
  document.getElementById("leadEmail").value = cli.email || "";
  document.getElementById("leadTelefone").value = cli.telefone || "";
  document.getElementById("leadCadeiras").value = cli.cadeiras || "";
  document.getElementById("leadFaturamento").value = cli.faturamento || "";
  document.getElementById("leadOrigem").value = cli.origem || "Google";
  document.getElementById("leadValorEstimado").value = cli.valor_estimado || 0;

  // Fechar sugestões
  document.getElementById("autocompleteSugestoes").style.display = "none";
  mostrarToast(`Dados importados de ${cli.nome_cliente}!`, "success");
}

// Variável global para gerenciar os campos adicionais enquanto edita o lead
let camposPersonalizadosEdicao = {};

// --- MODAL: DETALHES DO LEAD (LINHA DO TEMPO) ---
async function abrirDetails(leadId) {
  try {
    // Redefinir a aba focada para a timeline por padrão
    if (typeof switchDetailsTab === "function") {
      switchDetailsTab("timeline");
    }

    const res = await fetchAuth(`/api/leads/${leadId}`);
    if (!res.ok) throw new Error("Erro ao buscar detalhes do lead");

    const data = await res.json();
    leadSelecionado = data.lead;

    // Preencher campos do formulário para edição estilo Bitrix
    document.getElementById("detailsTitle").innerText = leadSelecionado.nome_cliente;
    document.getElementById("detNomeCliente").value = leadSelecionado.nome_cliente || "";
    document.getElementById("detClinica").value = leadSelecionado.nome_clinica || "";
    document.getElementById("detCnpj").value = leadSelecionado.cnpj || "";
    document.getElementById("detMarca").value = leadSelecionado.marca || "finora";
    adaptarCamposFormDetails();
    
    document.getElementById("detCargo").value = leadSelecionado.cargo || "";
    document.getElementById("detEmail").value = leadSelecionado.email || "";
    document.getElementById("detTelefone").value = leadSelecionado.telefone || "";
    document.getElementById("detCadeiras").value = leadSelecionado.cadeiras !== null && leadSelecionado.cadeiras !== undefined ? leadSelecionado.cadeiras : "";
    document.getElementById("detFaturamento").value = leadSelecionado.faturamento !== null && leadSelecionado.faturamento !== undefined ? leadSelecionado.faturamento : "";
    document.getElementById("detAreaM2").value = leadSelecionado.area_m2 !== null && leadSelecionado.area_m2 !== undefined ? leadSelecionado.area_m2 : "";
    document.getElementById("detPosicoesCoworking").value = leadSelecionado.posicoes_coworking !== null && leadSelecionado.posicoes_coworking !== undefined ? leadSelecionado.posicoes_coworking : "";
    document.getElementById("detTipoEspaco").value = leadSelecionado.tipo_espaco || "Coworking - Posição Individual";
    
    if (leadSelecionado.marca !== "finora" && leadSelecionado.marca !== "lagerhaus") {
      document.getElementById("detFaturamentoGeral").value = leadSelecionado.faturamento !== null && leadSelecionado.faturamento !== undefined ? leadSelecionado.faturamento : "";
    }
    
    document.getElementById("detOrigem").value = leadSelecionado.origem || "Google";
    document.getElementById("detValor").value = leadSelecionado.valor_estimado || 0;
    document.getElementById("detStatus").value = leadSelecionado.status || "Novo";

    // Exibir vendedor de forma textual estática
    const detVendedorNome = document.getElementById("detVendedorNome");
    if (detVendedorNome) {
      detVendedorNome.innerText = leadSelecionado.vendedor_nome || leadSelecionado.vendedor_name || "Sem responsável";
    }

    // Processar campos personalizados JSON
    let campos = {};
    try {
      campos = typeof leadSelecionado.campos_personalizados === "string"
        ? JSON.parse(leadSelecionado.campos_personalizados)
        : (leadSelecionado.campos_personalizados || {});
    } catch (e) {
      campos = {};
    }
    camposPersonalizadosEdicao = campos;
    renderizarCamposPersonalizados();

    // Preencher Banner Hero Surreal da Proposta se houver proposta vinculada
    const heroBanner = document.getElementById("proposalHeroBanner");
    const tabHeaderD4Sign = document.getElementById("tabHeaderD4Sign");
    if (heroBanner) {
      if (leadSelecionado.proposta_id) {
        const numP = leadSelecionado.proposta_numero || (leadSelecionado.proposta_id ? `P-${leadSelecionado.proposta_id}` : "");
        const statusP = leadSelecionado.proposta_status || leadSelecionado.status || "Enviada";
        const tokenP = leadSelecionado.token_acesso || "";
        const urlPublica = tokenP ? `${window.location.origin}/proposta/p/${tokenP}` : "";
        const valorP = Number(leadSelecionado.proposta_valor_total || leadSelecionado.valor_estimado || 0);
        const fatP = leadSelecionado.proposta_faturamento ? Number(leadSelecionado.proposta_faturamento) : null;
        const temD4 = Boolean(leadSelecionado.d4sign_uuid);

        heroBanner.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:14px;">
            <div style="flex:1; min-width:260px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#93c5fd; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
                  ⚡ PROPOSTA VINCULADA
                </span>
                <span style="background:rgba(212,175,55,0.25); color:#fde047; border:1px solid rgba(212,175,55,0.5); font-size:11px; padding:2px 8px; border-radius:999px; font-weight:800;">
                  #${escapeHTML(numP)}
                </span>
                <span style="background:rgba(255,255,255,0.15); color:#f8fafc; font-size:11px; padding:2px 8px; border-radius:999px; font-weight:700;">
                  ${escapeHTML(statusP)}
                </span>
                ${temD4 ? `<span style="background:rgba(34,197,94,0.25); color:#86efac; border:1px solid rgba(34,197,94,0.4); font-size:11px; padding:2px 8px; border-radius:999px; font-weight:800;">✍️ D4Sign Conectado</span>` : ""}
              </div>
              <div style="font-size:17px; font-weight:800; color:#ffffff; line-height:1.2;">
                ${escapeHTML(leadSelecionado.nome_clinica || leadSelecionado.nome_cliente)}
              </div>
              <div style="font-size:12.5px; color:#cbd5e1; margin-top:4px; display:flex; gap:12px; flex-wrap:wrap;">
                <span>Valor: <strong style="color:#facc15;">${moeda.format(valorP)}</strong></span>
                ${fatP ? `<span>Faturamento: <strong style="color:#e2e8f0;">${moeda.format(fatP)}</strong></span>` : ""}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              ${urlPublica ? `
                <a href="${urlPublica}" target="_blank" style="background:#2563eb; color:white; font-size:12px; font-weight:700; padding:8px 14px; border-radius:10px; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(37,99,235,0.35); transition:background 0.2s;">
                  Ver Proposta ↗
                </a>
                <button type="button" onclick="copiarLinkPublicoProposta('${escapeHTML(tokenP)}')" style="background:rgba(255,255,255,0.12); color:#ffffff; border:1px solid rgba(255,255,255,0.25); font-size:12px; font-weight:600; padding:8px 12px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                  📋 Copiar Link
                </button>
              ` : ""}
              <button type="button" onclick="switchDetailsTab('d4sign')" style="background:linear-gradient(135deg, #059669 0%, #10b981 100%); color:white; border:0; font-size:12px; font-weight:700; padding:8px 14px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(16,185,129,0.35);">
                ✍️ Ver Signatários D4Sign
              </button>
            </div>
          </div>
        `;
        heroBanner.style.display = "block";
        if (tabHeaderD4Sign) tabHeaderD4Sign.style.display = "inline-flex";
      } else {
        heroBanner.style.display = "none";
        if (tabHeaderD4Sign) tabHeaderD4Sign.style.display = "none";
      }
    }

    // Proposta Vinculada
    const detProposta = document.getElementById("detProposta");
    if (leadSelecionado.proposta_id && leadSelecionado.proposta_numero) {
      detProposta.innerHTML = `<a href="/proposta/p/${encodeURIComponent(leadSelecionado.token_acesso || "")}" target="_blank" style="color:var(--brand-primary); text-decoration:underline;">Proposta #${leadSelecionado.proposta_numero}</a>`;
      document.getElementById("btnConvertProposal").style.display = "none";
    } else {
      detProposta.innerText = "Sem proposta comercial gerada";
      document.getElementById("btnConvertProposal").style.display = "inline-flex";
    }

    // Renderizar Timeline
    renderizarTimeline(data.timeline);

    // Atualizar visualizador do ciclo de assinatura
    if (typeof atualizarAssinaturaTracker === "function") {
      atualizarAssinaturaTracker(leadSelecionado);
    }

    // Carregar e renderizar atividades agendadas
    if (typeof carregarAtividades === "function") {
      carregarAtividades(leadId);
    }

    // Ocultar painel de criar campos inicialmente
    cancelarNovoCampo();

    // Abrir Modal
    document.getElementById("modalLeadDetails").style.display = "flex";
  } catch (error) {
    console.error("Erro abrirDetails:", error);
    mostrarToast("Erro ao carregar detalhes do lead.", "error");
  }
}

// --- FUNÇÕES DE CAMPOS PERSONALIZADOS ---
let CHAVES_CAMPOS_EDICAO = [];
let SUGESTOES_CLIENTE = [];
function renderizarCamposPersonalizados() {
  const container = document.getElementById("camposPersonalizadosLista");
  if (!container) return;

  const chaves = Object.keys(camposPersonalizadosEdicao);
  if (chaves.length === 0) {
    container.innerHTML = `<p style="font-size:12px; color:#94a3b8; font-style:italic; margin: 0;">Nenhum campo personalizado criado.</p>`;
    return;
  }

  // Chave por índice no onclick: o navegador decodifica &#039; antes de rodar o JS, então escapeHTML não basta
  CHAVES_CAMPOS_EDICAO = chaves;
  container.innerHTML = chaves.map((key, indice) => {
    const valor = camposPersonalizadosEdicao[key];
    return `
      <div style="background:#f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="flex:1;">
          <strong style="font-size:11px; color:#475569; display:block; text-transform:uppercase;">${escapeHTML(key)}</strong>
          <input 
            type="text" 
            value="${escapeHTML(String(valor || ""))}" 
            onchange="atualizarValorCampoPersonalizado(CHAVES_CAMPOS_EDICAO[${indice}], this.value)"
            style="width: 100%; border: 0; background:transparent; font-size:13px; color:#0f172a; font-weight:700; padding: 4px 0 0 0; outline:none;"
          />
        </div>
        <button type="button" onclick="removerCampoPersonalizado(CHAVES_CAMPOS_EDICAO[${indice}])" style="background:transparent; border:0; color:#ef4444; cursor:pointer; font-size:14px; padding:0 4px;" title="Remover Campo"></button>
      </div>
    `;
  }).join("");
}

function exibirPainelNovoCampo() {
  const painel = document.getElementById("painelNovoCampo");
  if (painel) {
    painel.style.display = "flex";
    document.getElementById("novoCampoNome").focus();
  }
}

function cancelarNovoCampo() {
  const painel = document.getElementById("painelNovoCampo");
  if (painel) {
    painel.style.display = "none";
    document.getElementById("novoCampoNome").value = "";
    document.getElementById("novoCampoValor").value = "";
  }
}

function adicionarCampoPersonalizado() {
  const nome = document.getElementById("novoCampoNome").value.trim();
  const valor = document.getElementById("novoCampoValor").value.trim();

  if (!nome || !valor) {
    mostrarToast("Preencha o nome e o valor do campo.", "error");
    return;
  }

  camposPersonalizadosEdicao[nome] = valor;
  renderizarCamposPersonalizados();
  cancelarNovoCampo();
  mostrarToast(`Campo "${nome}" adicionado!`, "success");
}

function removerCampoPersonalizado(key) {
  delete camposPersonalizadosEdicao[key];
  renderizarCamposPersonalizados();
  mostrarToast(`Campo "${key}" removido.`, "info");
}

function atualizarValorCampoPersonalizado(key, valor) {
  camposPersonalizadosEdicao[key] = valor.trim();
}

// --- SALVAR ALTERAÇÕES DO LEAD ---
async function salvarAlteracoesLead(e) {
  e.preventDefault();
  if (!leadSelecionado) return;

  const id = leadSelecionado.id;
  const marca = document.getElementById("detMarca").value;
  
  let fatVal = null;
  let cadeirasVal = null;
  let areaVal = null;
  let posVal = null;
  let tipoEspVal = "";
  
  if (marca === "finora") {
    cadeirasVal = document.getElementById("detCadeiras").value ? parseInt(document.getElementById("detCadeiras").value) : null;
    fatVal = document.getElementById("detFaturamento").value ? parseFloat(document.getElementById("detFaturamento").value) : null;
  } else if (marca === "lagerhaus") {
    areaVal = document.getElementById("detAreaM2").value ? parseFloat(document.getElementById("detAreaM2").value) : null;
    posVal = document.getElementById("detPosicoesCoworking").value ? parseInt(document.getElementById("detPosicoesCoworking").value) : null;
    tipoEspVal = document.getElementById("detTipoEspaco").value;
  } else {
    fatVal = document.getElementById("detFaturamentoGeral").value ? parseFloat(document.getElementById("detFaturamentoGeral").value) : null;
  }

  const dados = {
    nome_cliente: document.getElementById("detNomeCliente").value,
    nome_clinica: document.getElementById("detClinica").value,
    cnpj: document.getElementById("detCnpj").value,
    cargo: document.getElementById("detCargo").value,
    email: document.getElementById("detEmail").value,
    telefone: document.getElementById("detTelefone").value,
    marca: marca,
    cadeiras: cadeirasVal,
    faturamento: fatVal,
    area_m2: areaVal,
    posicoes_coworking: posVal,
    tipo_espaco: tipoEspVal,
    origem: document.getElementById("detOrigem").value,
    valor_estimado: parseFloat(document.getElementById("detValor").value || 0),
    status: document.getElementById("detStatus").value,
    campos_personalizados: camposPersonalizadosEdicao
  };

  try {
    const res = await fetchAuth(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    });

    const resData = await res.json();
    if (!res.ok) throw new Error(resData.error || "Erro ao salvar alterações");

    mostrarToast("Lead atualizado com sucesso!", "success");
    
    // Atualizar dados na tela
    carregarLeads();
    abrirDetails(id);
  } catch (error) {
    console.error("Erro ao salvar alterações do lead:", error);
    mostrarToast(error.message || "Erro ao atualizar dados do lead.", "error");
  }
}

function renderizarTimeline(timeline) {
  const container = document.getElementById("timelineList");
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); text-align:center; padding: 20px; font-size:13px; font-style:italic;">Sem histórico ou comentários registrados.</p>`;
    return;
  }

  container.innerHTML = timeline.map(item => {
    const isHistorico = item.tipo === "historico" || item.tipo === "sistema";
    const itemClass = isHistorico ? "tipo-historico" : "tipo-comentario";
    const dataFormatada = formatarData(item.criado_em);
    const autor = isHistorico ? "Sistema" : (item.usuario_nome || "Usuário");

    return `
      <div class="timeline-item ${itemClass}">
        <div class="timeline-item-dot"></div>
        <div class="timeline-item-header">
          <span class="timeline-item-author">${escapeHTML(autor)}</span>
          <span class="timeline-item-date">${dataFormatada}</span>
        </div>
        <div class="timeline-item-body">${escapeHTML(item.comentario)}</div>
      </div>
    `;
  }).join("");
}

function fecharModalDetails() {
  document.getElementById("modalLeadDetails").style.display = "none";
  leadSelecionado = null;
  camposPersonalizadosEdicao = {};
}

// --- TIMELINE: ENVIAR COMENTÁRIO MANUAL ---
async function enviarComentario() {
  if (!leadSelecionado) return;

  const txtArea = document.getElementById("novoComentario");
  const comentario = txtArea.value.trim();

  if (comentario === "") return;

  try {
    const res = await fetchAuth(`/api/leads/${leadSelecionado.id}/comentarios`, {
      method: "POST",
      body: JSON.stringify({ comentario }),
    });

    if (!res.ok) throw new Error("Erro ao salvar comentário");

    txtArea.value = "";
    
    // Atualizar detalhes do lead e timeline
    abrirDetails(leadSelecionado.id);
    carregarLeads(); // Para atualizar o contador de comentários na fila do Kanban
    mostrarToast("Anotação registrada com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao enviarComentario:", error);
    mostrarToast("Erro ao registrar comentário.", "error");
  }
}

// --- CONVERSÃO DE LEAD PARA PROPOSTA (PRE-PREENCHIMENTO) ---
function converterParaProposta() {
  if (!leadSelecionado) return;

  const p = new URLSearchParams();
  p.set("nomeClinica", leadSelecionado.nome_clinica || "");
  p.set("nomeSocio", leadSelecionado.nome_cliente || "");
  p.set("email", leadSelecionado.email || "");
  p.set("telefone", leadSelecionado.telefone || "");
  p.set("lead_id", leadSelecionado.id);

  // Mapear origem para ecossistema se relevante ou ir padrão
  p.set("tipoProposta", "finora");

  // Redirecionar
  window.location.href = `/proposta/index.html?${p.toString()}`;
}

// --- EXCLUIR LEAD ---
async function excluirLeadAtual() {
  if (!leadSelecionado) return;

  const confirmar = confirm(`Tem certeza que deseja excluir permanentemente o lead "${leadSelecionado.nome_cliente}"?`);
  if (!confirmar) return;

  try {
    const res = await fetchAuth(`/api/leads/${leadSelecionado.id}`, {
      method: "DELETE",
    });

    if (!res.ok) throw new Error("Erro ao excluir lead");

    fecharModalDetails();
    mostrarToast("Lead excluído com sucesso!", "success");
    carregarLeads();
  } catch (error) {
    console.error("Erro ao excluirLeadAtual:", error);
    mostrarToast("Erro ao excluir lead do sistema.", "error");
  }
}

// --- CONECTAR SSE NOTIFICATIONS EM TEMPO REAL ---
function conectarSSE() {
  const statusDot = document.getElementById("sseStatusDot");
  const statusText = document.getElementById("sseStatusText");

  if (!token) return;

  if (sseSource) {
    sseSource.close();
  }

  let loggedInUserId = null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    loggedInUserId = payload.id;
  } catch (jwtErr) {
    console.warn("Não foi possível decodificar o id do usuário do token:", jwtErr);
  }

  // SSE Stream endpoint
  sseSource = new EventSource(`/api/notifications/stream?token=${token}`);

  sseSource.onopen = () => {
    if (statusDot) statusDot.style.background = "#10b981"; // verde conectado
    if (statusText) statusText.innerText = "Em tempo real";
  };

  sseSource.onerror = (err) => {
    console.warn("Conexão SSE perdida. Tentando reconectar...", err);
    if (statusDot) statusDot.style.background = "#ef4444"; // vermelho erro
    if (statusText) statusText.innerText = "Desconectado";
  };

  // Eventos de Leads
  const atualizarEventos = ["lead_criado", "lead_atualizado", "lead_deletado", "lead_comentado"];
  
  atualizarEventos.forEach(evt => {
    sseSource.addEventListener(evt, (e) => {
      try {
        const dados = JSON.parse(e.data);
        
        // Se o evento foi disparado por outro usuário, atualizar o quadro e exibir notificação
        let msg = "";
        if (evt === "lead_criado") {
          msg = `Novo lead criado por ${dados.por}: "${dados.nome_cliente}"`;
        } else if (evt === "lead_atualizado") {
          msg = `Lead "${dados.nome_cliente}" atualizado por ${dados.por} para a etapa "${dados.status}"`;
        } else if (evt === "lead_deletado") {
          msg = `Lead "${dados.nome_cliente}" foi excluído por ${dados.por}`;
        } else if (evt === "lead_comentado") {
          msg = `Nova anotação no lead "${dados.nome_cliente}" por ${dados.por}`;
        }

        mostrarToast(msg, "info");
        
        // Recarregar os leads no Kanban silenciosamente
        carregarLeads();

        // Se o lead aberto for o que foi atualizado, recarregar detalhes
        if (leadSelecionado && Number(leadSelecionado.id) === Number(dados.id)) {
          abrirDetails(leadSelecionado.id);
        }
      } catch (err) {
        console.error("Erro processar evento SSE:", err);
      }
    });
  });

  // Evento de lembrete de atividade agendada
  sseSource.addEventListener("atividade_lembrete", (e) => {
    try {
      const dados = JSON.parse(e.data);
      // Apenas alertar se for do próprio usuário logado
      if (loggedInUserId && Number(dados.usuario_id) === Number(loggedInUserId)) {
        mostrarToast(`Lembrete: Atividade "${dados.tipo}" com o cliente "${dados.cliente_nome}" venceu!`, "success");
        tocarSomAlerta();
        
        // Se o modal do lead correspondente estiver aberto, recarregar a aba de atividades
        if (leadSelecionado && Number(leadSelecionado.id) === Number(dados.lead_id)) {
          carregarAtividades(leadSelecionado.id);
        }
      }
    } catch (err) {
      console.error("Erro no evento de lembrete de atividade:", err);
    }
  });

  // Evento de leads importados por planilha
  sseSource.addEventListener("leads_importados", (e) => {
    try {
      const dados = JSON.parse(e.data);
      mostrarToast(`${dados.quantidade} leads importados por ${dados.por}!`, "success");
      carregarLeads();
    } catch (err) {
      console.error("Erro no evento de leads importados:", err);
    }
  });

  // Leads que chegam de fora (formulário do site, prospecção) não apareciam até recarregar a página
  sseSource.addEventListener("novo_lead_webhook", (e) => {
    try {
      const dados = JSON.parse(e.data);
      mostrarToast(`Novo lead do site: ${dados.nome_cliente || dados.clinica || "sem nome"}`, "success");
      carregarLeads();
    } catch (err) {
      console.error("Erro no evento de lead do webhook:", err);
    }
  });
  sseSource.addEventListener("leads_prospeccao_importados", (e) => {
    try {
      mostrarToast(JSON.parse(e.data).mensagem || "Leads da prospecção importados.", "success");
      carregarLeads();
    } catch (err) {
      console.error("Erro no evento de prospecção:", err);
    }
  });
}

function tocarSomAlerta() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Tocar um bi-tom premium de alerta
    const playTone = (freq, start, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
      
      osc.start(audioCtx.currentTime + start);
      osc.stop(audioCtx.currentTime + start + duration);
    };

    playTone(523.25, 0, 0.15); // C5
    playTone(659.25, 0.15, 0.25); // E5
  } catch (err) {
    console.warn("Erro ao reproduzir som de alerta:", err);
  }
}

// --- UTILS ---
function formatarData(dataIso) {
  if (!dataIso) return "";
  const d = new Date(dataIso);
  
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function mostrarToast(mensagem, tipo = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.style.background = tipo === "success" ? "#10b981" : tipo === "error" ? "#ef4444" : "#1e293b";
  toast.style.color = "white";
  toast.style.padding = "12px 18px";
  toast.style.borderRadius = "12px";
  toast.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
  toast.style.fontSize = "13.5px";
  toast.style.fontWeight = "600";
  toast.style.minWidth = "250px";
  toast.style.maxWidth = "350px";
  toast.style.transition = "all 0.3s ease";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";
  
  toast.innerText = mensagem;
  container.appendChild(toast);

  // Trigger anim
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- CRM EXPANSION LOGIC (MÉTRICAS, FUNIL, PERDAS E CLIENTES) ---


// Expandir/recolher painel de estatísticas
function toggleMetricsPanel() {
  const panel = document.getElementById("metricsPanel");
  if (panel.style.display === "none") {
    panel.style.display = "block";
    carregarEstatisticas();
  } else {
    panel.style.display = "none";
  }
}

// Carregar estatísticas agregadas do funil do backend
async function carregarEstatisticas() {
  try {
    const res = await fetchAuth("/api/leads/stats");
    if (!res.ok) throw new Error("Erro ao carregar estatísticas");

    const data = await res.json();
    
    // 1. Preencher KPIs
    const kpis = data.kpis;
    document.getElementById("metricTotalNegociando").innerText = moeda.format(Number(kpis.total_negociando || 0));
    document.getElementById("metricTotalGanho").innerText = moeda.format(Number(kpis.total_ganho || 0));
    document.getElementById("metricTotalLeads").innerText = kpis.total_leads || 0;
    
    const convRate = kpis.total_leads > 0 ? Math.round((kpis.leads_ganhos / kpis.total_leads) * 100) : 0;
    document.getElementById("metricConversionRate").innerText = `${convRate}%`;

    // 2. Renderizar Barras do Funil
    renderizarFunnelBars(data.etapas);

    // 3. Renderizar Motivos de Perda
    renderizarMotivosPerda(data.motivosPerda);

    // 4. Renderizar Leaderboard de Vendedores (Premium)
    if (typeof renderizarLeaderboard === "function") {
      renderizarLeaderboard(data.rankingVendedores);
    }

    // 5. Renderizar Feed Global de Atividades Comercial (Premium)
    if (typeof renderizarLiveFeed === "function") {
      renderizarLiveFeed(data.atividadesRecentes);
    }
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
  }
}

// Renderizar gráfico de barras horizontais do funil comercial
function renderizarFunnelBars(etapasData) {
  const container = document.getElementById("funnelChartBars");
  if (!container) return;

  const etapasOrdem = ["Novo", "Em Contato", "Qualificado", "Reunião Agendada", "Proposta Enviada"];
  
  // Mapear dados para as etapas comerciais
  const counts = {};
  etapasData.forEach(item => {
    counts[item.status] = item.count;
  });

  // Encontrar o maior count para servir de 100% de escala
  let maxCount = 0;
  etapasOrdem.forEach(e => {
    const count = counts[e] || 0;
    if (count > maxCount) maxCount = count;
  });

  if (maxCount === 0) maxCount = 1; // Evitar divisão por zero

  container.innerHTML = etapasOrdem.map(etapa => {
    const count = counts[etapa] || 0;
    const pct = Math.round((count / maxCount) * 100);
    const fillClass = `fill-${etapa.replace(/\s+/g, '-')}`;
    
    return `
      <div class="funnel-bar-wrapper">
        <div class="funnel-bar-label" title="${etapa}">${etapa}</div>
        <div class="funnel-bar-container">
          <div class="funnel-bar-fill ${fillClass}" style="width: ${pct}%">
            ${count > 0 ? `${count} lead(s)` : ''}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Renderizar lista de principais motivos de perda
function renderizarMotivosPerda(motivos) {
  const container = document.getElementById("lossReasonsList");
  if (!container) return;

  if (!motivos || motivos.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); text-align:center; padding: 20px; font-size:12.5px; font-style:italic;">Nenhuma perda detalhada ou registrada.</p>`;
    return;
  }

  container.innerHTML = motivos.map(m => {
    return `
      <div class="loss-reason-item">
        <span class="loss-reason-name">${escapeHTML(m.motivo_perda)}</span>
        <div class="loss-reason-badge">
          <span class="loss-reason-count">${m.count}</span>
          <span class="loss-reason-val">${moeda.format(Number(m.valor || 0))}</span>
        </div>
      </div>
    `;
  }).join("");
}

// Renderizar a Base de Clientes Ganhos
function renderizarClientesGanhos() {
  const grid = document.getElementById("clientGrid");
  const noClientsMsg = document.getElementById("noClientsMessage");
  if (!grid) return;

  const searchTerm = document.getElementById("searchFilter").value.toLowerCase();
  const vendedorIdFilter = document.getElementById("vendedorFilter").value;
  const origemFilter = document.getElementById("origemFilter").value;

  const clientes = leads.filter(lead => {
    if (lead.status !== "Ganho") return false;

    const matchSearch =
      lead.nome_cliente.toLowerCase().includes(searchTerm) ||
      (lead.nome_clinica && lead.nome_clinica.toLowerCase().includes(searchTerm));

    const matchVendedor = !vendedorIdFilter || Number(lead.vendedor_id) === Number(vendedorIdFilter);
    const matchOrigem = !origemFilter || lead.origem === origemFilter;

    return matchSearch && matchVendedor && matchOrigem;
  });

  if (clientes.length === 0) {
    grid.innerHTML = "";
    noClientsMsg.style.display = "block";
    return;
  }

  noClientsMsg.style.display = "none";

  grid.innerHTML = clientes.map(c => {
    const dataFormatada = formatarData(c.criado_em).split(' ')[0];
    const vendedorNome = c.vendedor_nome || "Sem responsável";
    
    let propostaInfo = "";
    if (c.proposta_id && c.proposta_numero) {
      propostaInfo = `
        <div class="client-card-prop">
          <div class="client-card-prop-label">Proposta Comercial Ganha</div>
          <div class="client-card-prop-val">
            <a href="/proposta/p/${encodeURIComponent(c.token_acesso || '')}" target="_blank" style="color:#047857; text-decoration:underline;">
              #${c.proposta_numero}
            </a>
            <span>${moeda.format(Number(c.valor_estimado || 0))}</span>
          </div>
        </div>
      `;
    } else {
      propostaInfo = `
        <div class="client-card-prop" style="background:#f1f5f9; border-color:#cbd5e1;">
          <div class="client-card-prop-label" style="color:#64748b;">Valor de Contrato</div>
          <div class="client-card-prop-val" style="color:#334155;">
            <span>Avulso (Sem proposta)</span>
            <span>${moeda.format(Number(c.valor_estimado || 0))}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="client-card">
        <div class="client-card-header">
          <div class="client-card-name">${escapeHTML(c.nome_cliente)}</div>
          <div class="client-card-clinica">${escapeHTML(c.nome_clinica || "Clínica não informada")}</div>
        </div>
        <div class="client-card-body">
          <div class="client-card-field">${escapeHTML(c.email || "Sem e-mail")}</div>
          <div class="client-card-field">${escapeHTML(c.telefone || "Sem telefone")}</div>
          <div class="client-card-field">Origem: ${escapeHTML(c.origem || "Outro")}</div>
          <div class="client-card-field">Vendedor: ${escapeHTML(vendedorNome)}</div>
          <div class="client-card-field">Ativo desde: ${dataFormatada}</div>
        </div>
        ${propostaInfo}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <button class="btn-secondary btn-mini" onclick="abrirDetails(${c.id})" style="border-radius:8px; font-size:12px; cursor:pointer;">
            Histórico & Timeline
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// --- POPUP FLUXO DE LEADS PERDIDOS (MOTIVOS DE PERDA) ---
function abrirModalLoss(leadId) {
  document.getElementById("lossLeadId").value = leadId;
  document.getElementById("lossReasonSelect").value = "";
  document.getElementById("lossDetailsTextarea").value = "";
  document.getElementById("modalLossReason").style.display = "flex";
}

function fecharModalLoss() {
  document.getElementById("modalLossReason").style.display = "none";
  carregarLeads(); // Desfazer movimento otimista no Kanban
}

async function salvarLeadComoPerdido(e) {
  e.preventDefault();

  const leadId = document.getElementById("lossLeadId").value;
  const motivo = document.getElementById("lossReasonSelect").value;
  const detalhes = document.getElementById("lossDetailsTextarea").value;

  if (!leadId || !motivo) return;

  try {
    const res = await fetchAuth(`/api/leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "Perdido",
        motivo_perda: motivo,
        detalhes_perda: detalhes
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao salvar perda de lead");

    document.getElementById("modalLossReason").style.display = "none";
    mostrarToast("Lead marcado como perdido. Motivo registrado!", "info");
    carregarLeads();
  } catch (err) {
    console.error("Erro ao salvarLeadComoPerdido:", err);
    mostrarToast("Erro ao registrar fechamento perdido do lead.", "error");
  }
}

// --- LOGICA DE ATIVIDADES E ABAS DO MODAL DE DETALHES ---

// Alternar entre abas do Modal de Detalhes
function switchDetailsTab(tab) {
  const tabTimeline = document.getElementById("tabContentTimeline");
  const tabActivities = document.getElementById("tabContentActivities");
  const tabD4Sign = document.getElementById("tabContentD4Sign");
  const headerTimeline = document.getElementById("tabHeaderTimeline");
  const headerActivities = document.getElementById("tabHeaderActivities");
  const headerD4Sign = document.getElementById("tabHeaderD4Sign");

  if (!tabTimeline || !tabActivities || !headerTimeline || !headerActivities) return;

  if (tab === "timeline") {
    tabTimeline.style.display = "block";
    tabActivities.style.display = "none";
    if (tabD4Sign) tabD4Sign.style.display = "none";
    headerTimeline.classList.add("active");
    headerActivities.classList.remove("active");
    if (headerD4Sign) headerD4Sign.classList.remove("active");
  } else if (tab === "activities") {
    tabTimeline.style.display = "none";
    tabActivities.style.display = "block";
    if (tabD4Sign) tabD4Sign.style.display = "none";
    headerTimeline.classList.remove("active");
    headerActivities.classList.add("active");
    if (headerD4Sign) headerD4Sign.classList.remove("active");
    
    // Focar no agendamento se necessário
    if (leadSelecionado) {
      carregarAtividades(leadSelecionado.id);
    }
  } else if (tab === "d4sign") {
    tabTimeline.style.display = "none";
    tabActivities.style.display = "none";
    if (tabD4Sign) tabD4Sign.style.display = "block";
    headerTimeline.classList.remove("active");
    headerActivities.classList.remove("active");
    if (headerD4Sign) headerD4Sign.classList.add("active");

    if (leadSelecionado) {
      carregarStatusD4Sign(leadSelecionado.id);
    }
  }
}

// Abrir modal de detalhes diretamente em uma aba específica
async function abrirDetailsComAba(leadId, aba = "timeline") {
  await abrirDetails(leadId);
  switchDetailsTab(aba);
}

// Copiar link público da proposta
function copiarLinkPublicoProposta(token) {
  if (!token) return;
  const link = `${window.location.origin}/proposta/p/${token}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => {
      mostrarToast("Link público da proposta copiado!", "success");
    }).catch(() => {
      prompt("Copie o link da proposta:", link);
    });
  } else {
    prompt("Copie o link da proposta:", link);
  }
}

// Carregar e monitorar status das assinaturas no D4Sign em tempo real
async function carregarStatusD4Sign(leadId, forcar = false) {
  const container = document.getElementById("d4signLiveWidget");
  if (!container) return;

  container.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; text-align: center; color: #64748b;">
      <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
      <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">Sincronizando com D4Sign em tempo real...</div>
      <div style="font-size: 12px; margin-top: 4px;">Consultando signatários e status jurídicos na API oficial.</div>
    </div>
  `;

  try {
    const res = await fetchAuth(`/api/leads/${leadId}/d4sign-status`);
    if (!res.ok) throw new Error("Erro ao consultar status D4Sign");
    const data = await res.json();

    if (!data.temProposta) {
      container.innerHTML = `
        <div style="background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 28px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">📑</div>
          <div style="font-weight: 700; font-size: 14px; color: #334155;">Nenhuma Proposta Vinculada</div>
          <p style="font-size: 12.5px; color: #64748b; margin: 6px 0 16px 0;">Este lead ainda não tem uma proposta gerada para envio ao D4Sign.</p>
          <button type="button" class="btn-primary" onclick="converterLeadEmProposta()" style="padding: 8px 16px; font-size: 12.5px; border-radius: 10px;">Gerar Proposta Comercial</button>
        </div>
      `;
      return;
    }

    if (!data.temDocumento) {
      const urlPublica = data.tokenAcesso ? `${window.location.origin}/proposta/p/${data.tokenAcesso}` : "";
      container.innerHTML = `
        <div style="background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 28px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">✍️</div>
          <div style="font-weight: 800; font-size: 14.5px; color: #0f172a;">Proposta #${escapeHTML(data.numeroProposta || data.propostaId)} Pronta</div>
          <p style="font-size: 12.5px; color: #64748b; margin: 6px auto 16px auto; max-width: 440px;">
            A proposta está criada mas ainda não foi despachada para o fluxo de assinatura digital do D4Sign. Quando o cliente aprovar ou você enviar para assinatura, o rastreamento em tempo real será ativado automaticamente aqui.
          </p>
          <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            ${urlPublica ? `
              <a href="${urlPublica}" target="_blank" class="btn-primary" style="padding: 8px 16px; font-size: 12.5px; border-radius: 10px; text-decoration:none;">Abrir Proposta ↗</a>
              <button type="button" class="btn-secondary" onclick="copiarLinkPublicoProposta('${escapeHTML(data.tokenAcesso)}')" style="padding: 8px 16px; font-size: 12.5px; border-radius: 10px;">Copiar Link da Proposta</button>
            ` : ""}
          </div>
        </div>
      `;
      return;
    }

    // Caso possua documento no D4Sign
    const isFinal = String(data.statusId) === "4" || data.statusDoc?.toLowerCase().includes("finaliz") || data.progresso === 100;
    const isCancelado = String(data.statusId) === "6";
    
    let statusBadgeHTML = "";
    if (isFinal) {
      statusBadgeHTML = `<span style="background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">✅ Finalizado (100% Assinado)</span>`;
    } else if (isCancelado) {
      statusBadgeHTML = `<span style="background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">❌ Cancelado</span>`;
    } else {
      statusBadgeHTML = `<span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">⏳ ${escapeHTML(data.statusDoc || "Aguardando Assinaturas")}</span>`;
    }

    const signatariosHTML = (data.signatarios && data.signatarios.length > 0)
      ? data.signatarios.map(s => {
          const assinado = Boolean(s.assinado);
          let dataHoraAss = "";
          if (assinado && s.dataAssinatura) {
            try {
              const d = new Date(s.dataAssinatura);
              dataHoraAss = `em ${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
            } catch {
              dataHoraAss = "";
            }
          }

          return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1px solid ${assinado ? '#bbf7d0' : '#e2e8f0'}; border-radius:12px; padding:12px 16px; gap:12px; flex-wrap:wrap; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:36px; height:36px; border-radius:50%; background:${assinado ? '#dcfce7' : '#f1f5f9'}; color:${assinado ? '#166534' : '#64748b'}; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; flex-shrink:0;">
                  ${assinado ? '✓' : '✍'}
                </div>
                <div>
                  <div style="font-weight:700; font-size:13.5px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                    ${escapeHTML(s.nome)}
                    <span style="font-size:10.5px; font-weight:600; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:999px;">${escapeHTML(s.papel || "Signatário")}</span>
                  </div>
                  <div style="font-size:12px; color:#64748b; margin-top:2px;">${escapeHTML(s.email)}</div>
                </div>
              </div>

              <div>
                ${assinado ? `
                  <div style="text-align:right;">
                    <span style="background:#f0fdf4; color:#15803d; border:1px solid #86efac; padding:4px 10px; border-radius:8px; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                      ✅ Assinado
                    </span>
                    ${dataHoraAss ? `<div style="font-size:10.5px; color:#166534; margin-top:3px; font-weight:500;">${dataHoraAss}</div>` : ""}
                  </div>
                ` : `
                  <span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; padding:4px 10px; border-radius:8px; font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                    ⏳ Aguardando assinatura
                  </span>
                `}
              </div>
            </div>
          `;
        }).join("")
      : `<p style="color:#64748b; font-size:12.5px; font-style:italic;">Nenhum signatário listado.</p>`;

    container.innerHTML = `
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; box-shadow:0 4px 16px -2px rgba(15,23,42,0.05); display:flex; flex-direction:column; gap:16px;">
        <!-- Topo: Status & Sincronização -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid #f1f5f9; padding-bottom:14px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px; font-weight:800; color:#0f172a;">Contrato D4Sign</span>
              ${statusBadgeHTML}
            </div>
            <div style="font-size:11.5px; color:#64748b; margin-top:4px; display:flex; align-items:center; gap:6px;">
              <span>UUID:</span>
              <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-family:monospace; color:#334155;">${escapeHTML(data.uuid)}</code>
            </div>
          </div>

          <button type="button" onclick="carregarStatusD4Sign(${leadId}, true)" class="btn-secondary" style="font-size:12px; font-weight:700; padding:6px 14px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            🔄 Sincronizar Agora
          </button>
        </div>

        <!-- Barra de Progresso de Assinaturas -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:12px; font-weight:700;">
            <span style="color:#334155;">Progresso das Assinaturas</span>
            <span style="color:${isFinal ? '#15803d' : '#0284c7'}; font-size:13px;">${data.assinados || 0} de ${data.total || 0} (${data.progresso || 0}%)</span>
          </div>
          <div style="width:100%; height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
            <div style="width:${data.progresso || 0}%; height:100%; background:${isFinal ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #38bdf8, #2563eb)'}; transition:width 0.4s ease; border-radius:999px;"></div>
          </div>
        </div>

        ${isFinal ? `
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 12px; padding: 12px 16px; color: #166534; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">🎉</span>
            <span>Documento 100% assinado por todas as partes! Venda confirmada e formalizada juridicamente.</span>
          </div>
        ` : ""}

        <!-- Lista de Signatários -->
        <div>
          <div style="font-size:12.5px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px;">Signatários Vinculados</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${signatariosHTML}
          </div>
        </div>
      </div>
    `;

    if (forcar) {
      mostrarToast("Status D4Sign atualizado com sucesso!", "success");
      if (leadSelecionado) {
        leadSelecionado.d4sign_uuid = data.uuid;
        if (isFinal) leadSelecionado.proposta_status = "Aprovada";
        atualizarAssinaturaTracker(leadSelecionado);
      }
    }
  } catch (error) {
    console.error("Erro ao carregarStatusD4Sign:", error);
    container.innerHTML = `
      <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:14px; padding:20px; text-align:center; color:#be123c;">
        <div style="font-size:24px; margin-bottom:6px;">⚠️</div>
        <div style="font-weight:700; font-size:13.5px;">Falha ao comunicar com o servidor D4Sign</div>
        <div style="font-size:12px; margin-top:4px; color:#9f1239;">${escapeHTML(error.message || "Erro desconhecido")}</div>
        <button type="button" onclick="carregarStatusD4Sign(${leadId}, true)" class="btn-secondary" style="margin-top:12px; font-size:12px; padding:6px 14px; border-radius:8px;">Tentar Novamente</button>
      </div>
    `;
  }
}

// Carregar e listar atividades de um lead
async function carregarAtividades(leadId) {
  const container = document.getElementById("activitiesList");
  if (!container) return;

  try {
    const res = await fetchAuth(`/api/leads/${leadId}/atividades`);
    if (!res.ok) throw new Error("Erro ao buscar atividades agendadas");

    const atividades = await res.json();
    if (atividades.length === 0) {
      container.innerHTML = `<p style="color:var(--muted); text-align:center; padding: 24px; font-size:12.5px; font-style:italic; margin:0;">Nenhuma atividade agendada ou pendente.</p>`;
      return;
    }

    container.innerHTML = atividades.map(act => {
      const dataFormatada = formatarData(act.data_hora);
      const isConcluida = Number(act.concluido) === 1;
      const concluidaClass = isConcluida ? "concluida" : "";
      const checkedAttr = isConcluida ? "checked" : "";
      
      let badgeEmoji = "";
      if (act.tipo === "Ligar") badgeEmoji = "";
      else if (act.tipo === "WhatsApp") badgeEmoji = "";
      else if (act.tipo === "Reunião") badgeEmoji = "";
      else if (act.tipo === "E-mail") badgeEmoji = "";
      else if (act.tipo === "Retorno") badgeEmoji = "";

      return `
        <div class="activity-item ${concluidaClass}">
          <input type="checkbox" ${checkedAttr} onchange="alternarConclusaoAtividade(${act.id}, this.checked)" style="margin-top: 3px; cursor: pointer; width: 15px; height: 15px;">
          <div style="flex-grow: 1;">
            <div class="activity-item-title">${badgeEmoji} ${escapeHTML(act.tipo)}</div>
            <div class="activity-item-meta">
              <span>${dataFormatada}</span>
              <span>Agendado por: ${escapeHTML(act.usuario_nome || "Vendedor")}</span>
            </div>
            ${act.descricao ? `<div class="activity-item-desc">${escapeHTML(act.descricao)}</div>` : ''}
          </div>
          <button onclick="excluirAtividade(${act.id})" title="Excluir agendamento" style="background:transparent; border:0; color:#ef4444; cursor:pointer; font-size:14px; padding:0 4px; transition:opacity 0.2s;"></button>
        </div>
      `;
    }).join("");
  } catch (error) {
    console.error("Erro ao carregar atividades:", error);
    container.innerHTML = `<p style="color:var(--danger); text-align:center; padding:12px; font-size:12px;">Erro ao carregar lembretes.</p>`;
  }
}

// Agendar nova atividade de follow-up
async function agendarAtividade(e) {
  e.preventDefault();
  if (!leadSelecionado) return;

  const tipo = document.getElementById("actTipo").value;
  const data_hora = document.getElementById("actDataHora").value;
  const descricao = document.getElementById("actDescricao").value;

  try {
    const res = await fetchAuth(`/api/leads/${leadSelecionado.id}/atividades`, {
      method: "POST",
      body: JSON.stringify({ tipo, data_hora, descricao })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao agendar atividade");

    mostrarToast("Atividade agendada com sucesso!", "success");
    document.getElementById("formScheduleActivity").reset();
    
    // Atualizar a listagem e os detalhes abertos
    carregarAtividades(leadSelecionado.id);
    abrirDetails(leadSelecionado.id); // Recarrega timeline para mostrar histórico do agendamento
  } catch (error) {
    console.error("Erro ao agendarAtividade:", error);
    mostrarToast(error.message || "Erro ao agendar tarefa.", "error");
  }
}

// Alternar conclusão de atividade (Checkbox)
async function alternarConclusaoAtividade(idAtividade, concluido) {
  try {
    const res = await fetchAuth(`/api/atividades/${idAtividade}/concluir`, {
      method: "PUT",
      body: JSON.stringify({ concluido: concluido ? 1 : 0 })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao mudar status de conclusão");

    mostrarToast(data.message, "success");
    
    if (leadSelecionado) {
      carregarAtividades(leadSelecionado.id);
      abrirDetails(leadSelecionado.id); // Recarrega timeline
    }
  } catch (error) {
    console.error("Erro ao alternarConclusaoAtividade:", error);
    mostrarToast("Erro ao atualizar conclusão da atividade.", "error");
  }
}

// Excluir atividade agendada
async function excluirAtividade(idAtividade) {
  if (!confirm("Tem certeza que deseja excluir esta atividade agendada?")) return;

  try {
    const res = await fetchAuth(`/api/atividades/${idAtividade}`, {
      method: "DELETE"
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao excluir atividade");

    mostrarToast("Agendamento removido!", "info");
    
    if (leadSelecionado) {
      carregarAtividades(leadSelecionado.id);
      abrirDetails(leadSelecionado.id); // Recarrega timeline
    }
  } catch (error) {
    console.error("Erro ao excluirAtividade:", error);
    mostrarToast("Erro ao remover agendamento.", "error");
  }
}

// --- LOGICA DE EXPORTAÇÃO E IMPORTAÇÃO DE LEADS (CSV) ---

// Exportar base de leads atual de acordo com filtros para planilha CSV
function exportarLeadsCSV() {
  const searchTerm = document.getElementById("searchFilter").value.toLowerCase();
  const vendedorIdFilter = document.getElementById("vendedorFilter").value;
  const origemFilter = document.getElementById("origemFilter").value;

  const leadsFiltrados = leads.filter(lead => {
    const matchSearch =
      lead.nome_cliente.toLowerCase().includes(searchTerm) ||
      (lead.nome_clinica && lead.nome_clinica.toLowerCase().includes(searchTerm));

    const matchVendedor = !vendedorIdFilter || Number(lead.vendedor_id) === Number(vendedorIdFilter);
    const matchOrigem = !origemFilter || lead.origem === origemFilter;

    return matchSearch && matchVendedor && matchOrigem;
  });

  if (leadsFiltrados.length === 0) {
    mostrarToast("Nenhum lead disponível para exportação com os filtros atuais.", "error");
    return;
  }

  // Montar cabeçalho do CSV
  const colunas = ["Nome do Cliente", "Clinica", "Email", "Telefone", "Origem", "Etapa", "Valor Estimado", "Cargo", "Vendedor Responsavel"];
  const linhas = [colunas.join(";")];

  leadsFiltrados.forEach(l => {
    const vendedor = l.vendedor_nome || "Sem responsavel";
    const valor = String(l.valor_estimado || 0).replace(".", ",");
    const dadosLinha = [
      `"${(l.nome_cliente || "").replace(/"/g, '""')}"`,
      `"${(l.nome_clinica || "").replace(/"/g, '""')}"`,
      `"${(l.email || "").replace(/"/g, '""')}"`,
      `"${(l.telefone || "").replace(/"/g, '""')}"`,
      `"${(l.origem || "").replace(/"/g, '""')}"`,
      `"${(l.status || "").replace(/"/g, '""')}"`,
      `"${valor}"`,
      `"${(l.cargo || "").replace(/"/g, '""')}"`,
      `"${vendedor.replace(/"/g, '""')}"`
    ];
    linhas.push(dadosLinha.join(";"));
  });

  const csvContent = "\uFEFF" + linhas.join("\n"); // Adicionar BOM UTF-8 para o Excel abrir sem quebrar acentuação
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `crm-leads-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarToast("Exportação realizada com sucesso!", "success");
}

// Importar leads em lote de um arquivo CSV
function importarLeadsCSV(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    const text = evt.target.result;
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) {
      mostrarToast("Planilha vazia ou formato inválido.", "error");
      return;
    }

    const headerLine = lines[0];
    const separador = headerLine.includes(";") ? ";" : ",";
    const headers = headerLine.split(separador).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const leadsList = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = line.split(separador).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cells.length < headers.length) continue;

      const leadObj = {};
      headers.forEach((header, idx) => {
        const val = cells[idx] || "";
        if (header.includes("nome") || header.includes("cliente")) {
          leadObj.nome_cliente = val;
        } else if (header.includes("clinica") || header.includes("clínica")) {
          leadObj.nome_clinica = val;
        } else if (header.includes("email") || header.includes("e-mail")) {
          leadObj.email = val;
        } else if (header.includes("tel") || header.includes("whatsapp") || header.includes("fone")) {
          leadObj.telefone = val;
        } else if (header.includes("origem")) {
          leadObj.origem = val;
        } else if (header.includes("etapa") || header.includes("status")) {
          leadObj.status = val;
        } else if (header.includes("valor")) {
          leadObj.valor_estimado = parseFloat(val.replace(",", "."));
        } else if (header.includes("cargo") || header.includes("função")) {
          leadObj.cargo = val;
        }
      });

      if (leadObj.nome_cliente) {
        leadsList.push(leadObj);
      }
    }

    if (leadsList.length === 0) {
      mostrarToast("Nenhum lead com nome válido localizado no arquivo CSV.", "error");
      return;
    }

    try {
      mostrarToast(`Importando ${leadsList.length} leads...`, "info");
      const res = await fetchAuth("/api/leads/importar", {
        method: "POST",
        body: JSON.stringify({ leadsList })
      });

      const data = await res.json();
      if (!res.ok) {
        const primeira = data.invalidas && data.invalidas[0];
        throw new Error((data.error || "Erro ao importar leads") + (primeira ? ` Linha ${primeira.linha}: ${primeira.erros.join("; ")}` : ""));
      }

      mostrarToast(`${data.count} leads foram importados com sucesso!`, "success");
      carregarLeads();
      document.getElementById("importCsvInput").value = "";
    } catch (error) {
      console.error("Erro ao importar CSV:", error);
      mostrarToast(error.message || "Erro na importação em lote.", "error");
    }
  };

  reader.readAsText(file, "UTF-8");
}

// --- LOGICAS PREMIUM (FASE 4: WHATSAPP, LEADERBOARD E TRACKER) ---

// Alternar dropdown do WhatsApp
function toggleWaDropdown() {
  const dropdown = document.getElementById("waDropdown");
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

// Fechar dropdown do WhatsApp se clicar fora
document.addEventListener("click", (e) => {
  const container = document.getElementById("waActionsContainer");
  const dropdown = document.getElementById("waDropdown");
  if (container && dropdown && !container.contains(e.target)) {
    dropdown.style.display = "none";
  }
});

// Enviar mensagem comercial pré-formatada via WhatsApp Web
function enviarTemplateWa(templateType) {
  if (!leadSelecionado) return;

  const telefone = String(leadSelecionado.telefone || "").replace(/\D/g, "");
  if (!telefone) {
    mostrarToast("Este lead não possui telefone cadastrado.", "error");
    return;
  }

  let telefoneFormatado = telefone;
  if (telefone.length === 10 || telefone.length === 11) {
    telefoneFormatado = "55" + telefone; // Prefixar Brasil se DDD
  }

  const nome = leadSelecionado.nome_cliente;
  const clinica = leadSelecionado.nome_clinica || "clínica";
  const vendedor = localStorage.getItem("finora_nome") || "Consultor Comercial";
  
  let linkProposta = "";
  if (leadSelecionado.token_acesso) {
    linkProposta = `${window.location.origin}/proposta/p/${encodeURIComponent(leadSelecionado.token_acesso)}`;
  } else {
    linkProposta = `${window.location.origin}/proposta/login.html`;
  }

  let mensagem = "";
  if (templateType === "apresentacao") {
    mensagem = `Olá, ${nome}! Sou o ${vendedor} da FINORA. Fiquei muito feliz com seu contato referente a soluções para a ${clinica}. Gostaria de agendar um breve bate-papo de 10 minutos esta semana?`;
  } else if (templateType === "proposta") {
    if (leadSelecionado.proposta_id) {
      mensagem = `Olá, ${nome}! Já elaborei a proposta comercial personalizada para a ${clinica}. Você pode analisar as condições e realizar a assinatura digital no link: ${linkProposta} . Qualquer dúvida estou por aqui!`;
    } else {
      mensagem = `Olá, ${nome}! Já estamos preparando sua proposta para a ${clinica} e logo te enviaremos o link de fechamento por aqui.`;
    }
  } else if (templateType === "reuniao") {
    mensagem = `Olá, ${nome}! Confirmando nossa reunião agendada para conversarmos sobre o projeto da ${clinica}. Um abraço, ${vendedor}!`;
  } else if (templateType === "followup") {
    mensagem = `Olá, ${nome}! Passando para saber se conseguiu dar uma olhada na proposta que conversamos para a ${clinica} e se restou alguma dúvida. Vamos fechar a parceria?`;
  }

  const url = `https://api.whatsapp.com/send?phone=${telefoneFormatado}&text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
  
  // Logar atividade na timeline automaticamente
  dbLogComentarioManual(`Envio automático via WhatsApp: "${mensagem.substring(0, 55)}..."`);
  
  document.getElementById("waDropdown").style.display = "none";
}

async function dbLogComentarioManual(texto) {
  if (!leadSelecionado) return;
  try {
    await fetchAuth(`/api/leads/${leadSelecionado.id}/comentarios`, {
      method: "POST",
      body: JSON.stringify({ comentario: texto })
    });
    // Atualizar timeline
    abrirDetails(leadSelecionado.id);
  } catch (err) {
    console.warn("Falha ao registrar histórico de WhatsApp:", err);
  }
}

// Atualizar passos do ciclo de assinatura do contrato
function atualizarAssinaturaTracker(lead) {
  const steps = ["criado", "proposta", "visualizado", "assinatura", "ganho"];
  
  steps.forEach(step => {
    const el = document.getElementById(`step-${step}`);
    if (el) el.classList.remove("active");
  });
  
  const lines = document.querySelectorAll(".signature-tracker-container .tracker-line");
  lines.forEach(l => l.classList.remove("active"));

  const status = (lead.status || "").toLowerCase();
  const pStatus = (lead.proposta_status || "").toLowerCase();
  const temProposta = Boolean(lead.proposta_id);
  const temD4Sign = Boolean(lead.d4sign_uuid);

  // Passo 1: Lead Criado (sempre ativo)
  const stepCriado = document.getElementById("step-criado");
  if (stepCriado) stepCriado.classList.add("active");

  // Passo 2: Proposta Enviada
  const foiEnviada = temProposta && (
    pStatus.includes("enviad") || pStatus.includes("visualiz") || pStatus.includes("assinat") || pStatus.includes("aprovad") ||
    status.includes("proposta enviada") || status.includes("visualiz") || status.includes("em assinatura") || status.includes("assinad") || status.includes("ganho")
  );
  if (foiEnviada) {
    const stepProp = document.getElementById("step-proposta");
    if (stepProp) stepProp.classList.add("active");
    if (lines[0]) lines[0].classList.add("active");
  }

  // Passo 3: Visualizada
  const foiVisualizada = temProposta && (
    pStatus.includes("visualiz") || pStatus.includes("assinat") || pStatus.includes("aprovad") ||
    status.includes("visualizada") || status.includes("em assinatura") || status.includes("assinad") || status.includes("ganho")
  );
  if (foiVisualizada) {
    const stepVis = document.getElementById("step-visualizado");
    if (stepVis) stepVis.classList.add("active");
    if (lines[1]) lines[1].classList.add("active");
  }

  // Passo 4: Em Assinatura (D4Sign)
  const emAssinatura = temProposta && (
    temD4Sign || pStatus.includes("assinat") || pStatus.includes("aprovad") ||
    status.includes("em assinatura") || status.includes("assinad") || status.includes("ganho")
  );
  if (emAssinatura) {
    const stepAss = document.getElementById("step-assinatura");
    if (stepAss) stepAss.classList.add("active");
    if (lines[2]) lines[2].classList.add("active");
  }

  // Passo 5: Contrato Assinado / Ganho
  const foiAssinado = pStatus.includes("aprovad") || status.includes("assinad") || status.includes("ganho");
  if (foiAssinado) {
    const stepGanho = document.getElementById("step-ganho");
    if (stepGanho) stepGanho.classList.add("active");
    if (lines[3]) lines[3].classList.add("active");
  }
}

// Renderizar o Leaderboard de Vendedores
function renderizarLeaderboard(vendedores) {
  const container = document.getElementById("leaderboardList");
  if (!container) return;

  if (!vendedores || vendedores.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); text-align:center; padding: 20px; font-size:12.5px; font-style:italic;">Nenhum vendedor comercial ativo localizado.</p>`;
    return;
  }

  const maxFaturamento = Math.max(...vendedores.map(v => Number(v.faturamento_ganho || 0)), 1);

  container.innerHTML = vendedores.map((v, index) => {
    const rank = index + 1;
    const faturamento = Number(v.faturamento_ganho || 0);
    const pct = Math.round((faturamento / maxFaturamento) * 100);
    
    let rankBadge = rank;
    if (rank === 1) rankBadge = "1º";
    else if (rank === 2) rankBadge = "2º";
    else if (rank === 3) rankBadge = "3º";

    const rankClass = rank <= 3 ? `rank-${rank}` : "";

    return `
      <div class="leaderboard-item">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="leaderboard-rank ${rankClass}">${rankBadge}</div>
          <div>
            <div class="leaderboard-name">${escapeHTML(v.vendedor_nome)}</div>
            <div class="leaderboard-role">${escapeHTML(v.vendedor_role)}</div>
            <div class="leaderboard-bar">
              <div class="leaderboard-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        </div>
        <div class="leaderboard-stats">
          <div class="leaderboard-value">${moeda.format(faturamento)}</div>
          <div class="leaderboard-meta">${v.leads_ganhos} ganhos / ${v.leads_total} total</div>
        </div>
      </div>
    `;
  }).join("");
}

// Renderizar Feed de Atividades Operacionais Recentes
function renderizarLiveFeed(atividades) {
  const container = document.getElementById("liveActivityFeed");
  if (!container) return;

  if (!atividades || atividades.length === 0) {
    container.innerHTML = `<p style="color:var(--muted); text-align:center; padding: 20px; font-size:12.5px; font-style:italic;">Nenhuma atividade comercial recente registrada.</p>`;
    return;
  }

  container.innerHTML = atividades.map(act => {
    const tempoFormatado = formatarTempoRelativo(act.criado_em);
    const isComent = act.tipo === "comentario";
    const prefix = isComent ? "" : "";

    return `
      <div class="live-activity-item">
        <span style="font-size: 14px;">${prefix}</span>
        <div style="flex-grow: 1; padding-right: 8px;">
          <strong>${escapeHTML(act.usuario_nome || "Sistema")}:</strong> 
          ${escapeHTML(act.comentario)}
          <span style="display: block; font-size: 10px; color: var(--muted); margin-top: 2px;">Lead: ${escapeHTML(act.nome_cliente)}</span>
        </div>
        <span class="live-activity-time">${tempoFormatado}</span>
      </div>
    `;
  }).join("");
}

// Formatador de tempo relativo
function formatarTempoRelativo(dataIso) {
  if (!dataIso) return "";
  const diff = Date.now() - new Date(dataIso).getTime();
  const segs = Math.floor(diff / 1000);
  const mins = Math.floor(segs / 60);
  const horas = Math.floor(mins / 60);
  const dias = Math.floor(horas / 24);

  if (segs < 60) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  if (horas < 24) return `Há ${horas} h`;
  return `Há ${dias} d`;
}

// --- TRANSFERIR LEAD ---
function abrirModalTransferirLead() {
  if (!leadSelecionado) return;
  const modal = document.getElementById("modalTransferirLead");
  const select = document.getElementById("transferirNovoUsuario");
  if (modal && select) {
    select.innerHTML = `<option value="">Selecione um vendedor</option>` +
      vendedores.map(v => `<option value="${v.id}">${escapeHTML(v.nome)}</option>`).join("");
    if (leadSelecionado.vendedor_id) {
      select.value = leadSelecionado.vendedor_id;
    }
    modal.style.display = "flex";
  }
}

function fecharModalTransferirLead() {
  const modal = document.getElementById("modalTransferirLead");
  if (modal) modal.style.display = "none";
}

async function transferirLead(event) {
  event.preventDefault();
  if (!leadSelecionado) return;

  const novo_usuario_id = document.getElementById("transferirNovoUsuario").value;
  if (!novo_usuario_id) {
    mostrarToast("Selecione um responsável.", "warning");
    return;
  }

  const btnSubmit = event.target.querySelector("button[type='submit']");
  if (btnSubmit) {
    btnSubmit.innerText = "Transferindo...";
    btnSubmit.disabled = true;
  }

  try {
    const res = await fetchAuth(`/api/leads/${leadSelecionado.id}/transferir`, {
      method: "PUT",
      body: JSON.stringify({ novo_usuario_id }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erro ao transferir lead.");
    }

    mostrarToast("Lead transferido com sucesso!", "success");
    fecharModalTransferirLead();
    
    // Atualiza UI
    leadSelecionado.vendedor_id = novo_usuario_id;
    carregarLeads(); // recarrega a tela
    fecharModalDetails();
  } catch (error) {
    mostrarToast(error.message, "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.innerText = "Transferir";
      btnSubmit.disabled = false;
    }
  }
}



// --- GEST�O DE FUNIS (MODAL) ---
function abrirModalGerenciarFunis() {
  document.getElementById("modalGerenciarFunis").style.display = "flex";
  renderizarListaFunis();
}

function fecharModalGerenciarFunis() {
  document.getElementById("modalGerenciarFunis").style.display = "none";
}

function renderizarListaFunis() {
  const lista = document.getElementById("listaFunis");
  if (!lista) return;
  if (!funis || funis.length === 0) {
    lista.innerHTML = "<p>Nenhum funil encontrado.</p>";
    return;
  }
  
  lista.innerHTML = funis.map(f => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #e2e8f0;">
      <div>
        <strong>${escapeHTML(f.nome)}</strong>
        <div style="font-size: 11px; color: #64748b;">${escapeHTML(f.descricao || "")}</div>
      </div>
      <span style="font-size: 12px; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">ID: ${f.id}</span>
    </div>
  `).join("");
}

async function salvarNovoFunil(e) {
  e.preventDefault();
  const nome = document.getElementById("novoFunilNome").value;
  const descricao = document.getElementById("novoFunilDescricao").value;

  try {
    const res = await fetchAuth("/api/crm/funis", {
      method: "POST",
      body: JSON.stringify({ nome, descricao })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao criar funil");
    
    mostrarToast("Funil criado com sucesso!", "success");
    document.getElementById("novoFunilNome").value = "";
    document.getElementById("novoFunilDescricao").value = "";
    
    await carregarFunis();
    renderizarListaFunis();
  } catch (error) {
    console.error(error);
    mostrarToast(error.message, "error");
  }
}

// 💬 GERADOR DE PITCH COPYS WHATSAPP (MELHORIA CRM 1)
function abrirModalScriptPitch() {
  const modal = document.getElementById("modalScriptPitch");
  if (modal) {
    modal.style.display = "flex";
    carregarScriptPitch("primeiro_contato");
  }
}

function fecharModalScriptPitch() {
  const modal = document.getElementById("modalScriptPitch");
  if (modal) modal.style.display = "none";
}

function carregarScriptPitch(tipo) {
  const txt = document.getElementById("txtPitchCopy");
  if (!txt) return;

  const scripts = {
    primeiro_contato: `Olá, tudo bem? Me chamo representante da Q-MAX / FINORA. Entrei em contato referente à otimização contábil e planejamento tributário para a sua clínica. Gostaria de 5 minutinhos para apresentar como reduzimos impostos de forma 100% legal. Podemos conversar?`,
    followup: `Olá! Passando para saber se conseguiu analisar a proposta comercial que enviamos. Estamos com condições especiais ativas para fechamento esta semana com diagnóstico tributário cortesia. Como está sua agenda hoje?`,
    fechamento: `Olá! O seu contrato já está pronto para assinatura digital via D4Sign com validade jurídica. Assim que assinar, já liberamos seu onboarding imediatamente. Posso te enviar o link direto?`
  };

  txt.value = scripts[tipo] || scripts.primeiro_contato;
}

function copiarPitchCopy() {
  const txt = document.getElementById("txtPitchCopy");
  if (!txt) return;

  txt.select();
  document.execCommand("copy");
  
  if (typeof mostrarToast === "function") {
    mostrarToast("Script copiado para a área de transferência com sucesso!", "success");
  } else {
    alert("Script copiado!");
  }
}

