function atualizarRankingVendedores(propostas) {
  const role = localStorage.getItem("finora_role");

  const card = document.getElementById("cardRankingVendedores");
  const tbody = document.getElementById("rankingVendedoresBody");

  if (role !== "Diretor") {
    card.style.display = "none";
    return;
  }

  card.style.display = "block";

  const mapa = {};

  propostas.forEach((p) => {
    const vendedor = p.criador || "Sem vendedor";

    if (!mapa[vendedor]) {
      mapa[vendedor] = {
        vendedor,
        total: 0,
        aprovadas: 0,
        valorAprovado: 0,
      };
    }

    mapa[vendedor].total += 1;

    if (String(p.status || "").toLowerCase() === "aprovada") {
      mapa[vendedor].aprovadas += 1;
      mapa[vendedor].valorAprovado += Number(p.valor_total || 0);
    }
  });

  const ranking = Object.values(mapa).sort((a, b) => {
    return b.valorAprovado - a.valorAprovado;
  });

  if (ranking.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Nenhum dado encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ranking
    .map((item, index) => {
      const conversao =
        item.total > 0 ? ((item.aprovadas / item.total) * 100).toFixed(1) : 0;

      return `
      <div class="ranking-item">
        <div class="ranking-vendedor">
          <strong><span class="ranking-posicao">${index + 1}.</span>${escapeHTML(item.vendedor)}</strong>
        </div>

        <div class="ranking-metrica">
          <span>Propostas</span>
          <strong>${item.total}</strong>
        </div>

        <div class="ranking-metrica">
          <span>Aprovadas</span>
          <strong>${item.aprovadas}</strong>
        </div>

        <div class="ranking-metrica">
          <span>Conversão</span>
          <strong>${conversao}%</strong>
        </div>

        <div class="ranking-metrica">
          <span>Valor aprovado</span>
          <strong>${formatarMoeda(item.valorAprovado)}</strong>
        </div>
      </div>
    `;
    })
    .join("");
}
