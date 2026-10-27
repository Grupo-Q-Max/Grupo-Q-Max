// assets/js/notifications.js

// Função para carregar e exibir as notificações
function carregarNotificacoes() {
  $.ajax({
    url: "obter_notificacoes.php",
    method: "GET",
    dataType: "json",
    success: function (response) {
      if (response.success) {
        // Atualiza o contador
        $(".notification-badge").text(response.total_pendentes);
        $(".notification-count").text(response.total_notificacoes);

        // Preenche a lista de notificações
        const lista = $(".notifications-list");
        lista.empty();
        if (response.notificacoes.length > 0) {
          response.notificacoes.forEach((notificacao) => {
            const classe = notificacao.lida === "0" ? "unread" : "";
            lista.append(`
                            <div class="notification-item ${classe}" data-id="${
              notificacao.id
            }">
                                <p>${notificacao.mensagem}</p>
                                <small>${new Date(
                                  notificacao.data_criacao
                                ).toLocaleString()}</small>
                                ${
                                  notificacao.lida === "0"
                                    ? '<div class="pending-flag">Nova</div>'
                                    : ""
                                }
                            </div>
                        `);
          });
        } else {
          lista.append(
            '<div class="empty-message">Nenhuma notificação por enquanto.</div>'
          );
        }
      }
    },
    error: function () {
      console.error("Erro ao carregar notificações.");
    },
  });
}
