const db = require("../config/db");

class WhatsAppService {
  /**
   * Obtém a configuração ativa de WhatsApp (banco de dados ou .env)
   */
  async obterConfiguracao() {
    try {
      const rows = await db.executarQuery(
        "SELECT chave, valor FROM configuracoes_sistema WHERE chave IN ('whatsapp_api_url', 'whatsapp_api_key', 'whatsapp_instance', 'whatsapp_ativo')"
      );

      const configs = {};
      rows.forEach((r) => {
        configs[r.chave] = r.valor;
      });

      return {
        ativo: configs.whatsapp_ativo === "1" || configs.whatsapp_ativo === "true" || process.env.WHATSAPP_AUTO_SEND === "true",
        apiUrl: configs.whatsapp_api_url || process.env.WHATSAPP_API_URL || "",
        apiKey: configs.whatsapp_api_key || process.env.WHATSAPP_API_KEY || "",
        instance: configs.whatsapp_instance || process.env.WHATSAPP_INSTANCE || ""
      };
    } catch (err) {
      return {
        ativo: process.env.WHATSAPP_AUTO_SEND === "true",
        apiUrl: process.env.WHATSAPP_API_URL || "",
        apiKey: process.env.WHATSAPP_API_KEY || "",
        instance: process.env.WHATSAPP_INSTANCE || ""
      };
    }
  }

  /**
   * Formata número de telefone para o padrão internacional (5511999999999)
   */
  formatarNumero(telefone) {
    if (!telefone) return "";
    let limpo = String(telefone).replace(/\D/g, "");
    if (limpo.length === 10 || limpo.length === 11) {
      limpo = "55" + limpo;
    }
    return limpo;
  }

  /**
   * Envia uma mensagem de texto via gateway HTTP (Evolution API, Z-API, WPPConnect, etc.)
   */
  async enviarMensagemTexto(telefone, texto) {
    const config = await this.obterConfiguracao();
    const numeroFormatado = this.formatarNumero(telefone);

    if (!numeroFormatado || !texto) {
      return { sucesso: false, erro: "Telefone ou texto inválido." };
    }

    if (!config.ativo || !config.apiUrl) {
      console.log(`[WhatsApp Bot] Disparo automático desativado ou API não configurada. Mensagem simulada para ${numeroFormatado}`);
      // sucesso:false: o follow-up não grava a etapa como enviada e manda de verdade quando o WhatsApp for ligado
      return { sucesso: false, simulado: true, numero: numeroFormatado };
    }

    try {
      let url = "";
      let headers = { "Content-Type": "application/json" };
      let bodyPayload = {};

      const isZapi = config.apiUrl.includes("z-api.io") || config.apiUrl.includes("zapi");

      if (isZapi) {
        // Formato oficial Z-API
        const baseUrl = config.apiUrl.replace(/\/$/, "");
        url = baseUrl.includes("/send-text")
          ? baseUrl
          : `${baseUrl}/instances/${config.instance}/token/${config.apiKey}/send-text`;
        
        headers["Client-Token"] = config.apiKey;
        bodyPayload = {
          phone: numeroFormatado,
          message: texto
        };
      } else {
        // Formato Evolution API / WPPConnect / Genérico
        url = config.instance 
          ? `${config.apiUrl.replace(/\/$/, "")}/message/sendText/${config.instance}`
          : `${config.apiUrl.replace(/\/$/, "")}/send-text`;

        headers["apikey"] = config.apiKey;
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        bodyPayload = {
          number: numeroFormatado,
          text: texto,
          message: texto
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        // Sem timeout, gateway travado segurava a varredura de follow-up indefinidamente
        signal: AbortSignal.timeout(15000)
      });

      const data = await response.json();

      if (!response.ok) {
        console.warn(`[WhatsApp Bot] Erro retornado pela API:`, data);
        return { sucesso: false, erro: data.message || data.error || "Erro no gateway WhatsApp." };
      }

      console.log(`[WhatsApp Bot] Mensagem enviada com sucesso para ${numeroFormatado}`);
      return { sucesso: true, data };
    } catch (error) {
      console.error(`[WhatsApp Bot] Falha na requisição:`, error.message);
      return { sucesso: false, erro: error.message };
    }
  }

  /**
   * Disparo automático da proposta quando gerada
   */
  async enviarPropostaAutomatica(proposta, linkPublico) {
    const telefone = proposta.telefone;
    if (!telefone) return;

    const nomeSocio = (proposta.nome_socio || proposta.nomeSocio || "").trim();
    const primeiroNome = nomeSocio ? nomeSocio.split(" ")[0] : "Cliente";
    const nomeClinica = proposta.nome_clinica || proposta.nomeClinica || "sua clínica";
    const empresa = (proposta.tipo_proposta || proposta.tipoProposta || "FINORA").toUpperCase();
    // Criação manda `total`; registros do banco têm `valor_total` ("0,00" virava R$ NaN)
    const total = proposta.valor_total ?? proposta.valorTotal ?? proposta.total ?? 0;
    const totalFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(total));

    const texto = `Olá, *${primeiroNome}*! Tudo bem?\n\nSua proposta comercial personalizada para a *${nomeClinica}* (${empresa}) foi gerada com sucesso.\n\n📋 *Investimento:* ${totalFmt}\n🔗 *Acesse o link seguro para visualizar e assinar na tela:*\n${linkPublico}\n\nCondições comerciais com validade garantida de 10 dias corridos. Qualquer dúvida, estou à disposição!`;

    return this.enviarMensagemTexto(telefone, texto);
  }

  /**
   * Disparo automático após o aceite/assinatura digital do cliente
   */
  async notificarAssinaturaRealizada(proposta) {
    const telefone = proposta.telefone;
    if (!telefone) return;

    const nomeClinica = proposta.nome_clinica || proposta.nomeClinica || "sua clínica";
    const empresa = (proposta.tipo_proposta || proposta.tipoProposta || "FINORA").toUpperCase();

    const texto = `🎉 *Parabéns!* A proposta da *${nomeClinica}* foi aprovada e assinada com sucesso!\n\nSeja muito bem-vindo(a) ao ecossistema *${empresa}*. Nossa equipe de onboarding iniciará o processo de implantação para cuidar da sua rotina contábil e tributária. Conte conosco!`;

    return this.enviarMensagemTexto(telefone, texto);
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
