$(document).ready(function () {
  // --- LÓGICA DO TEMA ESCURO ---
  const themeToggle = $("#themeToggle");
  const htmlTag = $("html");

  // Função para trocar o ícone (lua/sol)
  function updateThemeIcon(theme) {
    const icon = themeToggle.find("i");
    if (theme === "dark") {
      icon.removeClass("fa-moon").addClass("fa-sun");
    } else {
      icon.removeClass("fa--sun").addClass("fa-moon");
    }
  }

  const savedTheme = localStorage.getItem("theme") || "light";
  htmlTag.attr("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.on("click", function () {
    const currentTheme = htmlTag.attr("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";

    htmlTag.attr("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
  });

  function enviarHeartbeat() {
    $.ajax({
      url: "atualizar_sessao.php",
      method: "POST",
      dataType: "json",
    });
  }
  setTimeout(enviarHeartbeat, 2000);
  setInterval(enviarHeartbeat, 60000);
});
$(document).ready(function () {
  // Abrir Modal Sped Anual (Apenas Dezembro)
  $(".data-table").on("click", ".sped-anual-trigger", function () {
    const id = $(this).closest("tr").data("id");

    $("#modalSpedAnual").addClass("active");
    $("#sped_anual_id").val(id);

    // Limpa checkboxes
    $(".check-mes-sped").prop("checked", false);

    // Carrega dados salvos
    $.getJSON(
      "assets/backend/obter_detalhes_sped_anual.php",
      { id: id },
      function (res) {
        if (res.success && res.dados) {
          // res.dados é um array com os números dos meses [1, 2, 5...]
          // Se for objeto JSON, iteramos as chaves
          $.each(res.dados, function (key, val) {
            // Marca o checkbox cujo value é igual ao mês salvo
            $(`.check-mes-sped[value="${val}"]`).prop("checked", true);
          });
        }
      }
    );
  });

  // Botão Marcar Todos
  $("#btnMarcarTodosSped").on("click", function () {
    const checkboxes = $(".check-mes-sped");
    const todosMarcados =
      checkboxes.length === checkboxes.filter(":checked").length;
    checkboxes.prop("checked", !todosMarcados);
  });

  // Salvar Sped Anual
  // --- AQUI ESTÁ A CORREÇÃO MÁGICA ---
  // Usamos .off('submit') para limpar cliques antigos acumulados
  $("#formSpedAnual")
    .off("submit")
    .on("submit", function (e) {
      e.preventDefault();

      const idControle = $("#sped_anual_id").val();

      // 1. Coleta manualmente quais meses estão marcados
      var mesesMarcados = [];
      $(".check-mes-sped:checked").each(function () {
        mesesMarcados.push($(this).val());
      });

      var textoStatusParaEnviar = "";
      var isCompleto = mesesMarcados.length === 12;

      // 2. Lógica do Prompt
      if (isCompleto) {
        var hoje = new Date();
        var dia = String(hoje.getDate()).padStart(2, "0");
        var mes = String(hoje.getMonth() + 1).padStart(2, "0");
        var ano = hoje.getFullYear();
        var dataSugestao = dia + "/" + mes + "/" + ano;

        var inputUsuario = prompt(
          "Todos os meses foram selecionados!\nInforme a data de entrega:",
          dataSugestao
        );

        if (inputUsuario === null) {
          return; // Cancelou
        }

        var dataFinal =
          inputUsuario.trim() === "" ? dataSugestao : inputUsuario.trim();
        textoStatusParaEnviar = "OK - " + dataFinal;
      } else {
        textoStatusParaEnviar = "Pendente (" + mesesMarcados.length + "/12)";
      }

      // 3. Envia para o PHP
      $.ajax({
        url: "assets/backend/salvar_detalhes_sped_anual.php",
        method: "POST",
        data: {
          id_controle: idControle,
          meses: mesesMarcados,
          status_formatado: textoStatusParaEnviar,
        },
        dataType: "json",
        success: function (res) {
          if (res.success) {
            $("#modalSpedAnual").removeClass("active");

            const cell = $(
              `.data-table tr[data-id="${idControle}"] td[data-coluna="sped_contribuicao"]`
            );

            if (res.completo) {
              cell.html(
                '<span class="badge bg-success">' + res.novo_status + "</span>"
              );
            } else {
              cell.html(
                `<span class="badge bg-warning text-dark">${res.novo_status}</span>`
              );
            }
          } else {
            alert("Erro ao salvar: " + res.message);
          }
        },
        error: function () {
          alert("Erro de comunicação ao salvar.");
        },
      });
    });
});
