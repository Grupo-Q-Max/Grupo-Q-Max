const https = require("https");
const http = require("http");

class TeamsService {
  constructor() {
    this.webhookUrl = process.env.TEAMS_WEBHOOK_URL || "";
  }

  setWebhookUrl(url) {
    this.webhookUrl = url;
  }

  async enviarNotificacaoTeams(tipo, payload = {}) {
    const url = this.webhookUrl || process.env.TEAMS_WEBHOOK_URL;
    if (!url || !url.startsWith("http")) {
      return { skipped: true, reason: "TEAMS_WEBHOOK_URL não configurada." };
    }

    let card = null;

    if (tipo === "aprovada") {
      const valorTotal = payload.valorTotal || payload.valor_total ? Number(payload.valorTotal || payload.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00";
      const valorMensal = payload.investimentoMensal || payload.investimento_mensal ? Number(payload.investimentoMensal || payload.investimento_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";

      card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "107C41", // Verde Microsoft
        "summary": `🎉 CONTRATO FECHADO: ${payload.nomeClinica}`,
        "sections": [{
          "activityTitle": `🎉 **CONTRATO FECHADO & ASSINADO!**`,
          "activitySubtitle": `Unidade: ${payload.tipoProposta || 'FINORA'} | Proposta #${payload.numeroProposta || payload.id}`,
          "activityImage": "https://img.icons8.com/color/96/handshake.png",
          "facts": [
            { "name": "🏥 Clínica:", "value": payload.nomeClinica || "-" },
            { "name": "👤 Responsável:", "value": payload.nomeSocio || "Signatário" },
            { "name": "💰 Mensalidade:", "value": valorMensal },
            { "name": "💎 Valor Total:", "value": valorTotal },
            { "name": "📅 Data de Fechamento:", "value": new Date().toLocaleString("pt-BR") }
          ],
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "👁️ Ver no Dashboard",
          "targets": [{ "os": "default", "uri": `${process.env.BASE_URL || 'http://localhost:3005'}/proposta/dashboard.html` }]
        }]
      };
    } else if (tipo === "visualizada") {
      card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0078D4", // Azul Microsoft
        "summary": `👁️ Proposta Visualizada: ${payload.nomeClinica}`,
        "sections": [{
          "activityTitle": `👁️ **Cliente Abriu a Proposta Agora!**`,
          "activitySubtitle": `Proposta #${payload.numeroProposta || payload.id} (${payload.tipoProposta || 'FINORA'})`,
          "facts": [
            { "name": "🏥 Clínica:", "value": payload.nomeClinica || "-" },
            { "name": "📱 Dispositivo:", "value": payload.dispositivo || "Navegador Web" },
            { "name": "🌐 IP do Acesso:", "value": payload.ip || "Detectado" },
            { "name": "⏰ Horário:", "value": new Date().toLocaleString("pt-BR") }
          ],
          "markdown": true
        }]
      };
    } else if (tipo === "reaberta" || tipo === "reabertura_quente") {
      card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF8C00", // Âmbar / Laranja Fogo
        "summary": `🔥 LEAD QUENTE: Reabertura da Proposta ${payload.nomeClinica}`,
        "sections": [{
          "activityTitle": `🔥 **LEAD QUENTE: O Cliente Reabriu a Proposta!**`,
          "activitySubtitle": `Proposta #${payload.numeroProposta || payload.id} (${payload.totalVisualizacoes || 2}º acesso)`,
          "facts": [
            { "name": "🏥 Clínica:", "value": payload.nomeClinica || "-" },
            { "name": "👤 Responsável:", "value": payload.nomeSocio || "Signatário" },
            { "name": "📱 Dispositivo:", "value": payload.dispositivo || "Navegador Web" },
            { "name": "💬 Timing:", "value": "Cliente está com a proposta aberta agora na tela!" },
            { "name": "⏰ Horário:", "value": new Date().toLocaleString("pt-BR") }
          ],
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "💬 Falar no WhatsApp",
          "targets": [{ "os": "default", "uri": `https://wa.me/55${(payload.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Olá Dr(a), tudo bem? Passando para saber se ficou com alguma dúvida sobre a proposta comercial da ' + (payload.nomeClinica || 'clínica') + '!')}` }]
        }]
      };
    } else if (tipo === "solicitacao_desconto") {
      card = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "D83B01", // Laranja Microsoft
        "summary": `⚠️ Solicitação de Desconto: ${payload.nomeClinica}`,
        "sections": [{
          "activityTitle": `⚠️ **Solicitação de Desconto para Aprovação**`,
          "activitySubtitle": `Proposta #${payload.numeroProposta || payload.id}`,
          "facts": [
            { "name": "🏥 Clínica:", "value": payload.nomeClinica || "-" },
            { "name": "👤 Vendedor:", "value": payload.vendedor || "Comercial" },
            { "name": "📉 Desconto:", "value": `${payload.percentual || 0}%` },
            { "name": "📝 Motivo:", "value": payload.justificativa || "Sem justificativa" }
          ],
          "markdown": true
        }],
        "potentialAction": [{
          "@type": "OpenUri",
          "name": "🔒 Avaliar no Painel Admin",
          "targets": [{ "os": "default", "uri": `${process.env.BASE_URL || 'http://localhost:3005'}/proposta/admin.html` }]
        }]
      };
    }

    if (!card) return;

    return new Promise((resolve) => {
      try {
        const bodyStr = JSON.stringify(card);
        const parsedUrl = new URL(url);
        const clientReq = (parsedUrl.protocol === "https:" ? https : http).request(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(bodyStr),
            },
          },
          (res) => {
            res.resume(); // descarta o corpo: sem isso o socket fica preso até o GC
            resolve({ success: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode });
          }
        );

        clientReq.on("error", (err) => {
          console.warn("[Teams Webhook] Erro ao disparar notificação:", err.message);
          resolve({ success: false, error: err.message });
        });
        clientReq.setTimeout(15000, () => clientReq.destroy(new Error("Timeout de 15s no webhook do Teams")));

        clientReq.write(bodyStr);
        clientReq.end();
      } catch (err) {
        console.warn("[Teams Webhook] Erro ao formatar requisição:", err.message);
        resolve({ success: false, error: err.message });
      }
    });
  }
}

const teamsService = new TeamsService();
module.exports = teamsService;
