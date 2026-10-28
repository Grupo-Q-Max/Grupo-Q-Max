const formatador = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

// API pode devolver colunas JSON (itens_json) como texto ou já como array
function lerJson(valor, padrao = []) {
  if (valor == null || valor === "") return padrao;
  return typeof valor === "string" ? JSON.parse(valor) : valor;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(data) {
  if (!data) return "-";

  const d = new Date(data);
  if (isNaN(d.getTime())) return data;

  return d.toLocaleDateString("pt-BR");
}

function tipoItem(item) {
  const obs = (item.observacao || "").toLowerCase();

  // Deve manter em sincronia com separarTotais() em script.js
  return obs.includes("pontual") ||
    obs.includes("taxas") ||
    obs.includes("emissão") ||
    obs.includes("renovação") ||
    obs.includes("implanta") // cobre "Implantação" (tech)
    ? "Pontual"
    : "Mensal";
}

function renderItens(lista) {
  if (!lista.length) {
    return '<small style="color:#94a3b8;">Nenhum item</small>';
  }

  return lista
    .map((item) => {
      const desconto = Number(item.descontoPercentual || 0);
      const valorOriginal = Number(item.valorOriginal || item.valor || 0);
      const valorFinal = Number(item.valor || 0);
      const valorDesconto = Number(item.valorDesconto || 0);

      return `
        <div class="dash-item">
          <div>
            <strong>${escapeHTML(item.servico)}</strong>
            <small>${escapeHTML(item.observacao || "-")}</small>
            ${
              desconto > 0
                ? `<small class="dash-desconto">Desconto: ${desconto}% (-${formatador.format(valorDesconto)})</small>`
                : ""
            }
          </div>

          <div style="text-align:right;">
            ${
              desconto > 0
                ? `<small class="valor-riscado">${formatador.format(valorOriginal)}</small><br>`
                : ""
            }
            <strong>${formatador.format(valorFinal)}</strong>
          </div>
        </div>
      `;
    })
    .join("");
}

function abrirModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function fecharModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.style.display = "none";

  const algumAberto = [...document.querySelectorAll(".modal")].some(
    (m) => m.style.display === "flex",
  );

  if (!algumAberto) {
    document.body.style.overflow = "auto";
  }
}

function fecharTodosModais() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });

  document.body.style.overflow = "auto";
}

function visualizarTextoTopico(topico) {
  document.getElementById("visualizarTopicoTitulo").innerText = topico.titulo;
  document.getElementById("visualizarTopicoTexto").innerText =
    topico.texto || "";
  abrirModal("modalVisualizarTopico");
}
