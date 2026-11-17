const FormData = require("form-data");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const db = require("../config/db");
const emailService = require("./emailService");
const notificationService = require("./notificationService");
const teamsService = require("./teamsService");
const { ehUuidD4Sign } = require("./proposalHelpers");

const isPlaceholder = (val) => !val || val.startsWith("seu_") || val.includes("placeholder");
const normalizarEmail = (email) => String(email || "").trim().toLowerCase();

// Em teste, D4SIGN_EMAIL_INTERNO_TESTE troca os signatários internos por plus-addresses (usuario+apelido@dominio)
function emailInterno(email, apelido) {
  const teste = process.env.D4SIGN_EMAIL_INTERNO_TESTE;
  if (!teste) return email;
  const [usuario, dominio] = teste.split("@");
  return `${usuario}+${apelido}@${dominio}`;
}

/**
 * Obtém todas as configurações personalizadas da D4Sign armazenadas no banco,
 * com fallback inteligente para as variáveis de ambiente do .env.
 */
async function obterConfiguracoesD4Sign() {
  let rows = [];
  try {
    rows = await db.executarQuery(
      `SELECT chave, valor FROM configuracoes_sistema WHERE chave LIKE 'd4sign_%' OR chave = 'fluxo_d4sign'`
    );
  } catch (err) {
    console.warn("⚠ Falha ao ler configuracoes_sistema para D4Sign, usando padrões:", err.message);
  }

  const cfg = {};
  if (Array.isArray(rows)) {
    rows.forEach((r) => {
      cfg[r.chave] = r.valor;
    });
  }

  const ambiente = cfg.d4sign_ambiente || (process.env.D4SIGN_API_URL?.includes("sandbox") ? "sandbox" : "live");
  const apiUrl = ambiente === "sandbox" ? "https://sandbox.d4sign.com.br/api/v1" : "https://secure.d4sign.com.br/api/v1";
  const portalUrl = ambiente === "sandbox" ? "https://sandbox.d4sign.com.br" : "https://secure.d4sign.com.br";
  const apiToken = cfg.d4sign_token || process.env.D4SIGN_API_TOKEN || "";
  const apiSecret = cfg.d4sign_secret || process.env.D4SIGN_API_SECRET || "";
  const uuidCofre = cfg.d4sign_cofre || process.env.D4SIGN_UUID_COFRE || "";
  const fluxo = cfg.d4sign_fluxo || cfg.fluxo_d4sign || "ordenado";
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3005}`;
  const basePath = process.env.APP_BASE_PATH || "/proposta";

  return {
    ambiente,
    apiUrl,
    portalUrl,
    apiToken,
    apiSecret,
    uuidCofre,
    fluxo,
    diasExpiracao: cfg.d4sign_expiracao_dias || "30",
    frequenciaLembrete: cfg.d4sign_lembrete_dias || "0",
    exigirSms: cfg.d4sign_exigir_sms === "1",
    exigirWhatsapp: cfg.d4sign_exigir_whatsapp === "1",
    exigirSelfie: cfg.d4sign_exigir_selfie === "1",
    exigirDocFoto: cfg.d4sign_exigir_doc_foto === "1",
    exigirIcp: cfg.d4sign_exigir_icp === "1",
    mensagemPersonalizada:
      cfg.d4sign_mensagem_personalizada ||
      "Por favor, realize a assinatura eletrônica do instrumento de prestação de serviços contábeis com a Finora.",
    emailRepresentante: cfg.d4sign_email_representante || process.env.EMAIL_REPRESENTANTE_QMAX || "contato@grupoqmax.com.br",
    nomeRepresentante: cfg.d4sign_nome_representante || "Representante Q-MAX / Finora",
    // Valor relativo salvo pela tela antiga ("/proposta/sucesso.html") vira absoluto no domínio do sistema
    urlRetorno: cfg.d4sign_url_retorno ? new URL(cfg.d4sign_url_retorno, baseUrl).href : `${baseUrl}${basePath}/sucesso.html`,
    baseUrl,
    basePath,
  };
}

/**
 * Realiza requisições HTTPS/HTTP nativas à API da D4Sign com suporte a JSON.
 */
function rawRequest(apiUrl, method, pathWithQuery, body = null, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const urlString = `${apiUrl}${pathWithQuery}`;
    const parsed = new URL(urlString);
    const lib = parsed.protocol === "https:" ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        Accept: "application/json",
      },
    };

    if (body) {
      const jsonBody = JSON.stringify(body);
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(jsonBody);
    }

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let parsedData;
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = data;
        }
        resolve({ statusCode: res.statusCode, data: parsedData });
      });
    });

    req.on("error", reject);
    // Sem timeout, API parada segurava a requisição do cliente (aprovar/assinar) indefinidamente
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout de ${timeoutMs / 1000}s na chamada externa`)));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Envia um documento PDF como form-data para o cofre da D4Sign.
 */
async function enviarDocumento(pdfBuffer, docName) {
  const config = await obterConfiguracoesD4Sign();

  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret) || isPlaceholder(config.uuidCofre)) {
    console.warn("⚠ Credenciais da D4Sign não configuradas ou são placeholders. Pulando envio real.");
    return "mocked_d4sign_doc_uuid_" + Date.now();
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error("PDF buffer está vazio. Não é possível enviar para a D4Sign.");
  }

  console.log(`[D4Sign] Enviando PDF (${(pdfBuffer.length / 1024).toFixed(1)} KB) para o cofre (${config.ambiente})...`);

  // Remove acentos convertendo ("VALIDAÇÃO" -> "VALIDACAO") em vez de apagar a letra
  const sanitizedName = docName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_\-\s#]/g, "");

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", pdfBuffer, {
      filename: `${sanitizedName}.pdf`,
      contentType: "application/pdf",
      knownLength: pdfBuffer.length,
    });

    const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
    const parsed = new URL(`${config.apiUrl}/documents/${config.uuidCofre}/upload?${authQuery}`);
    const lib = parsed.protocol === "https:" ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        ...form.getHeaders(),
        Accept: "application/json",
      },
    };

    const req = lib.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        let data;
        try {
          data = JSON.parse(body);
        } catch {
          return reject(new Error(`Resposta inesperada da D4Sign (status ${res.statusCode}): ${body.substring(0, 200)}`));
        }

        if (res.statusCode >= 400 || !data.uuid) {
          return reject(new Error(`Erro ao enviar documento para D4Sign: ${data.message || JSON.stringify(data)}`));
        }

        resolve(data.uuid);
      });
    });

    req.on("error", reject);
    // Sem timeout, API parada segurava a requisição do cliente (aprovar/assinar) indefinidamente
    req.setTimeout(60000, () => req.destroy(new Error("Timeout de 60s no upload para a D4Sign")));
    form.pipe(req);
  });
}

/**
 * Cadastra a lista de signatários do documento aplicando todas as regras de conformidade e segurança configuradas.
 */
async function cadastrarSignatarios(uuidDocumento, signatarios) {
  const config = await obterConfiguracoesD4Sign();

  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) {
    console.warn("⚠ Credenciais da D4Sign não configuradas ou são placeholders. Pulando cadastro de signatários.");
    // Mock: chaves falsas para o fluxo local seguir até o e-mail de assinatura
    return signatarios.map((s, idx) => ({ ...s, key_signer: `mocked_key_${uuidDocumento}_${idx}` }));
  }

  const signers = signatarios.map((s, idx) => {
    const signerObj = {
      email: s.email,
      act: String(s.act || 1),
      foreign: "0",
      certificadoicpbr: config.exigirIcp ? "1" : "0",
      assinatura_presencial: "0",
      url_retorno: config.urlRetorno,
      skipemail: "1",
    };

    // Segurança biométrica e foto de documento (apenas para signatários externos/clientes)
    if (idx === 0) {
      if (config.exigirSelfie) signerObj.liveness = "1";
      if (config.exigirDocFoto) signerObj.doc_photo = "1";
    }

    // Regras de Workflow (Ordem das Assinaturas)
    if (config.fluxo === "ordenado") {
      signerObj.workflow = String(idx + 1); // 1: Cliente, 2: Vendedor
    } else if (config.fluxo === "inverso") {
      signerObj.workflow = String(signatarios.length - idx); // Vendedor primeiro, depois Cliente
    }
    // Se fluxo for 'livre', não define workflow (ambos assinam simultâneo)

    // Notificação e autenticação por celular (SMS / WhatsApp)
    const tel = (s.telefone || "").replace(/\D/g, "");
    if (tel.length >= 10) {
      const numeroComDDI = tel.startsWith("55") ? tel : `55${tel}`;
      if (config.exigirSms) {
        signerObj.sms = "1";
        signerObj.celular = numeroComDDI;
      }
      if (config.exigirWhatsapp) {
        signerObj.whatsapp = "1";
        signerObj.celular = numeroComDDI;
      }
    }

    return signerObj;
  });

  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  const res = await rawRequest(
    config.apiUrl,
    "POST",
    `/documents/${uuidDocumento}/createlist?${authQuery}`,
    { signers }
  );

  if (
    res.statusCode >= 400 ||
    (Array.isArray(res.data) && res.data[0] && res.data[0].status === "error") ||
    (res.data && res.data.status === "error")
  ) {
    throw new Error(`Erro ao cadastrar signatários: ${JSON.stringify(res.data)}`);
  }

  return res.data && res.data.message ? res.data.message : [];
}

/**
 * Registra a URL do webhook no documento para receber callbacks de assinatura.
 */
async function registrarWebhook(uuidDocumento) {
  const config = await obterConfiguracoesD4Sign();

  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) {
    console.warn("⚠ Credenciais da D4Sign não configuradas ou são placeholders. Pulando registro de webhook.");
    return;
  }

  // Segredo próprio obrigatório: a cryptKey na URL ia parar na config da D4Sign e nos logs do proxy
  const segredo = process.env.D4SIGN_WEBHOOK_SECRET;
  if (!segredo || isPlaceholder(segredo)) {
    console.error("⚠ D4SIGN_WEBHOOK_SECRET não definido. Webhook não registrado: a proposta não muda sozinha ao assinar.");
    return;
  }
  const webhookUrl = `${config.baseUrl}/api/d4sign/webhook?secret=${encodeURIComponent(segredo)}`;
  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  const res = await rawRequest(
    config.apiUrl,
    "POST",
    `/documents/${uuidDocumento}/webhooks?${authQuery}`,
    { url: webhookUrl }
  );

  if (res.statusCode >= 400) {
    throw new Error(`Erro ao registrar webhook na D4Sign: ${res.data?.message || JSON.stringify(res.data)}`);
  }

  console.log(`[D4Sign] Webhook registrado com sucesso: ${webhookUrl.split("?")[0]}`);
}

/**
 * Envia o documento para assinatura aos signatários.
 */
async function enviarParaAssinatura(uuidDocumento) {
  const config = await obterConfiguracoesD4Sign();

  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) {
    console.warn("⚠ Credenciais da D4Sign não configuradas ou são placeholders. Pulando disparo de assinatura.");
    return;
  }

  const payload = {
    message: config.mensagemPersonalizada,
    skip_email: "0",
    workflow: config.fluxo === "livre" ? "0" : "1",
  };

  if (config.diasExpiracao && Number(config.diasExpiracao) > 0) {
    payload.days_expiration = String(config.diasExpiracao);
  }

  if (config.frequenciaLembrete && Number(config.frequenciaLembrete) > 0) {
    payload.reminder = String(config.frequenciaLembrete);
  }

  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  let erro;
  try {
    // Conta live levou mais de 20s para responder (validação de 28/10), mesmo tendo enviado: 60s aqui
    const res = await rawRequest(
      config.apiUrl,
      "POST",
      `/documents/${uuidDocumento}/sendtosigner?${authQuery}`,
      payload,
      60000
    );
    if (res.statusCode < 400) return;
    erro = new Error(`Erro ao disparar envio para assinatura: ${res.data?.message || JSON.stringify(res.data)}`);
  } catch (e) {
    erro = e;
  }

  // Timeout ou 5xx nem sempre é falha: a D4Sign às vezes envia e só responde depois (ou responde 500)
  if ((await statusIdDocumento(uuidDocumento).catch(() => null)) === "3") {
    console.warn(`[D4Sign] sendtosigner respondeu com erro (${erro.message}), mas o documento já está "Aguardando Assinaturas". Seguindo.`);
    return;
  }
  throw erro;
}

// statusId do documento na D4Sign (string) ou null se a consulta falhar
async function statusIdDocumento(uuidDocumento) {
  const config = await obterConfiguracoesD4Sign();
  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  const res = await rawRequest(config.apiUrl, "GET", `/documents/${uuidDocumento}?${authQuery}`);
  const doc = Array.isArray(res.data) ? res.data[0] : res.data;
  if (res.statusCode >= 400 || !doc || doc.statusId == null) {
    console.warn(`[D4Sign] Status do documento ${uuidDocumento} indisponível (HTTP ${res.statusCode}).`);
    return null;
  }
  return String(doc.statusId);
}

/**
 * Fluxo completo automatizado de assinatura de contrato para a proposta.
 */
async function iniciarAssinaturaProposta(proposta, pdfBuffer) {
  let uuidDocumento;
  let enviadoAosSignatarios = false;
  try {
    const config = await obterConfiguracoesD4Sign();
    const docName = `Proposta #${proposta.numero_proposta} - ${proposta.nome_clinica}`;

    console.log(`[D4Sign] Iniciando processo para Proposta #${proposta.numero_proposta} (Modo: ${config.ambiente})...`);

    // 1. Enviar PDF
    uuidDocumento = await enviarDocumento(pdfBuffer, docName);
    console.log(`[D4Sign] Documento enviado. UUID: ${uuidDocumento}`);

    await db.execute("UPDATE propostas SET ip_assinatura = ? WHERE id = ?", [uuidDocumento, proposta.id]);

    // 2. Adicionar Signatários
    // E-mail com maiúscula/espaço não batia com o devolvido pela D4Sign: o documento ficava criado sem envio ao cliente
    const emailCliente = normalizarEmail(proposta.email);
    const signatarios = [
      {
        email: emailCliente,
        nome: proposta.nome_socio || proposta.nome_clinica,
        telefone: proposta.telefone || "",
        act: 1, // Assinar como parte
      },
    ];

    // Sócios adicionais do quadro societário
    let sociosDetalhados = [];
    try {
      if (typeof proposta.sociosDetalhados === "object") sociosDetalhados = proposta.sociosDetalhados;
      else if (proposta.socios_detalhados_json) sociosDetalhados = typeof proposta.socios_detalhados_json === "string" ? JSON.parse(proposta.socios_detalhados_json) : proposta.socios_detalhados_json;
      if (sociosDetalhados && !Array.isArray(sociosDetalhados) && Array.isArray(sociosDetalhados.socios)) {
        sociosDetalhados = sociosDetalhados.socios;
      }
    } catch {}

    if (Array.isArray(sociosDetalhados)) {
      sociosDetalhados.forEach((socio) => {
        if (socio.email && normalizarEmail(socio.email) !== emailCliente) {
          signatarios.push({
            email: normalizarEmail(socio.email),
            nome: socio.nome || "Sócio",
            telefone: socio.telefone || "",
            act: 1,
          });
        }
      });
    }

    // Assinar como parte: Hugo
    signatarios.push({
      email: emailInterno("hugo@grupoqmax.com.br", "hugo"),
      nome: "Hugo (Representante Legal)",
      act: 1,
    });

    // Assinar como testemunha: Alessandra
    signatarios.push({
      email: emailInterno("alessandra@grupoqmax.com.br", "testemunha"),
      nome: "Alessandra (Testemunha)",
      act: 4, // 4 é testemunha no D4Sign
    });

    // Acusar Recebimento: financeiro
    signatarios.push({
      email: emailInterno("financeiro@grupoqmax.com.br", "financeiro"),
      nome: "Financeiro (Acusar Recebimento)",
      act: 3, // 3 é acusar recebimento (reconhecimento) no D4Sign
    });

    const signatariosCadastrados = await cadastrarSignatarios(uuidDocumento, signatarios);
    console.log(`[D4Sign] ${signatarios.length} signatários cadastrados no documento.`);

    // 3. Registrar webhook. Falha aqui não pode impedir o envio ao cliente: verificarAssinaturasPendentes consulta o status
    try {
      await registrarWebhook(uuidDocumento);
    } catch (webhookErr) {
      console.error(`[D4Sign] ${webhookErr.message}. Seguindo; o status será consultado pelo job.`);
    }

    // 4. Disparar o envio para assinatura na D4Sign (email oficial deles)
    await enviarParaAssinatura(uuidDocumento);
    enviadoAosSignatarios = true;

    // 5. Obter link de assinatura oficial e disparar e-mail personalizado da Q-MAX / Finora
    const signatarioCliente = Array.isArray(signatariosCadastrados)
      ? signatariosCadastrados.find((s) => normalizarEmail(s.email) === emailCliente)
      : null;

    const keySigner = signatarioCliente?.key_signer || null;
    let linkAssinatura = await obterLinkAssinatura(uuidDocumento, emailCliente, keySigner);

    if (linkAssinatura) {
      console.log(`[D4Sign] Link obtido com sucesso: ${linkAssinatura}. Disparando e-mail de assinatura...`);
      // dispararEmail devolve null na falha (não lança): antes o log dizia "enviado" mesmo assim
      if (await emailService.enviarEmailAssinatura(proposta, linkAssinatura)) {
        console.log(`[D4Sign] E-mail de assinatura enviado com sucesso para ${proposta.email}!`);
      } else {
        console.error(`[D4Sign] E-mail de assinatura NÃO enviado para ${proposta.email}. O cliente recebe só o e-mail oficial da D4Sign.`);
      }

      // Notificar os diretores (Hugo e Thiago) de que a proposta/contrato foi gerada e enviada ao D4Sign
      try {
        if (await emailService.enviarEmailContratoEnviadoD4SignDiretores(proposta, uuidDocumento, linkAssinatura)) {
          console.log(`[D4Sign] Notificação de envio ao D4Sign entregue para Hugo e Thiago!`);
        } else {
          console.warn(`[D4Sign] Aviso aos diretores sobre envio D4Sign não foi entregue.`);
        }
      } catch (dirNotifyErr) {
        console.warn(`[D4Sign] Aviso ao notificar diretores sobre envio D4Sign:`, dirNotifyErr.message);
      }
    } else {
      console.error(`[D4Sign] Não foi possível obter o link oficial de assinatura para disparar e-mail para ${proposta.email}`);
    }

    return uuidDocumento;
  } catch (error) {
    console.error(`[D4Sign] Falha no fluxo automatizado para proposta ${proposta.id}:`, error.message);
    // Documento criado mas não enviado ficava "Aguardando Signatários" para sempre: o UUID gravado impedia
    // o link de assinatura de gerar outro e o job nunca via finalizado/cancelado. Libera e cancela o órfão.
    if (uuidDocumento && !enviadoAosSignatarios) {
      await db
        .execute("UPDATE propostas SET ip_assinatura = NULL WHERE id = ? AND ip_assinatura = ?", [proposta.id, uuidDocumento])
        .catch((e) => console.error("[D4Sign] Falha ao liberar documento não enviado:", e.message));
      cancelarDocumento(uuidDocumento).catch((e) => console.warn(`[D4Sign] Documento ${uuidDocumento} não cancelado:`, e.message));
    }
    throw error;
  }
}

async function cancelarDocumento(uuidDocumento) {
  const config = await obterConfiguracoesD4Sign();
  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) return;
  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  // Conta live levou 18s para responder o cancel (28/10)
  const res = await rawRequest(config.apiUrl, "POST", `/documents/${uuidDocumento}/cancel?${authQuery}`, { comment: "Envio ao cliente falhou; novo contrato será gerado." }, 60000);
  if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
}

/**
 * Decodifica o key_signer (Base64) retornado pela D4Sign para o ID numérico aceito pelo endpoint de signaturelink.
 */
function decodificarKeySigner(keySigner) {
  if (!keySigner) return null;
  try {
    const decoded = Buffer.from(keySigner, "base64").toString("utf-8");
    if (decoded && /^\d+$/.test(decoded.trim())) {
      return decoded.trim();
    }
    return decoded || keySigner;
  } catch {
    return keySigner;
  }
}

/**
 * Obtém o link direto oficial de assinatura para um signatário específico via API D4Sign.
 * Endpoint: GET /documents/{UUID-DOCUMENTO}/signaturelink/{ID_LINKASSINATURA}
 * 
 * @param {string} uuidDocumento UUID do documento na D4Sign
 * @param {string} email E-mail do signatário
 * @param {string} [keySigner] Chave key_signer do signatário (Base64) se já conhecida
 * @returns {Promise<string|null>} Retorna a URL oficial de assinatura ou null se falhar
 */
async function obterLinkAssinatura(uuidDocumento, email, keySigner = null) {
  const config = await obterConfiguracoesD4Sign();

  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) {
    console.warn("⚠ Credenciais da D4Sign não configuradas ou são placeholders. Pulando link real.");
    return null;
  }

  const authQuery = `tokenAPI=${encodeURIComponent(config.apiToken)}&cryptKey=${encodeURIComponent(config.apiSecret)}`;
  let keyToUse = keySigner;

  // Se não foi passada a key_signer, buscar na lista de signatários do documento
  if (!keyToUse && email) {
    try {
      console.log(`[D4Sign] Buscando signatários do documento ${uuidDocumento} para obter link de ${email}...`);
      const listRes = await rawRequest(config.apiUrl, "GET", `/documents/${uuidDocumento}/list?${authQuery}`);
      if (listRes.statusCode < 400 && listRes.data) {
        let signersList = [];
        const docData = Array.isArray(listRes.data) ? listRes.data[0] : listRes.data;
        if (docData && docData.list) {
          if (Array.isArray(docData.list)) {
            signersList = docData.list;
          } else if (typeof docData.list === "object") {
            signersList = Object.values(docData.list);
          }
        }
        const clientEmail = email.trim().toLowerCase();
        const found = signersList.find((s) => s && s.email && s.email.trim().toLowerCase() === clientEmail);
        if (found && found.key_signer) {
          keyToUse = found.key_signer;
          console.log(`[D4Sign] key_signer encontrada via lista: ${keyToUse}`);
        }
      }
    } catch (err) {
      console.warn(`[D4Sign] Falha ao consultar lista de signatários:`, err.message);
    }
  }

  if (!keyToUse) {
    console.error(`[D4Sign] Chave de signatário não encontrada para ${email}`);
    return null;
  }

  const idDecodificado = decodificarKeySigner(keyToUse);
  const idsParaTentar = [idDecodificado];
  if (keyToUse !== idDecodificado) {
    idsParaTentar.push(keyToUse);
  }

  const maxTentativas = 4;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    for (const idLink of idsParaTentar) {
      try {
        console.log(`[D4Sign] Tentativa ${tentativa} de obter signaturelink para ${email} (ID: ${idLink})...`);
        const res = await rawRequest(
          config.apiUrl,
          "GET",
          `/documents/${uuidDocumento}/signaturelink/${encodeURIComponent(idLink)}?${authQuery}`
        );

        if (res.statusCode < 400 && res.data && res.data.link) {
          console.log(`✅ [D4Sign] Link oficial de assinatura obtido: ${res.data.link}`);
          return res.data.link;
        }

        console.warn(`[D4Sign] Tentativa com ID "${idLink}" retornou:`, JSON.stringify(res.data));
      } catch (err) {
        console.error(`[D4Sign] Erro de rede ao buscar signaturelink:`, err.message);
      }
    }

    if (tentativa < maxTentativas) {
      console.log(`[D4Sign] Aguardando 1.5s antes da tentativa ${tentativa + 1}...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.error(`[D4Sign] Limite de tentativas excedido para obter link de assinatura para ${email}`);
  return null;
}

/**
 * Testa a conectividade com a API da D4Sign e valida o cofre configurado em tempo real.
 */
async function testarConexaoD4Sign(customConfig = {}) {
  const config = await obterConfiguracoesD4Sign();
  const token = customConfig.token || config.apiToken;
  const secret = customConfig.secret || config.apiSecret;
  const ambiente = customConfig.ambiente || config.ambiente;
  const cofre = customConfig.cofre || config.uuidCofre;
  const apiUrl = ambiente === "sandbox" ? "https://sandbox.d4sign.com.br/api/v1" : "https://secure.d4sign.com.br/api/v1";

  if (isPlaceholder(token) || isPlaceholder(secret)) {
    return {
      success: false,
      erro: "Credenciais da D4Sign não configuradas ou estão como placeholder (ex: 'seu_token').",
    };
  }

  try {
    const authQuery = `tokenAPI=${encodeURIComponent(token)}&cryptKey=${encodeURIComponent(secret)}`;
    const res = await rawRequest(apiUrl, "GET", `/safes?${authQuery}`);

    if (res.statusCode >= 400) {
      return {
        success: false,
        statusCode: res.statusCode,
        erro: res.data?.message || res.data?.error || JSON.stringify(res.data),
      };
    }

    const cofres = Array.isArray(res.data) ? res.data : [];
    let cofreEncontrado = null;
    if (cofre) {
      cofreEncontrado = cofres.find(
        (c) => c.uuid_safe === cofre || c["uuid-safe"] === cofre || c.uuid === cofre || c.name === cofre
      );
    }

    return {
      success: true,
      ambiente,
      totalCofres: cofres.length,
      cofreConfigurado: cofre ? (cofreEncontrado ? cofreEncontrado.name || "Encontrado" : "Não encontrado na lista de cofres") : "Não informado",
      cofresDisponiveis: cofres.map((c) => ({
        uuid: c.uuid_safe || c["uuid-safe"] || c.uuid,
        nome: c.name || "Cofre",
      })),
      mensagem: "Conexão estabelecida com sucesso com a API da D4Sign!",
    };
  } catch (err) {
    return {
      success: false,
      erro: `Falha de conexão com a API da D4Sign: ${err.message}`,
    };
  }
}

// Registro no histórico que marca o "documento finalizado" do D4Sign como já tratado (idempotência de webhook e job)
const MARCA_ASSINATURA_D4SIGN = "Contrato assinado por todos no D4Sign.";
// Recusada ou em análise interna não vira "Aprovada" por assinatura (mesmas chaves de MENSAGEM_BLOQUEIO_APROVACAO)
const STATUS_SEM_ASSINATURA = ["Recusada", "Aguardando Aprovação"];

/**
 * Consulta o status do documento na D4Sign: "finalizado" (4), "cancelado" (6, inclui prazo expirado) ou "aguardando".
 * null em mock ou falha de comunicação.
 */
async function consultarStatusDocumento(uuidDocumento) {
  const config = await obterConfiguracoesD4Sign();
  if (isPlaceholder(config.apiToken) || isPlaceholder(config.apiSecret)) return null;

  const statusId = await statusIdDocumento(uuidDocumento);
  if (statusId === null) return null;
  if (statusId === "4") return "finalizado";
  if (statusId === "6") return "cancelado";
  return "aguardando";
}

async function avisarVendedorContrato(proposta, motivo) {
  notificationService.enviarNotificacao("contrato_nao_assinado", {
    id: proposta.id,
    numeroProposta: proposta.numero_proposta,
    nomeClinica: proposta.nome_clinica,
    criadoPor: proposta.criado_por,
    motivo,
  }, [proposta.criado_por]);

  const vendedores = await db.executarQuery("SELECT email FROM usuarios WHERE id = ? LIMIT 1", [proposta.criado_por || 1]);
  if (vendedores[0]?.email && !(await emailService.notificarContratoNaoAssinado(vendedores[0].email, proposta, motivo))) {
    console.warn(`[D4Sign] Aviso de contrato não assinado (proposta #${proposta.numero_proposta}) não entregue por e-mail.`);
  }
}

/**
 * Trata o retorno da D4Sign para um documento (webhook ou job de consulta).
 * evento: "finalizado" (todos assinaram), "cancelado" (cancelado/expirado) ou "nao_entregue" (e-mail ao signatário falhou).
 */
async function processarDocumentoD4Sign(uuid, evento, mensagem = "") {

  const propostas = await db.executarQuery(
    "SELECT id, numero_proposta, status, token_acesso, nome_clinica, nome_socio, email, valor_total, criado_por, tipo_proposta FROM propostas WHERE ip_assinatura = ? LIMIT 1",
    [uuid]
  );
  if (propostas.length === 0) return;
  const proposta = propostas[0];

  if (evento === "nao_entregue") {
    await avisarVendedorContrato(proposta, `o e-mail de assinatura não foi entregue ao signatário (${mensagem || "sem detalhe"}).`);
    return;
  }

  if (evento === "cancelado") {
    // UUID liberado: o próximo acesso ao link de assinatura gera contrato novo. Status da proposta não muda.
    const [atualizacao] = await db.execute("UPDATE propostas SET ip_assinatura = NULL WHERE id = ? AND ip_assinatura = ?", [proposta.id, uuid]);
    if (atualizacao.affectedRows === 0) return;
    await db.execute(
      "INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)",
      [proposta.id, proposta.criado_por || 1, `Contrato cancelado ou expirado no D4Sign (documento ${uuid}).`],
    );
    console.log(`[D4Sign] Contrato da proposta #${proposta.numero_proposta} cancelado/expirado. Vendedor avisado.`);
    await avisarVendedorContrato(proposta, "o contrato foi cancelado ou o prazo de assinatura expirou no D4Sign.");
    return;
  }

  if (evento !== "finalizado") return;

  if (STATUS_SEM_ASSINATURA.includes(proposta.status)) {
    console.warn(`[D4Sign] Proposta #${proposta.numero_proposta} está '${proposta.status}'. Assinatura ignorada.`);
    return;
  }
  const jaProcessada = await db.executarQuery(
    "SELECT 1 FROM proposta_observacoes WHERE proposta_id = ? AND observacao = ? LIMIT 1",
    [proposta.id, MARCA_ASSINATURA_D4SIGN],
  );
  if (jaProcessada.length > 0) {
    // D4Sign reenvia o evento quando não recebe resposta a tempo: sem esta trava, cliente e equipe recebiam os e-mails de novo
    console.log(`[D4Sign] Assinatura da proposta #${proposta.numero_proposta} já processada. Reenvio ignorado.`);
    return;
  }

  console.log(`[D4Sign] Proposta #${proposta.numero_proposta} assinada por todos. Atualizando status para 'Aprovada'`);
  await db.execute("UPDATE propostas SET status = 'Aprovada', data_decisao = NOW() WHERE id = ?", [proposta.id]);
  await db.execute(
    "INSERT INTO proposta_observacoes (proposta_id, usuario_id, observacao) VALUES (?, ?, ?)",
    [proposta.id, proposta.criado_por || 1, MARCA_ASSINATURA_D4SIGN],
  );

  notificationService.enviarNotificacao("aprovada", {
    id: proposta.id,
    numeroProposta: proposta.numero_proposta,
    nomeClinica: proposta.nome_clinica,
    tipoProposta: proposta.tipo_proposta,
    criadoPor: proposta.criado_por
  }, [proposta.criado_por]);

  teamsService.enviarNotificacaoTeams("aprovada", {
    id: proposta.id,
    numeroProposta: proposta.numero_proposta,
    nomeClinica: proposta.nome_clinica,
    tipoProposta: proposta.tipo_proposta
  }).catch(() => {});

  try {
    // Automação CRM: move o Lead correspondente para 'Ganho'
    const leads = await db.executarQuery(
      "SELECT id, nome_cliente, criado_por, vendedor_id FROM leads WHERE proposta_id = ? LIMIT 1",
      [proposta.id]
    );

    if (leads.length > 0) {
      const lead = leads[0];
      console.log(`[D4Sign] Lead CRM correspondente encontrado: ID ${lead.id} (${lead.nome_cliente}). Atualizando para 'Ganho'...`);
      await db.execute("UPDATE leads SET status = 'Ganho', atualizado_em = NOW() WHERE id = ?", [lead.id]);
      await db.execute(
        "INSERT INTO lead_comentarios (lead_id, usuario_id, comentario, tipo, criado_em) VALUES (?, ?, ?, 'historico', NOW())",
        [lead.id, proposta.criado_por || 1, "Contrato assinado eletronicamente via D4Sign. Oportunidade fechada como GANHA de forma automática pelo sistema! 🎉"]
      );
      notificationService.enviarNotificacao("lead_atualizado", {
        id: lead.id,
        nomeCliente: lead.nome_cliente,
        status: "Ganho"
      }, [lead.criado_por, lead.vendedor_id]);
    }

    // E-mails de assinatura concluída saem sempre (antes só saíam quando havia lead no CRM)
    const dadosEmail = {
      email: proposta.email,
      nomeSocio: proposta.nome_socio,
      numeroProposta: proposta.numero_proposta,
      nomeClinica: proposta.nome_clinica,
      tipoProposta: proposta.tipo_proposta,
      valor_total: proposta.valor_total,
    };

    // 1. Cliente
    if (!(await emailService.enviarEmailAssinaturaConcluidaCliente(dadosEmail))) {
      console.error("[D4Sign] E-mail de contrato assinado NÃO enviado ao cliente.");
    }

    // 2. Vendedor responsável
    const vendedores = await db.executarQuery("SELECT email, nome FROM usuarios WHERE id = ? LIMIT 1", [proposta.criado_por || 1]);
    if (vendedores[0]?.email && !(await emailService.enviarEmailAssinaturaConcluidaComercial(dadosEmail, vendedores[0].email, vendedores[0].nome))) {
      console.error("[D4Sign] E-mail de contrato assinado NÃO enviado ao comercial.");
    }

    // 3. Diretores
    const diretores = await db.executarQuery("SELECT email FROM usuarios WHERE role = 'Diretor'");
    const adminEmails = diretores.map((d) => d.email).filter(Boolean);
    if (adminEmails.length > 0 && !(await emailService.enviarEmailAssinaturaConcluidaDiretores(dadosEmail, adminEmails))) {
      console.error("[D4Sign] E-mail de contrato assinado NÃO enviado aos diretores.");
    }
  } catch (posErr) {
    console.error("[D4Sign] Erro no pós-assinatura (CRM/e-mails):", posErr.message);
  }
}

/**
 * Reserva do webhook (segredo ausente, D4Sign sem acesso ao servidor, evento perdido):
 * consulta os contratos abertos e trata os finalizados e cancelados.
 * ponytail: 1 chamada por documento a cada 30 min; fila/lote se passar de centenas de contratos abertos.
 */
let verificandoAssinaturas = false;
async function verificarAssinaturasPendentes() {
  if (verificandoAssinaturas) return;
  verificandoAssinaturas = true;
  try {
    const abertas = await db.executarQuery(
      `SELECT p.ip_assinatura FROM propostas p
       WHERE p.status = 'Aprovada' AND p.ip_assinatura IS NOT NULL
         AND p.data_decisao >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND NOT EXISTS (SELECT 1 FROM proposta_observacoes o WHERE o.proposta_id = p.id AND o.observacao = ?)
       ORDER BY p.data_decisao DESC LIMIT 50`,
      [MARCA_ASSINATURA_D4SIGN]
    );
    for (const { ip_assinatura: uuid } of abertas) {
      if (!ehUuidD4Sign(uuid)) continue;
      try {
        const status = await consultarStatusDocumento(uuid);
        if (status === "finalizado" || status === "cancelado") await processarDocumentoD4Sign(uuid, status);
      } catch (err) {
        console.error(`[D4Sign] Erro ao verificar documento ${uuid}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[D4Sign] Erro na verificação de assinaturas pendentes:", err.message);
  } finally {
    verificandoAssinaturas = false;
  }
}

// Aceita o segredo atual e o legado (cryptKey) para não quebrar documentos registrados antes da troca
async function segredoWebhookValido(recebido) {
  if (!recebido) return false;
  const config = await obterConfiguracoesD4Sign();
  const aceitos = [process.env.D4SIGN_WEBHOOK_SECRET, config.apiSecret, process.env.D4SIGN_API_SECRET].filter(
    (v) => v && !isPlaceholder(v)
  );
  const r = Buffer.from(String(recebido));
  return aceitos.some((v) => {
    const b = Buffer.from(v);
    return b.length === r.length && crypto.timingSafeEqual(b, r);
  });
}

module.exports = {
  MARCA_ASSINATURA_D4SIGN,
  consultarStatusDocumento,
  processarDocumentoD4Sign,
  verificarAssinaturasPendentes,
  segredoWebhookValido,
  obterConfiguracoesD4Sign,
  enviarDocumento,
  cadastrarSignatarios,
  registrarWebhook,
  enviarParaAssinatura,
  iniciarAssinaturaProposta,
  obterLinkAssinatura,
  testarConexaoD4Sign,
};
