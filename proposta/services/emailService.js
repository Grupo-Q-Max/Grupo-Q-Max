const nodemailer = require("nodemailer");
const https = require("https");
const dotenv = require("dotenv");

dotenv.config();

// Nome de cliente, justificativa etc. vêm de formulário: escapar antes de pôr no HTML do e-mail
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

// Configuração do Transporter para o Outlook 365 Empresarial via OAuth 2.0 (Fallback)
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL_USER,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    accessUrl: `https://login.microsoftonline.com/${process.env.OAUTH_TENANT_ID}/oauth2/v2.0/token`,
  },
  // STARTTLS com os padrões do Node (TLS 1.2+); "SSLv3" era obsoleto
  requireTLS: true,
});

/**
 * Envia e-mail via API HTTP da Resend (Zero dependências, 100% seguro)
 */
async function enviarViaResend(mailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || mailOptions.from || "FINORA <noreply@grupoqmax.com.br>";
  const payload = {
    from: fromEmail,
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html,
    ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {})
  };

  const bodyStr = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr)
        }
      },
      (res) => {
        let resData = "";
        res.on("data", (chunk) => { resData += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(resData));
            } catch (e) {
              resolve({ success: true, raw: resData });
            }
          } else {
            reject(new Error(`Resend HTTP ${res.statusCode}: ${resData}`));
          }
        });
      }
    );

    req.on("error", reject);
    // Sem timeout, API parada segurava a requisição do cliente (aprovar/assinar) indefinidamente
    req.setTimeout(20000, () => req.destroy(new Error("Timeout de 20s na chamada externa")));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Disparador de e-mail híbrido e resiliente
 */
async function dispararEmail(mailOptions) {
  // 1. Tentar primeiro via Resend se houver chave configurada
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith("re_")) {
    try {
      console.log(`[EmailService] Enviando e-mail via Resend para ${mailOptions.to}...`);
      const res = await enviarViaResend(mailOptions);
      console.log(`[EmailService] E-mail entregue com sucesso via Resend! ID:`, res.id || "ok");
      return res;
    } catch (resendError) {
      console.warn(`[EmailService] Falha no Resend (${resendError.message}). Tentando fallback SMTP...`);
    }
  }

  // 2. Fallback: Envio via Nodemailer / Outlook SMTP
  // Sem conta OAuth configurada (ex.: ambiente de teste) não conecta no Outlook: falharia com 530 de qualquer jeito
  if (!process.env.EMAIL_USER || !process.env.OAUTH_REFRESH_TOKEN) {
    console.warn("[EmailService] Nenhum provedor de e-mail configurado (Resend ou OAuth). E-mail não enviado.");
    return null;
  }
  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("[EmailService] Erro ao enviar e-mail via SMTP:", error.message);
    return null;
  }
}

/**
 * Retorna as configurações de branding para cada empresa
 */
function obterMarcaEmail(dados) {
  const tipo = String(
    dados.tipoProposta || dados.tipo_proposta || "finora",
  ).toLowerCase();
  const marcas = {
    finora: {
      nome: "FINORA",
      equipe: "Equipe Comercial FINORA",
      cor: "#663399",
      from: "FINORA Comerciais",
    },
    contabil: {
      nome: "QMAX Contábil",
      equipe: "Equipe Comercial QMAX Contábil",
      cor: "#12c8c2",
      from: "QMAX Contábil",
    },
    tech: {
      nome: "QMAX Tech",
      equipe: "Equipe Comercial QMAX Tech",
      cor: "#315cff",
      from: "QMAX Tech",
    },
    auditoria: {
      nome: "QMAX Auditoria",
      equipe: "Equipe QMAX Auditoria",
      cor: "#0f766e",
      from: "QMAX Auditoria",
    },
    lagerhaus: {
      nome: "Lagerhaus",
      equipe: "Equipe de Operações Lagerhaus",
      cor: "#c2410c",
      from: "Lagerhaus",
    }
  };

  return marcas[tipo] || marcas.finora;
}

/**
 * Envia o e-mail para o cliente com o LINK de acesso à proposta
 */
async function enviarEmailLink(dados, linkAcesso) {
  const marca = obterMarcaEmail(dados);

  const mailOptions = {
    from: `${marca.from} <${process.env.EMAIL_USER || "comercial@finora.com.br"}>`,
    to: dados.email,
    subject: `${marca.nome} - Proposta Comercial Nº ${dados.numeroProposta || dados.numero_proposta} para ${dados.nomeClinica || dados.nome_clinica}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 32px; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: ${marca.cor}; margin: 0; font-size: 24px;">Olá, ${esc(dados.nomeSocio || dados.nome_socio || "Prezado(a)")}!</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Agradecemos a confiança e o interesse em nossas soluções corporativas.</p>
        </div>

        <p style="font-size: 14.5px; line-height: 1.6; color: #334155;">
          A sua <strong>Proposta Comercial Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</strong> para a <strong>${esc(dados.nomeClinica || dados.nome_clinica)}</strong> foi gerada com condições exclusivas e está disponível em nosso ambiente seguro.
        </p>
        
        <div style="margin: 32px 0; text-align: center;">
          <a href="${esc(linkAcesso)}" style="background-color: ${marca.cor}; color: white; padding: 16px 36px; text-decoration: none; border-radius: 999px; font-size: 15px; font-weight: bold; display: inline-block; box-shadow: 0 4px 14px rgba(0,0,0,0.15);">
            📄 Visualizar Proposta na Íntegra ➔
          </a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          🔒 Por segurança, este link é exclusivo e confidencial da sua clínica.
        </p>

        <br>

        <p style="font-size: 13.5px; color: #475569; text-align: center; margin: 0;">
          Atenciosamente,<br>
          <strong>${esc(marca.equipe)}</strong>
        </p>
      </div>
    `,
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia notificação interna quando o cliente aprovar a proposta
 */
async function notificarHugo(dadosProposta) {
  const marca = obterMarcaEmail(dadosProposta);

  const mailOptions = {
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: process.env.NOTIFY_EMAIL || "rodrigo@grupoqmax.com.br",
    subject: `✅ PROPOSTA APROVADA: ${dadosProposta.nome_clinica} (Nº ${dadosProposta.numero_proposta})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; border-radius: 10px; background: #ffffff;">
        <h2 style="color: #16a34a; margin-top: 0;">🎉 Proposta Comercial Aprovada!</h2>
        <p>O cliente <strong>${esc(dadosProposta.nome_clinica)}</strong> acabou de dar o "De Acordo" na proposta eletrônica através da plataforma ${esc(marca.nome)}.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
        <ul style="line-height: 1.8; color: #334155; font-size: 14px;">
          <li><strong>Número da Proposta:</strong> ${esc(dadosProposta.numero_proposta)}</li>
          <li><strong>Responsável / Sócio:</strong> ${esc(dadosProposta.nome_socio || "-")}</li>
          <li><strong>Telefone / WhatsApp:</strong> ${esc(dadosProposta.telefone || "-")}</li>
          <li><strong>Valor Total:</strong> R$ ${Number(dadosProposta.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
        </ul>
        <p style="font-size: 13px; color: #64748b;">Acesse o painel do dashboard para acompanhar o processo de onboarding do cliente.</p>
      </div>
    `,
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia notificação para a diretoria sobre solicitação de desconto > 20%
 */
async function notificarAdminsSolicitacaoDesconto(adminEmails, dados) {
  if (!adminEmails || adminEmails.length === 0) return;
  const marca = obterMarcaEmail(dados);
  const descontosHtml = (dados.itens || [])
    .filter((item) => Number(item.descontoPercentual || 0) > 20)
    .map(
      (item) => `
        <li style="margin-bottom: 8px;">
          <strong>${esc(item.servico)}</strong><br>
          Valor original: R$ ${esc(Number(item.valorOriginal || 0).toFixed(2))} | Desconto: <strong>${esc(item.descontoPercentual)}%</strong> | Valor final: R$ ${esc(Number(item.valor || 0).toFixed(2))}
        </li>
      `,
    )
    .join("");

  const mailOptions = {
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: adminEmails.join(","),
    subject: `⚠️ Solicitação de desconto acima de 20% - ${dados.nomeClinica}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; border-radius: 8px;">
        <h2 style="color: #ef4444; margin-top: 0;">Solicitação de Desconto Pendente</h2>
        <p>Uma proposta foi criada com desconto acima de 20% e requer aprovação da diretoria.</p>
        <ul style="line-height: 1.6; font-size: 14px;">
          <li><strong>Clínica:</strong> ${esc(dados.nomeClinica)}</li>
          <li><strong>Responsável:</strong> ${esc(dados.nomeSocio || "-")}</li>
          <li><strong>Email do cliente:</strong> ${esc(dados.email)}</li>
          <li><strong>Justificativa:</strong> ${esc(dados.justificativaDesconto || "Não informada")}</li>
        </ul>
        <h3>Itens com desconto solicitado:</h3>
        <ul style="line-height: 1.6; font-size: 13.5px;">
          ${descontosHtml}
        </ul>
        <p>Acesse o painel administrativo da <strong>${esc(marca.nome)}</strong> para aprovar ou recusar.</p>
      </div>
    `,
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia o e-mail de assinatura com link direto do D4Sign
 */
async function enviarEmailAssinatura(dados, linkAssinatura) {
  const marca = obterMarcaEmail(dados);

  const mailOptions = {
    from: `${marca.from} <${process.env.EMAIL_USER || "comercial@finora.com.br"}>`,
    to: dados.email,
    subject: `Assinatura Eletrônica do Contrato - ${marca.nome} (Proposta Nº ${dados.numeroProposta || dados.numero_proposta})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; border-radius: 12px; text-align: center;">
        <h2 style="color: ${marca.cor};">Olá, ${esc(dados.nomeSocio || dados.nome_socio || "Prezado(a)")}!</h2>
        <p>A sua <strong>Proposta Comercial Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</strong> está pronta para assinatura digital via <strong>D4Sign</strong>.</p>
        <div style="margin: 32px 0;">
          <a href="${esc(linkAssinatura)}" style="background-color: ${marca.cor}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: bold; display: inline-block;">
            ✍️ Assinar Contrato Eletronicamente
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b;">A assinatura digital possui validade jurídica integral (MP nº 2.200-2/2001).</p>
      </div>
    `,
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia e-mail de confirmação ao cliente de que o contrato foi assinado
 */
async function enviarEmailAssinaturaConcluidaCliente(dados) {
  const marca = obterMarcaEmail(dados);
  const mailOptions = {
    from: `${marca.from} <${process.env.EMAIL_USER || "comercial@finora.com.br"}>`,
    to: dados.email,
    subject: `Contrato Assinado com Sucesso! - ${marca.nome}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; border-radius: 12px; text-align: center;">
        <h2 style="color: #16a34a;">Assinatura Concluída com Sucesso! 🎉</h2>
        <p>Olá, ${esc(dados.nomeSocio || dados.nome_socio || "Prezado(a)")}!</p>
        <p>Confirmamos que a assinatura eletrônica da sua <strong>Proposta/Contrato Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</strong> foi finalizada via <strong>D4Sign</strong>.</p>
        <p>Uma cópia completa assinada foi enviada ao seu e-mail.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 14px;">Seja muito bem-vindo à <strong>${esc(marca.nome)}</strong>!</p>
      </div>
    `
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia e-mail de aviso ao vendedor responsável
 */
async function enviarEmailAssinaturaConcluidaComercial(dados, vendedorEmail, vendedorNome) {
  const marca = obterMarcaEmail(dados);
  const mailOptions = {
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: vendedorEmail,
    subject: `🔥 FECHOU! Proposta Nº ${dados.numeroProposta || dados.numero_proposta} assinada - ${dados.nomeClinica || dados.nome_clinica}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 25px; border-radius: 8px;">
        <h2 style="color: #16a34a; margin-top:0;">Parabéns, ${esc(vendedorNome)}! 🚀</h2>
        <p>O cliente <strong>${esc(dados.nomeClinica || dados.nome_clinica)}</strong> concluiu todas as assinaturas do contrato via D4Sign.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <ul style="line-height: 1.6; font-size:14px; padding-left:20px;">
          <li><strong>Proposta/Contrato:</strong> Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</li>
          <li><strong>Cliente/Empresa:</strong> ${esc(dados.nomeClinica || dados.nome_clinica)}</li>
          <li><strong>Sócio Responsável:</strong> ${esc(dados.nomeSocio || dados.nome_socio || "-")}</li>
          <li><strong>E-mail:</strong> ${esc(dados.email)}</li>
        </ul>
        <p>O lead foi atualizado como <strong>Ganho</strong> no CRM.</p>
      </div>
    `
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia e-mail de notificação para a diretoria quando um contrato é enviado ao D4Sign para assinatura
 */
async function enviarEmailContratoEnviadoD4SignDiretores(dados, uuidDocumento, linkAssinatura) {
  const defaultEmails = ["hugo@grupoqmax.com.br", "thiago.freitas@grupoqmax.com.br"];
  const marca = obterMarcaEmail(dados);
  
  const mailOptions = {
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: defaultEmails.join(","),
    subject: `📄 PROPOSTA/CONTRATO ENVIADO AO D4SIGN: ${dados.nomeClinica || dados.nome_clinica} (Nº ${dados.numeroProposta || dados.numero_proposta})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 25px; border-radius: 8px;">
        <h2 style="color: #315cff; margin-top:0; border-bottom: 2px solid #315cff; padding-bottom:10px;">Contrato Enviado para Assinatura no D4Sign</h2>
        <p>A proposta <strong>Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</strong> para a empresa <strong>${esc(dados.nomeClinica || dados.nome_clinica)}</strong> foi formalizada e o Contrato de Prestação de Serviços foi enviado para a D4Sign.</p>
        <ul style="line-height: 1.6; font-size:14px; padding-left:20px;">
          <li><strong>Empresa/Vertical:</strong> ${esc(marca.nome)}</li>
          <li><strong>Cliente/Empresa:</strong> ${esc(dados.nomeClinica || dados.nome_clinica)}</li>
          <li><strong>Sócio Responsável:</strong> ${esc(dados.nomeSocio || dados.nome_socio || "-")}</li>
          <li><strong>E-mail do Cliente:</strong> ${esc(dados.email)}</li>
          <li><strong>Valor Total:</strong> R$ ${Number(dados.valor_total || dados.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
          <li><strong>UUID D4Sign:</strong> ${esc(uuidDocumento || "-")}</li>
        </ul>
        ${linkAssinatura ? `<p style="margin-top: 15px;"><a href="${esc(linkAssinatura)}" style="background-color: #315cff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver Link de Assinatura</a></p>` : ""}
      </div>
    `
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia e-mail de notificação para a diretoria (Hugo, Thiago e Diretores) quando o contrato for assinado
 */
async function enviarEmailAssinaturaConcluidaDiretores(dados, adminEmails = []) {
  const defaultEmails = ["hugo@grupoqmax.com.br", "thiago.freitas@grupoqmax.com.br"];
  let emailsSet = new Set(defaultEmails);
  if (Array.isArray(adminEmails)) {
    adminEmails.forEach((e) => { if (e && e.includes("@")) emailsSet.add(e.trim()); });
  } else if (typeof adminEmails === "string" && adminEmails.includes("@")) {
    emailsSet.add(adminEmails.trim());
  }
  const destinatarios = Array.from(emailsSet);

  const marca = obterMarcaEmail(dados);
  const mailOptions = {
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: destinatarios.join(","),
    subject: `✅ CONTRATO ASSINADO E CONCLUÍDO: ${dados.nomeClinica || dados.nome_clinica} (${marca.nome})`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 25px; border-radius: 8px;">
        <h2 style="color: #16a34a; margin-top:0; border-bottom: 2px solid #16a34a; padding-bottom:10px;">🎉 Contrato Assinado com Sucesso!</h2>
        <p>Informamos que o contrato referente à proposta <strong>Nº ${esc(dados.numeroProposta || dados.numero_proposta)}</strong> foi <strong>100% assinado eletronicamente via D4Sign</strong>.</p>
        <ul style="line-height: 1.6; font-size:14px; padding-left:20px;">
          <li><strong>Empresa/Vertical:</strong> ${esc(marca.nome)}</li>
          <li><strong>Cliente/Empresa:</strong> ${esc(dados.nomeClinica || dados.nome_clinica)}</li>
          <li><strong>Representante:</strong> ${esc(dados.nomeSocio || dados.nome_socio || "-")}</li>
          <li><strong>E-mail do Cliente:</strong> ${esc(dados.email)}</li>
          <li><strong>Valor Total:</strong> R$ ${Number(dados.valor_total || dados.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
        </ul>
        <p style="font-size: 13px; color: #16a34a; font-weight: bold; margin-top: 15px;">
          ✔ E-mail de confirmação e Kit de Onboarding também foram enviados para o cliente.
        </p>
      </div>
    `
  };

  return await dispararEmail(mailOptions);
}

/**
 * Envia o Kit de Boas-Vindas e Onboarding para o cliente recém-contratado
 */
async function enviarEmailKitOnboardingBoasVindas(dados) {
  const marca = obterMarcaEmail(dados);
  const mailOptions = {
    from: `${marca.nome} <${process.env.EMAIL_USER || "comercial@finora.com.br"}>`,
    to: dados.email,
    subject: `🎉 Seja Bem-Vindo(a) à ${marca.nome}! - Kit de Boas-Vindas & Onboarding`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: ${marca.cor}; margin: 0; font-size: 26px;">Seja Muito Bem-Vindo(a)!</h1>
          <p style="color: #64748b; font-size: 15px; margin-top: 6px;">É uma honra ter a <strong>${esc(dados.nomeClinica || dados.nome_clinica)}</strong> como nossa parceira.</p>
        </div>

        <div style="background: #f8fafc; border-left: 4px solid ${marca.cor}; padding: 18px; border-radius: 8px; margin-bottom: 24px;">
          <strong style="font-size: 16px; color: #0f172a; display: block; margin-bottom: 8px;">📋 Próximos Passos para o Início da Operação:</strong>
          <ol style="margin: 0; padding-left: 20px; line-height: 1.8; color: #334155;">
            <li><strong>Envio de Documentos Básicos:</strong> Contrato Social, cartão CNPJ e comprovante de endereço.</li>
            <li><strong>Reunião de Alinhamento:</strong> Nosso time entrará em contato para agendar o alinhamento operacional.</li>
            <li><strong>Acesso ao Portal do Cliente:</strong> Você receberá os acessos do nosso sistema em até 24 horas.</li>
          </ol>
        </div>

        <p style="color: #475569; line-height: 1.6;">Estamos prontos para otimizar os seus resultados e garantir a gestão perfeita da sua clínica.</p>
        
        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
          ${esc(marca.nome)} • Todos os direitos reservados.
        </div>
      </div>
    `
  };

  return await dispararEmail(mailOptions);
}

/**
 * Alerta interno: cliente aprovou, mas o contrato não chegou ao D4Sign (precisa envio manual)
 */
async function notificarFalhaContrato(dadosProposta, motivo) {
  const marca = obterMarcaEmail(dadosProposta);

  return await dispararEmail({
    from: `${marca.nome} Sistema <${process.env.EMAIL_USER || "sistema@finora.com.br"}>`,
    to: process.env.NOTIFY_EMAIL || "rodrigo@grupoqmax.com.br",
    subject: `⚠️ CONTRATO NÃO ENVIADO AO D4SIGN: ${dadosProposta.nome_clinica} (Nº ${dadosProposta.numero_proposta})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fecaca; padding: 24px; border-radius: 10px; background: #ffffff;">
        <h2 style="color: #b91c1c; margin-top: 0;">Contrato não foi gerado no D4Sign</h2>
        <p>O cliente <strong>${esc(dadosProposta.nome_clinica)}</strong> aprovou a proposta Nº ${esc(dadosProposta.numero_proposta)}, mas o envio do contrato para assinatura falhou. Envie o contrato manualmente.</p>
        <p style="font-size: 13px; color: #64748b;">Motivo técnico: ${esc(motivo)}</p>
      </div>
    `,
  });
}

module.exports = {
  enviarEmailLink,
  notificarHugo,
  notificarFalhaContrato,
  notificarAdminsSolicitacaoDesconto,
  enviarEmailAssinatura,
  enviarEmailContratoEnviadoD4SignDiretores,
  enviarEmailAssinaturaConcluidaCliente,
  enviarEmailAssinaturaConcluidaComercial,
  enviarEmailAssinaturaConcluidaDiretores,
  enviarEmailKitOnboardingBoasVindas,
};

