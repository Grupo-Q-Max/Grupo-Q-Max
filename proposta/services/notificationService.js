class NotificationService {
  constructor() {
    this.clients = [];
  }

  addClient(client) {
    this.clients.push(client);
  }

  removeClient(clientId) {
    this.clients = this.clients.filter(c => c.id !== clientId);
  }

  // Diretor recebe tudo; Comercial só recebe eventos dos registros de que é dono (ids em `donos`).
  // Sem `donos` (ex.: pedido de desconto para a diretoria) o evento não vai para nenhum Comercial.
  enviarNotificacao(evento, dados, donos = []) {
    const idsDonos = donos.filter((id) => id != null).map(Number);
    const destinatarios = this.clients.filter(
      (client) => client.role !== "Comercial" || idsDonos.includes(Number(client.userId))
    );
    destinatarios.forEach(client => {
      try {
        client.res.write(`event: ${evento}\n`);
        client.res.write(`data: ${JSON.stringify(dados)}\n\n`);
        // compression() segura o stream em buffer; sem flush o evento não chega ao navegador
        if (typeof client.res.flush === "function") client.res.flush();
      } catch (e) {
        console.error("Erro ao enviar SSE para cliente:", client.id, e);
      }
    });
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;
