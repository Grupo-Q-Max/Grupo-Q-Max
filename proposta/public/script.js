const APP_BASE_PATH = "/proposta";
const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

let BASE = {
  contabil: 1800,
  fiscal: 1800,
  bpo: 2200,
  diagnostico: 2500,
  dpAte20: 70,
  dp21a40: 65,
  dpAcima40: 60,
  proLabore: 70,
  cro: 400,
  regulatorio: 1500,
  certificado: 220,
};

let SERVICOS_DINAMICOS = [];
let REGRAS_PRECIFICACAO = [];
let PLANOS_TECH = [];
async function carregarPlanosTech() {
  try {
    const response = await fetchAuth("/api/tech-planos");

    if (!response.ok) return;

    PLANOS_TECH = await response.json();

    renderizarPlanosTech();
  } catch (error) {
    console.warn("Erro ao carregar planos Tech.", error);
  }
}

function renderizarPlanosTech() {
  const select = document.getElementById("planoTech");
  if (!select) return;

  select.innerHTML = PLANOS_TECH.map((plano) => {
    return `
      <option value="${plano.codigo}">
        ${plano.nome} - ${moeda.format(Number(plano.valor_mensalidade || 0))}/mês
      </option>
    `;
  }).join("");

  atualizarPlanoTech();
}
async function carregarServicosDinamicos(servicosBase = null) {
  try {
    let servicos = servicosBase || REGRAS_PRECIFICACAO;

    if (!servicos || !servicos.length) {
      const container = document.getElementById("listaServicosDinamicos");
      if (container) {
        container.innerHTML = `
          <div class="skeleton-box" style="height: 48px; margin-bottom: 12px; border-radius: 15px; grid-column: 1/-1;"></div>
          <div class="skeleton-box" style="height: 48px; margin-bottom: 12px; border-radius: 15px; grid-column: 1/-1;"></div>
        `;
      }
      const response = await fetchAuth("/api/regras-precificacao");

      if (!response.ok) return;

      servicos = await response.json();
      REGRAS_PRECIFICACAO = servicos;
    }

    // Mapeamento dinâmico para o objeto BASE com valores atualizados do BD (considerando PF, PJ ou Híbrido se especificado)
    if (REGRAS_PRECIFICACAO && REGRAS_PRECIFICACAO.length) {
      const radioPessoa = document.querySelector('input[name="tipoPessoa"]:checked');
      const tipoPessoa = radioPessoa ? radioPessoa.value : 'PJ';

      REGRAS_PRECIFICACAO.forEach((regra) => {
        if (regra.codigo) {
          let val = Number(regra.valor_base || 0);

          if (tipoPessoa === 'PF' && regra.valor_base_pf !== null && regra.valor_base_pf !== undefined && regra.valor_base_pf !== '') {
            val = Number(regra.valor_base_pf);
          } else if (tipoPessoa === 'PJ' && regra.valor_base_pj !== null && regra.valor_base_pj !== undefined && regra.valor_base_pj !== '') {
            val = Number(regra.valor_base_pj);
          } else if (tipoPessoa === 'HIBRIDA' && regra.valor_base_hibrido !== null && regra.valor_base_hibrido !== undefined && regra.valor_base_hibrido !== '') {
            val = Number(regra.valor_base_hibrido);
          }

          BASE[regra.codigo] = val;
        }
      });
    }

    const tipoAtual = valorCampo("tipoProposta");

    SERVICOS_DINAMICOS = servicos.filter((s) => {
      const empresa = (s.empresa || "FINORA").toUpperCase();

      if (Number(s.ativo) !== 1) return false;
      if (s.categoria === "Base Auxiliar") return false;
      if (s.codigo.startsWith("plano_")) return false;
      if (s.codigo.startsWith("mensalidade_")) return false;

      if (tipoAtual === "tech") return empresa === "TECH";
      if (tipoAtual === "contabil") return empresa === "CONTABIL";
      if (tipoAtual === "auditoria") return empresa === "AUDITORIA";
      if (tipoAtual === "lagerhaus") return empresa === "LAGERHAUS";

      return empresa === "FINORA";
    });

    renderizarServicosDinamicos();
  } catch (error) {
    console.warn("Erro ao carregar serviços dinâmicos.", error);
  }
}
function deslogarSessao() {
  localStorage.clear();
  window.location.href = `${APP_BASE_PATH}/login.html`;
}

async function fetchAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
    },
  });

  // Só 401 é sessão inválida; 403 é falta de permissão e não pode deslogar
  if (response.status === 401) {
    deslogarSessao();
    throw new Error("Sessão expirada.");
  }

  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  ) {
    throw new Error("Servidor temporariamente indisponível. Tente novamente.");
  }

  return response;
}
function renderizarServicosDinamicos() {
  const container = document.getElementById("listaServicosDinamicos");
  if (!container) return;

  if (!SERVICOS_DINAMICOS.length) {
    container.innerHTML = `<small style="color:#64748b;">Nenhum serviço disponível.</small>`;
    return;
  }

  const mensais = SERVICOS_DINAMICOS.filter((s) => s.tipo === "Mensal");
  const pontuais = SERVICOS_DINAMICOS.filter((s) => String(s.tipo || "").toLowerCase() === "pontual");

  const radioPessoa = document.querySelector('input[name="tipoPessoa"]:checked');
  const tipoPessoa = radioPessoa ? radioPessoa.value : 'PJ';

  function obterValorDinamico(servico) {
    let val = Number(servico.valor_base || 0);
    if (tipoPessoa === 'PF' && servico.valor_base_pf !== null && servico.valor_base_pf !== undefined && servico.valor_base_pf !== '') {
      val = Number(servico.valor_base_pf);
    } else if (tipoPessoa === 'PJ' && servico.valor_base_pj !== null && servico.valor_base_pj !== undefined && servico.valor_base_pj !== '') {
      val = Number(servico.valor_base_pj);
    } else if (tipoPessoa === 'HIBRIDA' && servico.valor_base_hibrido !== null && servico.valor_base_hibrido !== undefined && servico.valor_base_hibrido !== '') {
      val = Number(servico.valor_base_hibrido);
    }
    return val;
  }

  function renderGrupo(titulo, lista) {
    if (!lista.length) return "";

    return `
      <div style="grid-column:1/-1; margin-top:8px;">
        <strong style="display:block; color:#0f172a; margin-bottom:8px;">
          ${titulo}
        </strong>

        <div class="checkbox-grid">
          ${lista
            .map(
              (servico) => {
                const valorAtual = obterValorDinamico(servico);
                const badgeValor = valorAtual > 0 ? `<span style="margin-left:auto; font-size:11px; font-weight:700; color:var(--accent, #14b8a6); background:rgba(20,184,166,0.08); padding:2px 8px; border-radius:10px;">${moeda.format(valorAtual)}</span>` : '';
                return `
            <label class="checkbox-label" style="display:flex; align-items:center; width:100%;">
              <input 
                type="checkbox"
                data-servico-dinamico="true"
                data-codigo="${servico.codigo}"
                data-nome="${servico.nome}"
                data-tipo="${servico.tipo}"
                onchange="gerarProposta()"
              />
              <span style="flex-grow:1;">${servico.nome}</span>
              ${badgeValor}
            </label>
          `;
              },
            )
            .join("")}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${renderGrupo("Serviços mensais", mensais)}
    ${renderGrupo("Serviços pontuais", pontuais)}
  `;

  // Aplicar filtros de texto ou categoria caso ativos
  aplicarFiltrosServicosDinamicos();

  // Restaurar checkboxes dinâmicos salvos no rascunho
  if (window.rascunhoItensDinamicosParaMarcar && window.rascunhoItensDinamicosParaMarcar.length) {
    window.rascunhoItensDinamicosParaMarcar.forEach(codigo => {
      const cb = container.querySelector(`input[data-codigo="${codigo}"]`);
      if (cb) cb.checked = true;
    });
  }
}

let filtroTextoServicoAtual = "";
let filtroCategoriaServicoAtual = "TODOS";

function filtrarServicosPorTexto(texto) {
  filtroTextoServicoAtual = (texto || "").toLowerCase().trim();
  aplicarFiltrosServicosDinamicos();
}

function filtrarCategoriaServicos(categoria, btn) {
  filtroCategoriaServicoAtual = categoria;
  document.querySelectorAll(".filtro-servico-btn").forEach((b) => {
    b.classList.remove("filtro-ativo");
    b.classList.add("btn-mini-light");
  });
  if (btn) {
    btn.classList.add("filtro-ativo");
    btn.classList.remove("btn-mini-light");
  }
  aplicarFiltrosServicosDinamicos();
}

function aplicarFiltrosServicosDinamicos() {
  const container = document.getElementById("listaServicosDinamicos");
  if (!container) return;

  const labels = container.querySelectorAll(".checkbox-label");
  labels.forEach((lbl) => {
    const input = lbl.querySelector('input[data-servico-dinamico="true"]');
    if (!input) return;

    const nome = (input.dataset.nome || "").toLowerCase();
    const codigo = (input.dataset.codigo || "").toLowerCase();
    const tipo = input.dataset.tipo || "Mensal";

    const matchTexto = !filtroTextoServicoAtual || nome.includes(filtroTextoServicoAtual) || codigo.includes(filtroTextoServicoAtual);
    const matchCategoria = filtroCategoriaServicoAtual === "TODOS" || String(tipo).toLowerCase() === filtroCategoriaServicoAtual.toLowerCase();

    lbl.style.display = matchTexto && matchCategoria ? "flex" : "none";
  });
}
async function carregarRegrasPrecificacao() {
  try {
    const response = await fetchAuth("/api/regras-precificacao", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
      },
    });

    if (!response.ok) {
      console.warn(
        "Não foi possível carregar regras do banco. Usando valores padrão.",
      );
      return;
    }

    const regras = await response.json();
    REGRAS_PRECIFICACAO = regras;

    regras.forEach((regra) => {
      BASE[regra.codigo] = Number(regra.valor_base || 0);
    });

    await carregarServicosDinamicos(regras);
    await carregarPlanosTech();
    gerarProposta();
  } catch (error) {
    console.warn("Erro ao carregar regras:", error);

    const container = document.getElementById("listaServicosDinamicos");
    if (container) {
      container.innerHTML = `
      <div class="alerta">
        Não foi possível carregar os serviços agora. 
        Atualize a página ou tente novamente em alguns instantes.
      </div>
    `;
    }
  }
}

function preencherDataProposta() {
  const formatadorBRT = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [dia, mes, ano] = formatadorBRT.format(new Date()).split("/");
  const dataBRT = `${ano}-${mes}-${dia}`;

  const inputData = document.getElementById("dataProposta");
  inputData.value = dataBRT;
  inputData.disabled = true; // Impede que o usuário clique e mude a data
  inputData.classList.add("disabled-input"); // Aplica aquele visual cinza de campo travado
}
function valorCampo(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}
function numeroCampo(id) {
  const el = document.getElementById(id);
  return el ? Number(el.value || 0) : 0;
}
function checked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

// --- CAMPOS V2 DO ONBOARDING ---
function tipoPessoaSelecionado() {
  return document.querySelector('input[name="tipoPessoa"]:checked')?.value || "PJ";
}

function obterSociosDetalhadosSeguro() {
  if (typeof window.obterSociosDetalhados === "function") {
    return window.obterSociosDetalhados().map((socio) => ({
      nome: String(socio.nome || "").trim(),
      cpf: String(socio.cpf || "").trim(),
      participacao: Number(socio.participacao || 0),
      cargo: String(socio.cargo || "").trim(),
    }));
  }
  return [];
}

function obterDadosOnboardingV2() {
  const arquivo = document.getElementById("arquivoCertificadoDigital")?.files?.[0];
  const elCnpjEst = document.getElementById("cnpjEstabelecido");
  return {
    tipoPessoa: tipoPessoaSelecionado(),
    cnpjEstabelecido: elCnpjEst ? elCnpjEst.value : "Sim",
    proLabore: document.getElementById("proLabore")?.value || "Não",
    dentistasParceiros: Number(document.getElementById("dentistasParceiros")?.value || 0),
    quantidadeSocios: Number(document.getElementById("quantidadeSociosDetalhados")?.value || 0),
    sociosDetalhados: obterSociosDetalhadosSeguro(),
    certificadoDigitalStatus: document.getElementById("certificadoDigital")?.value || "Não",
    certificadoDigitalNomeArquivo: arquivo?.name || "",
    certificadoDigitalTipoArquivo: arquivo?.type || "",
    certificadoDigitalTamanho: Number(arquivo?.size || 0),
    senhaCertificadoDigital: document.getElementById("senhaCertificadoDigital")?.value || "",
  };
}

function validarOnboardingV2() {
  const dados = obterDadosOnboardingV2();
  const temCnpjEst = dados.cnpjEstabelecido === "Sim";
  const ehPF = dados.tipoPessoa === "PF";
  const precisaCnpj = !ehPF && temCnpjEst;
  const documento = precisaCnpj ? valorCampo("cnpj") : valorCampo("cpfSocio");

  if (!documento) {
    const campo = precisaCnpj ? document.getElementById("cnpj") : document.getElementById("cpfSocio");
    alert(`Informe o ${precisaCnpj ? "CNPJ" : "CPF do responsável"} do cliente.`);
    campo?.focus();
    return false;
  }

  if (dados.tipoPessoa === "PJ" && dados.quantidadeSocios > 0) {
    const incompleto = dados.sociosDetalhados.findIndex((socio) => !socio.nome || !socio.cpf);
    if (incompleto >= 0) {
      alert(`Preencha o nome e o CPF do Sócio ${incompleto + 1}.`);
      document.querySelectorAll(".socio-card")[incompleto]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }

    const soma = dados.sociosDetalhados.reduce((total, socio) => total + Number(socio.participacao || 0), 0);
    if (soma > 100.01) {
      alert("A soma das participações societárias não pode ultrapassar 100%.");
      return false;
    }
  }

  const arquivo = document.getElementById("arquivoCertificadoDigital")?.files?.[0];
  if (arquivo && !/\.(pfx|p12)$/i.test(arquivo.name)) {
    alert("O certificado deve estar no formato .PFX ou .P12.");
    return false;
  }

  return true;
}

// --- LÓGICA DE GEOLOCALIZAÇÃO E DISTÂNCIA (Automático) ---
async function buscarEnderecoEDistancia() {
  const cepInput = document.getElementById("cep");
  let cep = cepInput.value.replace(/\D/g, "");
  if (cep.length !== 8) return;

  try {
    // 1. Busca Rua, Bairro e Cidade via ViaCEP
    const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const endereco = await viaCepRes.json();

    if (!endereco.erro) {
      document.getElementById("logradouroClinica").value = endereco.logradouro || "";
      document.getElementById("bairroClinica").value = endereco.bairro || "";
      document.getElementById("cidadeClinica").value = endereco.localidade || "";
      document.getElementById("ufClinica").value = endereco.uf || "";
      document.getElementById("numeroClinica").value = "";
      document.getElementById("complementoClinica").value = "";
      atualizarEnderecoCompleto();
      document.getElementById("numeroClinica").focus();
    }

    // 2. Busca Coordenadas e Calcula Distância
    const geoRes = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`);
    const geoData = await geoRes.json();

    if (geoData.lat && geoData.lng) {
      const latClinica = parseFloat(geoData.lat);
      const lngClinica = parseFloat(geoData.lng);

      // Coordenadas da Q-Max (Rua Frei Gaspar, 941 - SBC)
      const latQMax = -23.707573;
      const lngQMax = -46.544521;

      // Fórmula de Haversine (Distância em linha reta na esfera terrestre)
      const R = 6371; // Raio da Terra em km
      const dLat = ((latClinica - latQMax) * Math.PI) / 180;
      const dLon = ((lngClinica - lngQMax) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((latQMax * Math.PI) / 180) *
          Math.cos((latClinica * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanciaReta = R * c;

      // Multiplica por 1.3 para estimar as curvas das ruas em área urbana
      const distanciaEstimada = Math.round(distanciaReta * 1.3);

      document.getElementById("distanciaKm").value = distanciaEstimada;
      gerarProposta(); // Atualiza os cálculos caso a distância mude os honorários
    }
  } catch (erro) {
    console.error("Erro ao buscar dados do CEP:", erro);
  }
}

// --- LÓGICA DE CÁLCULO FINANCEIRO ---
function calcularFatorCadeiras(cadeiras) {
  if (cadeiras <= 2) return 1;
  return 1 + Math.ceil((cadeiras - 2) / 2) * 0.6;
}

function calcularFatorFaturamento(faturamento) {
  if (faturamento <= 2000000) return 1;
  return 1 + Math.ceil((faturamento - 2000000) / 1000000) * 0.1;
}
function obterValorCampoRegra(campo, contexto) {
  if (campo === "cadeiras") return contexto.cadeiras;
  if (campo === "faturamento") return contexto.faturamento;
  if (campo === "regimeHibrido")
    return contexto.regimeHibrido === "Sim" ? 1 : 0;
  if (campo === "funcionarios") return contexto.funcionarios;
  if (campo === "socios") return contexto.socios;
  if (campo === "metragem") return contexto.metragem;
  if (campo === "distanciaKm") return contexto.distanciaKm;

  return 0;
}

function regraPassou(regra, contexto) {
  const valorCampo = obterValorCampoRegra(regra.campo_base, contexto);
  const valorComparacao = Number(regra.valor_comparacao || 0);

  if (regra.operador === ">") return valorCampo > valorComparacao;
  if (regra.operador === ">=") return valorCampo >= valorComparacao;
  if (regra.operador === "<") return valorCampo < valorComparacao;
  if (regra.operador === "<=") return valorCampo <= valorComparacao;
  if (regra.operador === "=") return valorCampo === valorComparacao;

  return false;
}
function explicarRegrasAplicadas(servico, contexto) {
  const regras = servico.regras_calculo || [];
  const explicacoes = [];

  const valorBase = calcularValorConfigurado(
    servico.codigo,
    contexto,
    BASE[servico.codigo],
  );

  regras.forEach((regra) => {
    if (regra.codigo === "cadeiras") {
      const fator = calcularFatorCadeiras(contexto.cadeiras);

      if (fator > 1) {
        const acrescimo = valorBase * fator - valorBase;

        explicacoes.push(
          `Cadeiras: ${contexto.cadeiras} | Base ${moeda.format(valorBase)} x ${fator.toFixed(2)} = ${moeda.format(valorBase * fator)} (+${moeda.format(acrescimo)})`,
        );
      }

      return;
    }

    if (regra.codigo === "faturamento") {
      const fator = calcularFatorFaturamento(contexto.faturamento);

      if (fator > 1) {
        const acrescimo = valorBase * fator - valorBase;

        explicacoes.push(
          `Faturamento: Base ${moeda.format(valorBase)} x ${fator.toFixed(2)} = ${moeda.format(valorBase * fator)} (+${moeda.format(acrescimo)})`,
        );
      }

      return;
    }

    if (regra.codigo === "hibrido") {
      if (contexto.regimeHibrido === "Sim") {
        const fator = 1.3;
        const acrescimo = valorBase * fator - valorBase;

        explicacoes.push(
          `Regime híbrido: Base ${moeda.format(valorBase)} x ${fator.toFixed(2)} = ${moeda.format(valorBase * fator)} (+${moeda.format(acrescimo)})`,
        );
      }

      return;
    }

    if (regraPassou(regra, contexto)) {
      const fator = Number(regra.fator || 1);
      const acrescimo = valorBase * fator - valorBase;

      explicacoes.push(
        `${regra.nome}: Base ${moeda.format(valorBase)} x ${fator.toFixed(2)} = ${moeda.format(valorBase * fator)} (+${moeda.format(acrescimo)})`,
      );
    }
  });

  return explicacoes;
}
function calcularMultiplicadorServico(servico, contexto) {
  let multiplicador = 1;
  const regras = servico.regras_calculo || [];

  regras.forEach((regra) => {
    if (regra.codigo === "cadeiras") {
      multiplicador *= calcularFatorCadeiras(contexto.cadeiras);
      return;
    }

    if (regra.codigo === "faturamento") {
      multiplicador *= calcularFatorFaturamento(contexto.faturamento);
      return;
    }

    if (regra.codigo === "hibrido") {
      multiplicador *= contexto.regimeHibrido === "Sim" ? 1.3 : 1;
      return;
    }

    if (regraPassou(regra, contexto)) {
      multiplicador *= Number(regra.fator || 1);
    }
  });

  return multiplicador;
}
function buscarRegraPrecificacao(codigo) {
  return REGRAS_PRECIFICACAO.find((regra) => regra.codigo === codigo) || null;
}

function calcularValorConfigurado(codigo, contexto, fallback = 0) {
  const regra = buscarRegraPrecificacao(codigo);

  if (!regra) return Number(fallback || 0);

  const valorBase = Number(regra.valor_base || fallback || 0);

  if (regra.modo_calculo === "por_quantidade") {
    const quantidade = Number(
      obterValorCampoRegra(regra.campo_quantidade, contexto) || 0,
    );

    return valorBase * quantidade;
  }

  return valorBase;
}
function toggleServicoEspecial() {
  const principal = document.getElementById("boxServicosEspeciais");
  const boxPersonalizado = document.getElementById("boxPersonalizado");
  const containerAuditoria = document.getElementById("boxAuditoriaContainer");

  const personalizado = checked("servicoPersonalizado");
  const auditoria = checked("servicoAuditoria");

  principal.style.display = personalizado ? "block" : "none";
  boxPersonalizado.style.display = personalizado ? "block" : "none";
  if (containerAuditoria) {
    containerAuditoria.style.display = auditoria ? "block" : "none";
  }
}

function obterTopicos(textareaId) {
  const campo = document.getElementById(textareaId);
  if (!campo) return [];

  return campo.value
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);
}
function obterItensCalculados() {
  if (valorCampo("tipoProposta") === "tech") {
    return obterItensCalculadosTech();
  }

  const itens = [];
  const regimeFiscal = valorCampo("regimeFiscal");
  const cadeiras = numeroCampo("cadeiras");
  const faturamento = numeroCampo("faturamento");
  const regimeHibrido = valorCampo("regimeHibrido");
  const funcionarios = numeroCampo("funcionarios");
  const socios = numeroCampo("socios");
  const metragem = numeroCampo("metragem");
  const distanciaKm = numeroCampo("distanciaKm");
  const tipoProposta = valorCampo("tipoProposta");

  const contexto = {
    cadeiras,
    faturamento,
    regimeHibrido,
    funcionarios,
    socios,
    metragem,
    distanciaKm,
  };

  if (regimeFiscal !== "Lucro Real") {
    document
      .querySelectorAll('[data-servico-dinamico="true"]:checked')
      .forEach((input) => {
        const codigo = input.dataset.codigo;
        const nome = input.dataset.nome;
        const tipo = input.dataset.tipo;
        const servicoConfig =
          SERVICOS_DINAMICOS.find((s) => s.codigo === codigo) || {};

        const multiplicador = calcularMultiplicadorServico(
          servicoConfig,
          contexto,
        );

        itens.push({
          servico: nome,
          valor:
            calcularValorConfigurado(codigo, contexto, BASE[codigo]) *
            multiplicador,
          observacao: String(tipo || "").toLowerCase() === "pontual" ? "Serviço pontual" : "Mensal",
          regrasAplicadas: explicarRegrasAplicadas(servicoConfig, contexto),
        });
      });
  }

  if (tipoProposta === "auditoria" && itens.length === 0) {
    itens.push({
      servico: "Auditoria",
      valor: numeroCampo("valorAuditoria") || BASE.diagnostico || 2500,
      observacao: "Auditoria",
      topicosPersonalizados: obterTopicos("topicosAuditoria"),
    });
  }

  // DP, pró-labore, regulatórios e certificado são serviços contábeis: só FINORA e QMAX Contábil
  const ehContabilidade = ["finora", "contabil"].includes(tipoProposta);

  let codigoDP = null;

  if (ehContabilidade && funcionarios > 0) {
    if (funcionarios <= 20) {
      codigoDP = "dpAte20";
    } else if (funcionarios <= 40) {
      codigoDP = "dp21a40";
    } else {
      codigoDP = "dpAcima40";
    }
  }

  const valorDP = codigoDP
    ? calcularValorConfigurado(codigoDP, contexto, BASE[codigoDP])
    : 0;

  if (valorDP > 0) {
    itens.push({
      servico: "Departamento Pessoal",
      valor: valorDP,
      observacao: `${funcionarios} func.`,
    });
  }

  const valorProLabore = calcularValorConfigurado(
    "proLabore",
    contexto,
    BASE.proLabore,
  );

  if (ehContabilidade && valorProLabore > 0) {
    itens.push({
      servico: "Pró-labore",
      valor: valorProLabore,
      observacao: `${socios} sócio(s)`,
    });
  }

  function calcularRegulatorio(m, km) {
    const valorBase = calcularValorConfigurado(
      "regulatorio",
      contexto,
      BASE.regulatorio,
    );

    let v = valorBase * (m <= 50 ? 1 : 1 + Math.ceil((m - 50) / 50) * 0.5);

    return km > 50 ? v * 1.15 : v;
  }

  if (ehContabilidade && valorCampo("temCRO") === "Não") {
    itens.push({
      servico: "Inscrição CRO",
      valor: calcularValorConfigurado("cro", contexto, BASE.cro),
      observacao: "+ Taxas",
    });
  }

  if (ehContabilidade && valorCampo("temAlvara") === "Não") {
    itens.push({
      servico: "Alvará Func.",
      valor: calcularRegulatorio(metragem, distanciaKm),
      observacao: "+ Taxas",
    });
  }

  if (ehContabilidade && valorCampo("temAVCB") === "Não") {
    itens.push({
      servico: "AVCB",
      valor: calcularRegulatorio(metragem, distanciaKm),
      observacao: "+ Taxas",
    });
  }

  if (ehContabilidade && valorCampo("temVigilancia") === "Não") {
    itens.push({
      servico: "Vigilância San.",
      valor: calcularRegulatorio(metragem, distanciaKm),
      observacao: "+ Taxas",
    });
  }

  // Campo escondido (Pessoa Física ou outras marcas) não pode gerar cobrança com o valor padrão
  const secaoCert = document.getElementById("secaoCertificadoDigital");
  const certVisivel = ehContabilidade && (!secaoCert || secaoCert.style.display !== "none");
  const cert = certVisivel ? valorCampo("certificadoDigital") : "";

  if (cert === "Não") {
    itens.push({
      servico: "Certificado Digital",
      valor: calcularValorConfigurado(
        "certificado",
        contexto,
        BASE.certificado,
      ),
      observacao: "Emissão",
    });
  }

  if (cert === "Vencido") {
    itens.push({
      servico: "Renovação Certificado",
      valor: calcularValorConfigurado(
        "certificado",
        contexto,
        BASE.certificado,
      ),
      observacao: "Renovação",
    });
  }
  if (checked("servicoPersonalizado")) {
    itens.push({
      servico: "Proposta Personalizada",
      valor: numeroCampo("valorPersonalizado") || 1500,
      observacao: "Serviço personalizado",
      topicosPersonalizados: obterTopicos("topicosPersonalizados"),
    });
  }

  if (checked("servicoAuditoria")) {
    itens.push({
      servico: "Auditoria",
      valor: numeroCampo("valorAuditoria") || 2500,
      observacao: "Auditoria",
      topicosPersonalizados: obterTopicos("topicosAuditoria"),
    });
  }

  return itens;
}
function separarTotais(itens) {
  let totalMensal = 0;
  let totalPontual = 0;

  itens.forEach((item) => {
    const obs = (item.observacao || "").toLowerCase();

    if (
      obs.includes("pontual") ||
      obs.includes("implanta") || // cobre "Implantação" e "implanta"
      obs.includes("taxas") ||
      obs.includes("emissão") ||
      obs.includes("renovação")
    ) {
      totalPontual += Number(item.valor);
    } else {
      totalMensal += Number(item.valor);
    }
  });

  return {
    totalMensal,
    totalPontual,
    totalGeral: totalMensal + totalPontual,
  };
}
let descontosPorServico = {};

function aplicarDescontoNosItens(itens) {
  return itens.map((item) => {
    const desconto = Number(descontosPorServico[item.servico] || 0);
    const valorOriginal = Number(item.valor || 0);
    const valorDesconto = valorOriginal * (desconto / 100);
    const valorComDesconto = valorOriginal - valorDesconto;

    return {
      ...item,
      valorOriginal,
      descontoPercentual: desconto,
      valorDesconto,
      valor: valorComDesconto,
    };
  });
}
function renderizarResumoRegras(itens) {
  const box = document.getElementById("resumoRegrasAplicadas");
  if (!box) return;

  const regras = [];

  itens.forEach((item) => {
    if (item.regrasAplicadas && item.regrasAplicadas.length) {
      item.regrasAplicadas.forEach((regra) => regras.push(regra));
    }
  });

  const unicas = [...new Set(regras)];

  if (!unicas.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px;">
      <strong style="display:block; margin-bottom:8px; color:#0f172a;">
        Regras consideradas
      </strong>
      ${unicas
        .map(
          (regra) => `
        <div style="font-size:12px; color:#475569; margin-bottom:6px;">
          • ${regra}
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}
function gerarProposta() {
  const itens = aplicarDescontoNosItens(obterItensCalculados());
  const { totalMensal, totalPontual, totalGeral } = separarTotais(itens);
  renderizarResumoRegras(itens);
  const alertaDiv = document.getElementById("alertaLucroReal");
  if (valorCampo("regimeFiscal") === "Lucro Real") {
    alertaDiv.innerHTML =
      '<div class="alerta"><strong>Atenção:</strong> Lucro Real exige análise técnica. Valores automáticos suspensos.</div>';
  } else {
    alertaDiv.innerHTML = "";
  }

  const tbody = document.getElementById("resultadoTabelaBody");
  tbody.innerHTML = "";

  if (!itens.length) {
    tbody.innerHTML =
      '<tr><td colspan="2" style="text-align:center; color:#666;">Nenhum serviço selecionado</td></tr>';
  } else {
    itens.forEach((item) => {
      const temDesconto = Number(item.descontoPercentual || 0) > 0;

      tbody.innerHTML += `
    <tr>
      <td>
        ${escapeHTML(item.servico)}
        <br>
<small style="color:#666;">${escapeHTML(item.observacao || "")}</small>
${
  item.regrasAplicadas && item.regrasAplicadas.length
    ? `<div style="margin-top:6px; color:#0f766e; font-size:11px; line-height:1.4;">
        ${item.regrasAplicadas.map((r) => `• ${r}`).join("<br>")}
      </div>`
    : ""
}   
     ${
       temDesconto
         ? `<br><small style="color:#ef4444; font-weight:700;">
                Desconto: ${item.descontoPercentual}% 
                (-${moeda.format(item.valorDesconto)})
              </small>`
         : ""
     }
      </td>
      <td>
        ${
          temDesconto
            ? `<small style="text-decoration:line-through; color:#94a3b8;">
                ${moeda.format(item.valorOriginal)}
              </small><br>`
            : ""
        }
        <strong>${moeda.format(item.valor)}</strong>
      </td>
    </tr>
  `;
    });
  }

  document.getElementById("totalMensal").innerText = moeda.format(totalMensal);
  document.getElementById("totalPontual").innerText =
    moeda.format(totalPontual);
  document.getElementById("totalProposta").innerText = moeda.format(totalGeral);

  // Exibir economia total gerada por descontos
  const totalDesconto = itens.reduce((acc, item) => acc + (Number(item.valorDesconto) || 0), 0);
  const boxEconomia = document.getElementById("boxTotalDescontoEconomia");
  const elValorEconomia = document.getElementById("valorEconomiaDesconto");

  if (boxEconomia && elValorEconomia) {
    if (totalDesconto > 0) {
      boxEconomia.style.display = "flex";
      boxEconomia.style.justifyContent = "space-between";
      boxEconomia.style.alignItems = "center";
      elValorEconomia.textContent = `- ${moeda.format(totalDesconto)}`;
    } else {
      boxEconomia.style.display = "none";
    }
  }

  if (typeof atualizarCalculoRoi === "function") {
    atualizarCalculoRoi(totalMensal);
  }


  if (typeof calcularProbabilidadeFechamento === "function") {
    const score = calcularProbabilidadeFechamento();
    const elWin = document.getElementById("reviewBadgeWinRate");
    if (elWin) {
      elWin.textContent = `Chance: ${score}% ${score >= 70 ? 'Alta' : 'Média'}`;
      elWin.style.background = score >= 70 ? '#10b981' : '#f59e0b';
    }
  }
}


async function enviarCertificadoDigital(propostaId) {
  const inputArquivo = document.getElementById("arquivoCertificadoDigital");
  const arquivo = inputArquivo?.files?.[0];
  const status = document.getElementById("certificadoDigital")?.value || "Não";

  if (status !== "Sim" || !arquivo) return { enviado: false };
  if (!propostaId) throw new Error("A proposta foi criada, mas o identificador para o certificado não foi retornado.");
  if (!/\.(pfx|p12)$/i.test(arquivo.name)) throw new Error("O certificado deve estar no formato .PFX ou .P12.");
  if (arquivo.size > 10 * 1024 * 1024) throw new Error("O certificado não pode ultrapassar 10 MB.");

  const senha = document.getElementById("senhaCertificadoDigital")?.value || "";
  const senhaBase64 = senha ? btoa(unescape(encodeURIComponent(senha))) : "";

  const response = await fetch(`/api/propostas/${encodeURIComponent(propostaId)}/certificado`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
      "X-Certificado-Nome": encodeURIComponent(arquivo.name),
      "X-Certificado-Senha": senhaBase64,
    },
    body: arquivo,
  });

  const resultado = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(resultado.error || "Não foi possível armazenar o certificado digital.");
  return { enviado: true, ...resultado };
}

async function salvarEEnviarProposta() {
  if (!validarOnboardingV2()) return;

  // Validação Visual de Campos Obrigatórios com Shake Animation
  const camposObrigatorios = [
    { id: "nomeClinica", nome: "Nome da Clínica / Empresa" },
    { id: "nomeSocio", nome: "Nome do Responsável / Sócio" },
    { id: "email", nome: "E-mail do Cliente", validarEmail: true },
    { id: "telefone", nome: "Telefone / WhatsApp" }
  ];

  let temErro = false;
  let primeiroCampoComErro = null;

  camposObrigatorios.forEach(({ id, validarEmail }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.remove("input-error");
    let valor = (el.value || "").trim();

    let invalido = !valor;
    
    // Se for PF ou Híbrida e não tiver nome da clínica, a gente copia do nome do sócio
    if (id === "nomeClinica" && invalido) {
      const tipo = document.querySelector('input[name="tipoPessoa"]:checked')?.value;
      if (tipo === "PF" || tipo === "HIBRIDA") {
        invalido = false;
        valor = (document.getElementById("nomeSocio")?.value || "").trim();
        el.value = valor;
      }
    }

    if (validarEmail && valor) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalido = !emailRegex.test(valor);
    }

    if (invalido) {
      temErro = true;
      el.classList.add("input-error");
      if (!primeiroCampoComErro) primeiroCampoComErro = el;

      // Remover efeito de erro assim que o usuário começar a digitar
      el.addEventListener("input", () => el.classList.remove("input-error"), { once: true });
    }
  });

  if (temErro && primeiroCampoComErro) {
    primeiroCampoComErro.scrollIntoView({ behavior: "smooth", block: "center" });
    primeiroCampoComErro.focus();
    if (window.showToast) {
      window.showToast("Por favor, preencha os campos obrigatórios destacados em vermelho.", "warning");
    }
    return;
  }

  const itens = aplicarDescontoNosItens(obterItensCalculados());
  const { totalMensal, totalPontual, totalGeral } = separarTotais(itens);
  const roleUsuario = localStorage.getItem("finora_role");

  if (existeDescontoMaiorQue20(itens) && !["Diretor"].includes(roleUsuario)) {
    const confirmar = confirm(
      "Existe desconto acima de 20%. A proposta será enviada para aprovação da diretoria antes de ir para o cliente. Deseja continuar?",
    );

    if (!confirmar) return;
  }
  const btn = document.getElementById("btnEnviar");
  const textoOriginal = btn.innerText;

  btn.innerText = "Gerando e Enviando...";
  btn.disabled = true;

  const payload = {
    numeroProposta: "", // Back-end controla
    dataProposta: valorCampo("dataProposta"),
    nomeClinica: valorCampo("nomeClinica"),
    razaoSocial: valorCampo("razaoSocial"),
    cnpj: valorCampo("cnpj"),
    nomeSocio: valorCampo("nomeSocio"),
    cpfSocio: valorCampo("cpfSocio"),
    email: valorCampo("email"),
    telefone: valorCampo("telefone"),
    videoPitch: valorCampo("videoPitch"),
    audioPitch: document.getElementById("audioPitchBase64")?.value || "",
    enderecoClinica: valorCampo("enderecoClinica"),
    cadeiras: numeroCampo("cadeiras"),
    funcionarios: numeroCampo("funcionarios"),
    socios: numeroCampo("socios"),
    faturamento: numeroCampo("faturamento"),
    regimeFiscal: valorCampo("regimeFiscal"),
    regimeHibrido: valorCampo("regimeHibrido"),
    distanciaKm: numeroCampo("distanciaKm"),
    metragem: numeroCampo("metragem"),

    // Dados cadastrais e operacionais da versão 2
    ...obterDadosOnboardingV2(),

    totalMensal,
    totalPontual,
    tipoProposta: valorCampo("tipoProposta"),
    empresaProposta:
      valorCampo("tipoProposta") === "tech"
        ? "TECH"
        : valorCampo("tipoProposta") === "contabil"
          ? "QMAX"
          : valorCampo("tipoProposta") === "auditoria"
            ? "AUDITORIA"
            : valorCampo("tipoProposta") === "lagerhaus"
              ? "LAGERHAUS"
              : "FINORA",
    total: totalGeral,
    justificativaDesconto: valorCampo("justificativaDesconto"),
    itens,
    // Opções de Customização do PDF
    pdfTheme: obterPdfTheme(),
    pdfCover: document.getElementById("pdfCover")?.checked ?? false,
    showApresentacao: document.getElementById("pdfShowApresentacao")?.checked ?? true,
    showCondicoesGerais: document.getElementById("pdfShowCondicoes")?.checked ?? true,
  };

  try {
    const response = await fetch("/api/propostas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      try {
        await enviarCertificadoDigital(data.propostaId);
      } catch (certificadoError) {
        console.error("Falha ao enviar certificado:", certificadoError);
        alert(`A proposta foi criada, mas o certificado não foi armazenado.\n\n${certificadoError.message}`);
      }

      // Limpar rascunho
      localStorage.removeItem("qmax_proposta_rascunho");

      // Tocar som de celebração comercial ("Cha-Ching!")
      if (typeof tocarSomVenda === "function") tocarSomVenda();

      // QR code de assinatura presencial aponta para a proposta recém-gerada
      window.tokenPropostaAtual = data.tokenAcesso || null;

      // Se veio do CRM de Leads, associar proposta e mover status
      if (window.CRM_LEAD_ID && data.propostaId) {
        try {
          await fetch(`/api/leads/${window.CRM_LEAD_ID}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
            },
            body: JSON.stringify({
              proposta_id: data.propostaId,
              status: "Proposta Enviada",
            }),
          });
        } catch (crmError) {
          console.warn("Falha ao associar proposta ao lead no CRM:", crmError);
        }
      }

      if (data.aguardandoAprovacao) {
        // Proposta aguardando aprovação da diretoria
        abrirModalCompartilhar({
          aguardandoAprovacao: true,
          nomeClinica: payload.nomeClinica,
          link: null,
          telefone: payload.telefone,
        });
      } else {
        // Proposta gerada com sucesso
        abrirModalCompartilhar({
          aguardandoAprovacao: false,
          nomeClinica: payload.nomeClinica,
          link: data.link,
          telefone: payload.telefone,
          email: payload.email,
          emailEnviado: data.emailEnviado !== false,
        });
      }
    } else if (response.status === 429) {
      // Limpar rascunho (pois a proposta foi salva com sucesso no banco de dados e enviada por e-mail normal)
      localStorage.removeItem("qmax_proposta_rascunho");

      // Abrir o hub de compartilhamento para o comercial copiar o link comum
      abrirModalCompartilhar({
        aguardandoAprovacao: false,
        nomeClinica: payload.nomeClinica,
        link: data.link,
        telefone: payload.telefone,
        email: payload.email,
        emailEnviado: data.emailEnviado !== false,
      });

      // Tratar rate limit da D4Sign com cronômetro regressivo no botão
      let segundosRestantes = data.retryAfter || 60;
      btn.innerText = `Aguarde ${segundosRestantes}s para reenviar`;
      btn.disabled = true;

      const intervalo = setInterval(() => {
        segundosRestantes--;
        if (segundosRestantes <= 0) {
          clearInterval(intervalo);
          btn.innerText = textoOriginal;
          btn.disabled = false;
        } else {
          btn.innerText = `Aguarde ${segundosRestantes}s para reenviar`;
        }
      }, 1000);

      alert(`${data.error}`);
      return;
    } else {
      alert("Erro: " + (data.error || "Ocorreu um erro ao processar a proposta."));
    }
  } catch (error) {
    alert("Erro crítico de conexão com o servidor.");
  } finally {
    // Só reativa o botão se não estivermos sob o bloqueio do rate limit
    if (!btn.innerText.includes("Aguarde")) {
      btn.innerText = textoOriginal;
      btn.disabled = false;
    }
  }
}
// Inicia o cálculo na tela
carregarRegrasPrecificacao();

// ===========================
// HUB DE COMPARTILHAMENTO
// ===========================

// Estado global do hub
let _shareData = {};

function abrirModalCompartilhar({ aguardandoAprovacao, nomeClinica, link, telefone, email, emailEnviado = true }) {
  // Garante que o link de compartilhamento use dinamicamente o domínio atual do navegador
  if (link && typeof link === "string" && window.location?.origin) {
    try {
      const parsed = new URL(link);
      link = `${window.location.origin}${parsed.pathname}${parsed.search}`;
    } catch {}
  }
  _shareData = { aguardandoAprovacao, nomeClinica, link, telefone, email };

  const modal = document.getElementById("modalCompartilhar");
  const subTitle = document.getElementById("shareClienteNome");
  const linkInput = document.getElementById("shareLinkInput");
  const linkBox = document.querySelector(".share-link-box");
  const channelsGrid = document.querySelector(".share-channels-grid");
  const msgPreview = document.getElementById("shareMsgPreview");

  if (!modal) return;

  // Limpar estado anterior
  msgPreview.classList.remove("visible");
  document.getElementById("btnCopyMsg")?.classList.remove("copied");
  document.getElementById("shareCopyLinkBtn")?.classList.remove("copied");

  if (aguardandoAprovacao) {
    subTitle.textContent = `A proposta de ${nomeClinica || 'cliente'} foi enviada para aprovação da diretoria.`;
    if (linkBox) linkBox.style.display = "none";
    if (channelsGrid) channelsGrid.style.display = "none";
  } else {
    subTitle.textContent = emailEnviado
      ? `A proposta para ${nomeClinica || 'cliente'} foi gerada e o e-mail foi enviado!`
      : `A proposta para ${nomeClinica || 'cliente'} foi gerada, mas o e-mail NÃO foi enviado. Envie o link abaixo pelo WhatsApp ou copie e mande ao cliente.`;
    subTitle.style.color = emailEnviado ? "" : "#b91c1c";
    if (linkBox) linkBox.style.display = "block";
    if (channelsGrid) channelsGrid.style.display = "grid";
    if (linkInput) linkInput.value = link || "";
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

window.fecharModalCompartilhar = function() {
  const modal = document.getElementById("modalCompartilhar");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";

  // Resetar formulário após fechar
  document.getElementById("propostaForm")?.reset();
  descontosPorServico = {};
  preencherDataProposta();
  trocarTipoProposta();
  gerarProposta();
};

window.iniciarNovaProposta = function() {
  fecharModalCompartilhar();
  // Scroll suave para o topo
  window.scrollTo({ top: 0, behavior: "smooth" });
};

let _templateMensagemSelecionado = "consultivo";

window.selecionarTemplateMensagem = function(tipo, btn) {
  _templateMensagemSelecionado = tipo;
  document.querySelectorAll(".btn-share-tpl").forEach((b) => {
    b.classList.remove("filtro-ativo");
    b.classList.add("btn-mini-light");
  });
  if (btn) {
    btn.classList.add("filtro-ativo");
    btn.classList.remove("btn-mini-light");
  }
  const preview = document.getElementById("shareMsgPreview");
  if (preview) {
    preview.textContent = _montarMensagem(tipo);
  }
};

function _montarMensagem(tipo = _templateMensagemSelecionado) {
  const { nomeClinica, nomeSocio, link } = _shareData;
  const nome = nomeClinica || "sua empresa";
  const responsavel = nomeSocio ? nomeSocio.split(" ")[0] : "Prezado(a)";

  if (tipo === "direto") {
    return `Olá, ${responsavel}! Segue o link de acesso seguro à proposta comercial personalizada para a *${nome}*:\n\n🔗 ${link}\n\nQualquer dúvida estou à disposição! 🚀`;
  }

  if (tipo === "desconto") {
    return `Olá, ${responsavel}! Conseguimos aprovar uma condição comercial especial e exclusiva para a *${nome}*.\n\nConfira os valores e a proposta completa no link seguro abaixo:\n🔗 ${link}\n\nAguardamos seu de acordo para darmos início! 💼`;
  }

  // Padrão: Consultivo
  return `Olá, ${responsavel}! Conforme conversamos, preparamos a proposta comercial personalizada da *${nome}* com foco em eficiência tributária, redução de custos e governança:\n\n📄 *Acesse a proposta online:*\n🔗 ${link}\n\nEstou à disposição para alinharmos os próximos passos!\n\nAtenciosamente,\nEquipe Comercial Q-MAX`;
}

window.copiarLink = async function() {
  const { link } = _shareData;
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    const btn = document.getElementById("shareCopyLinkBtn");
    const icon = document.getElementById("shareCopyLinkIcon");
    const text = document.getElementById("shareCopyLinkText");
    if (btn) { btn.classList.add("copied"); }
    if (icon) icon.textContent = "✓";
    if (text) text.textContent = "Copiado!";
    setTimeout(() => {
      if (btn) btn.classList.remove("copied");
      if (icon) icon.textContent = "";
      if (text) text.textContent = "Copiar";
    }, 2500);
  } catch {
    // fallback
    const el = document.getElementById("shareLinkInput");
    if (el) { el.select(); document.execCommand("copy"); }
  }
};

window.compartilharWhatsApp = function() {
  const { link, telefone } = _shareData;
  const msg = encodeURIComponent(_montarMensagem());
  const tel = (telefone || "").replace(/\D/g, "");
  const url = tel
    ? `https://wa.me/55${tel}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank", "noopener");
};

window.compartilharSMS = function() {
  const { telefone } = _shareData;
  const msg = encodeURIComponent(_montarMensagem());
  const tel = (telefone || "").replace(/\D/g, "");
  const url = tel ? `sms:+55${tel}?body=${msg}` : `sms:?body=${msg}`;
  window.open(url);
};

window.compartilharEmail = function() {
  const { nomeClinica, link, email } = _shareData;
  const assunto = encodeURIComponent(`Proposta Comercial — ${nomeClinica || 'Q-MAX'}`);
  const corpo = encodeURIComponent(
    `Olá!\n\nSegue o link da proposta comercial preparada para ${nomeClinica || 'você'}:\n\n${link}\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\nEquipe Comercial Q-MAX`
  );
  const dest = email ? encodeURIComponent(email) : "";
  window.open(`mailto:${dest}?subject=${assunto}&body=${corpo}`);
};

window.copiarMensagem = async function() {
  const msg = _montarMensagem();
  const btn = document.getElementById("btnCopyMsg");
  const icon = document.getElementById("copyMsgIcon");
  const preview = document.getElementById("shareMsgPreview");

  try {
    await navigator.clipboard.writeText(msg);
  } catch {
    // fallback textarea
    const ta = document.createElement("textarea");
    ta.value = msg;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  // Feedback visual
  if (btn) btn.classList.add("copied");
  if (icon) icon.textContent = "✓";
  setTimeout(() => {
    if (btn) btn.classList.remove("copied");
    if (icon) icon.textContent = "";
  }, 2500);

  // Mostrar preview da mensagem
  if (preview) {
    preview.textContent = msg;
    preview.classList.add("visible");
  }
};

// Fechar ao pressionar Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    fecharPreviewPdf();
    fecharModalCompartilhar();
  }
});

// ===========================
// HELPERS DO CUSTOMIZADOR PDF
// ===========================
function obterPdfTheme() {
  const checked = document.querySelector('input[name="pdfTheme"]:checked');
  return checked ? checked.value : "moderno";
}

function obterPayloadPreview() {
  const itens = aplicarDescontoNosItens(obterItensCalculados());
  const { totalMensal, totalPontual, totalGeral } = separarTotais(itens);

  return {
    nomeClinica: valorCampo("nomeClinica") || "Cliente",
    razaoSocial: valorCampo("razaoSocial") || "",
    nomeSocio: valorCampo("nomeSocio") || "",
    email: valorCampo("email") || "preview@email.com",
    telefone: valorCampo("telefone") || "",
    enderecoClinica: valorCampo("enderecoClinica") || "",
    cadeiras: numeroCampo("cadeiras"),
    funcionarios: numeroCampo("funcionarios"),
    socios: numeroCampo("socios"),
    faturamento: numeroCampo("faturamento"),
    regimeFiscal: valorCampo("regimeFiscal") || "",
    regimeHibrido: valorCampo("regimeHibrido") || "",
    distanciaKm: numeroCampo("distanciaKm"),
    metragem: numeroCampo("metragem"),
    ...obterDadosOnboardingV2(),
    tipoProposta: valorCampo("tipoProposta"),
    empresaProposta: valorCampo("tipoProposta") === "tech" ? "TECH" :
      valorCampo("tipoProposta") === "contabil" ? "QMAX" :
      valorCampo("tipoProposta") === "auditoria" ? "AUDITORIA" : "FINORA",
    totalMensal,
    totalPontual,
    total: totalGeral,
    itens,
    pdfTheme: obterPdfTheme(),
    pdfCover: document.getElementById("pdfCover")?.checked ?? false,
    showApresentacao: document.getElementById("pdfShowApresentacao")?.checked ?? true,
    showCondicoesGerais: document.getElementById("pdfShowCondicoes")?.checked ?? true,
  };
}

// ===========================
// PREVIEW DO PDF
// ===========================
window.abrirPreviewPdf = async function() {
  const modal = document.getElementById("modalPreviewPdf");
  const loading = document.getElementById("previewLoading");
  const iframe = document.getElementById("previewIframe");
  const badge = document.getElementById("previewThemeBadge");

  if (!modal) return;

  // Atualizar badge do tema
  const themeNomes = { moderno: "Moderno", classico: "Clássico", criativo: "Criativo" };
  const themeSelecionado = obterPdfTheme();
  if (badge) badge.textContent = themeNomes[themeSelecionado] || "Moderno";

  // Mostrar modal e loading
  modal.classList.remove("hidden");
  loading.style.display = "flex";
  iframe.style.display = "none";

  // Bloquear scroll do body
  document.body.style.overflow = "hidden";

  try {
    const payload = obterPayloadPreview();
    const token = localStorage.getItem("finora_token");

    const response = await fetch("/api/propostas/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro ao gerar preview.");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    iframe.src = blobUrl;
    loading.style.display = "none";
    iframe.style.display = "block";
  } catch (error) {
    loading.style.display = "none";
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    if (window.showToast) {
      window.showToast("Erro ao gerar visualização: " + error.message, "danger");
    } else {
      alert("Erro ao gerar visualização: " + error.message);
    }
  }
};

window.fecharPreviewPdf = function() {
  const modal = document.getElementById("modalPreviewPdf");
  const iframe = document.getElementById("previewIframe");

  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";

  // Liberar URL do blob para economizar memória
  if (iframe && iframe.src && iframe.src.startsWith("blob:")) {
    URL.revokeObjectURL(iframe.src);
    iframe.src = "";
  }
};

window.confirmarEEnviar = function() {
  fecharPreviewPdf();
  // Chama o envio normal
  salvarEEnviarProposta();
};

function somenteNumeros(valor) {
  return valor.replace(/\D/g, "");
}

function formatarCPF(valor) {
  return somenteNumeros(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarCNPJ(valor) {
  return somenteNumeros(valor)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(valor) {
  const numeros = somenteNumeros(valor).slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }

  return numeros
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function formatarCEP(valor) {
  return somenteNumeros(valor)
    .slice(0, 8)
    .replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

function atualizarEnderecoCompleto() {
  const logradouro = document.getElementById("logradouroClinica") ? document.getElementById("logradouroClinica").value : "";
  const numero = document.getElementById("numeroClinica") ? document.getElementById("numeroClinica").value : "";
  const complemento = document.getElementById("complementoClinica") ? document.getElementById("complementoClinica").value : "";
  const bairro = document.getElementById("bairroClinica") ? document.getElementById("bairroClinica").value : "";
  const cidade = document.getElementById("cidadeClinica") ? document.getElementById("cidadeClinica").value : "";
  const uf = document.getElementById("ufClinica") ? document.getElementById("ufClinica").value : "";
  const cep = document.getElementById("cep") ? document.getElementById("cep").value : "";
  
  const completo = `${logradouro}, ${numero || "S/N"}${complemento ? " - " + complemento : ""}, ${bairro}, ${cidade} - ${uf}, CEP: ${cep}`;
  const el = document.getElementById("enderecoClinica");
  if (el) el.value = completo;
}

// --- AUTO-SAVE & DRAFT RECOVERY SYSTEM ---
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function salvarRascunhoLocal() {
  const form = document.getElementById("propostaForm");
  if (!form) return;

  const dados = {
    tipoProposta: valorCampo("tipoProposta"),
    nomeClinica: valorCampo("nomeClinica"),
    razaoSocial: valorCampo("razaoSocial"),
    cnpj: valorCampo("cnpj"),
    nomeSocio: valorCampo("nomeSocio"),
    cpfSocio: valorCampo("cpfSocio"),
    email: valorCampo("email"),
    telefone: valorCampo("telefone"),
    cep: valorCampo("cep"),
    logradouroClinica: valorCampo("logradouroClinica"),
    numeroClinica: valorCampo("numeroClinica"),
    complementoClinica: valorCampo("complementoClinica"),
    bairroClinica: valorCampo("bairroClinica"),
    cidadeClinica: valorCampo("cidadeClinica"),
    ufClinica: valorCampo("ufClinica"),
    enderecoClinica: valorCampo("enderecoClinica"),
    cadeiras: valorCampo("cadeiras"),
    funcionarios: valorCampo("funcionarios"),
    socios: valorCampo("socios"),
    faturamento: valorCampo("faturamento"),
    regimeFiscal: valorCampo("regimeFiscal"),
    regimeHibrido: valorCampo("regimeHibrido"),
    distanciaKm: valorCampo("distanciaKm"),
    metragem: valorCampo("metragem"),
    planoTech: valorCampo("planoTech"),
    temCRO: valorCampo("temCRO"),
    temAlvara: valorCampo("temAlvara"),
    temAVCB: valorCampo("temAVCB"),
    temVigilancia: valorCampo("temVigilancia"),
    certificadoDigital: valorCampo("certificadoDigital"),
    tipoPessoa: tipoPessoaSelecionado(),
    proLabore: document.getElementById("proLabore")?.value || "Não",
    dentistasParceiros: document.getElementById("dentistasParceiros")?.value || "0",
    quantidadeSociosDetalhados: document.getElementById("quantidadeSociosDetalhados")?.value || "0",
    sociosDetalhados: obterSociosDetalhadosSeguro(),
    senhaCertificadoDigital: document.getElementById("senhaCertificadoDigital")?.value || "",
    justificativaDesconto: valorCampo("justificativaDesconto"),
    
    // Checkboxes
    techLanding: checked("techLanding"),
    techMarketing: checked("techMarketing"),
    techEmails: checked("techEmails"),
    techIndicacao: checked("techIndicacao"),
    techIdentidade: checked("techIdentidade"),
    servicoPersonalizado: checked("servicoPersonalizado"),
    servicoAuditoria: checked("servicoAuditoria"),

    // Custom textareas and inputs
    topicosPersonalizados: valorCampo("topicosPersonalizados"),
    topicosAuditoria: valorCampo("topicosAuditoria"),
    valorPersonalizado: valorCampo("valorPersonalizado"),
    valorAuditoria: valorCampo("valorAuditoria"),

    // Dynamic checkboxes checked codes
    servicosDinamicos: Array.from(document.querySelectorAll('[data-servico-dinamico="true"]:checked'))
      .map(cb => cb.dataset.codigo),
    
    // Discounts
    descontosPorServico: descontosPorServico
  };

  localStorage.setItem("qmax_proposta_rascunho", JSON.stringify(dados));

  const elAutoSave = document.getElementById("autoSaveText");
  if (elAutoSave) {
    const agora = new Date();
    const horaFmt = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    elAutoSave.textContent = `Salvo às ${horaFmt}`;
  }
}

window.restaurarRascunho = function() {
  const rascunho = localStorage.getItem("qmax_proposta_rascunho");
  if (!rascunho) return;

  try {
    const parsed = JSON.parse(rascunho);
    
    const tipo = parsed.tipoProposta || "finora";
    const tipoSelect = document.getElementById("tipoProposta");
    if (typeof window.selecionarEmpresaPortal === "function") {
      // Mesmo fluxo do clique no portal: select, badge, tema e fecha o seletor
      window.selecionarEmpresaPortal(tipo);
    } else if (tipoSelect) {
      tipoSelect.value = tipo;
      if (window.aplicarTemaEmpresa) {
        window.aplicarTemaEmpresa(tipo);
      }
    }
    
    const ids = [
      "nomeClinica", "razaoSocial", "cnpj", "nomeSocio", "cpfSocio", 
      "email", "telefone", "videoPitch", "cep", "logradouroClinica", "numeroClinica", 
      "complementoClinica", "bairroClinica", "cidadeClinica", "ufClinica", 
      "enderecoClinica", "cadeiras", "funcionarios", "socios", "faturamento", 
      "regimeFiscal", "regimeHibrido", "distanciaKm", "metragem", "planoTech",
      "temCRO", "temAlvara", "temAVCB", "temVigilancia", "certificadoDigital",
      "proLabore", "dentistasParceiros", "quantidadeSociosDetalhados",
      "senhaCertificadoDigital", "justificativaDesconto"
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && parsed[id] !== undefined) {
        el.value = parsed[id];
      }
    });

    if (parsed.tipoPessoa) {
      const radio = document.querySelector(`input[name="tipoPessoa"][value="${parsed.tipoPessoa}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (Array.isArray(parsed.sociosDetalhados)) {
      const quantidade = document.getElementById("quantidadeSociosDetalhados");
      if (quantidade) {
        quantidade.value = parsed.sociosDetalhados.length;
        quantidade.dispatchEvent(new Event("input", { bubbles: true }));
      }

      requestAnimationFrame(() => {
        document.querySelectorAll(".socio-card").forEach((card, index) => {
          const socio = parsed.sociosDetalhados[index] || {};
          const preencher = (seletor, valor) => {
            const campo = card.querySelector(seletor);
            if (campo) campo.value = valor ?? "";
          };
          preencher(".socio-nome", socio.nome);
          preencher(".socio-cpf", socio.cpf);
          preencher(".socio-participacao", socio.participacao);
          preencher(".socio-cargo", socio.cargo);
        });
        document.getElementById("propostaForm")?.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    const cbs = [
      "techLanding", "techMarketing", "techEmails", "techIndicacao", "techIdentidade",
      "servicoPersonalizado", "servicoAuditoria"
    ];
    cbs.forEach(id => {
      const el = document.getElementById(id);
      if (el && parsed[id] !== undefined) {
        el.checked = !!parsed[id];
      }
    });

    const textareas = ["topicosPersonalizados", "topicosAuditoria"];
    textareas.forEach(id => {
      const el = document.getElementById(id);
      if (el && parsed[id] !== undefined) {
        el.value = parsed[id];
      }
    });

    const customValInputs = ["valorPersonalizado", "valorAuditoria"];
    customValInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el && parsed[id] !== undefined) {
        el.value = parsed[id];
      }
    });

    window.rascunhoItensDinamicosParaMarcar = parsed.servicosDinamicos || [];
    
    if (parsed.descontosPorServico) {
      descontosPorServico = parsed.descontosPorServico;
    }

    trocarTipoProposta();
    
    if (window.toggleServicoEspecial) {
      window.toggleServicoEspecial();
    }

    const banner = document.getElementById("bannerRascunho");
    if (banner) {
      banner.classList.remove("show");
    }

    if (window.showToast) {
      window.showToast("Rascunho restaurado com sucesso!", "success");
    }
  } catch (e) {
    console.error("Erro ao restaurar rascunho", e);
    if (window.showToast) {
      window.showToast("Erro ao restaurar o rascunho.", "danger");
    }
  }
};

window.descartarRascunho = function() {
  localStorage.removeItem("qmax_proposta_rascunho");
  const banner = document.getElementById("bannerRascunho");
  if (banner) {
    banner.classList.remove("show");
  }
  if (window.showToast) {
    window.showToast("Rascunho descartado.", "info");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  preencherDataProposta();
  const campos = [
    { id: "cpfSocio", formatador: formatarCPF },
    { id: "cnpj", formatador: formatarCNPJ },
    { id: "telefone", formatador: formatarTelefone },
    { id: "cep", formatador: formatarCEP },
  ];

  campos.forEach(({ id, formatador }) => {
    const input = document.getElementById(id);

    if (input) {
      input.addEventListener("input", (event) => {
        event.target.value = formatador(event.target.value);
      });
    }
  });

  // Formata os CPFs dos sócios criados dinamicamente.
  document.getElementById("listaSociosDetalhados")?.addEventListener("input", (event) => {
    if (event.target.classList.contains("socio-cpf")) {
      event.target.value = formatarCPF(event.target.value);
    }
  });

  const addressIds = ["logradouroClinica", "numeroClinica", "complementoClinica", "bairroClinica", "cidadeClinica", "ufClinica", "cep"];
  addressIds.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", atualizarEnderecoCompleto);
    }
  });

  // Mostrar banner de rascunho se existir dados salvos
  const rascunho = localStorage.getItem("qmax_proposta_rascunho");
  if (rascunho) {
    try {
      const parsed = JSON.parse(rascunho);
      if (parsed && Object.keys(parsed).length > 0) {
        const banner = document.getElementById("bannerRascunho");
        if (banner) {
          banner.classList.add("show");
        }
      }
    } catch (e) {}
  }

  // Monitorar alterações no formulário
  const form = document.getElementById("propostaForm");
  if (form) {
    const debouncedSave = debounce(salvarRascunhoLocal, 500);
    // Só eventos do usuário: os disparados por código na carga da página
    // salvariam o formulário vazio por cima do rascunho antes de "Restaurar"
    const salvarSeUsuario = (e) => { if (e.isTrusted) debouncedSave(); };
    form.addEventListener("input", salvarSeUsuario);
    form.addEventListener("change", salvarSeUsuario);
  }

  trocarTipoProposta();
});
function abrirModalDescontos() {
  const itensBase = obterItensCalculados();
  const lista = document.getElementById("listaDescontos");

  const itensMensais = itensBase.filter((item) => {
    const obs = (item.observacao || "").toLowerCase();
    return (
      !obs.includes("pontual") &&
      !obs.includes("taxas") &&
      !obs.includes("emissão") &&
      !obs.includes("renovação")
    );
  });

  const itensPontuais = itensBase.filter((item) => {
    const obs = (item.observacao || "").toLowerCase();
    return (
      obs.includes("pontual") ||
      obs.includes("taxas") ||
      obs.includes("emissão") ||
      obs.includes("renovação")
    );
  });

  function renderTabela(titulo, itens) {
    if (!itens.length) return "";

    const linhas = itens
      .map((item) => {
        const descontoAtual = descontosPorServico[item.servico] || 0;
        const valorOriginal = Number(item.valor || 0);
        const valorComDesconto =
          valorOriginal - valorOriginal * (Number(descontoAtual) / 100);

        return `
          <tr>
            <td>
              <strong>${escapeHTML(item.servico)}</strong><br>
              <small>${escapeHTML(item.observacao || "-")}</small>
            </td>
            <td>${moeda.format(valorOriginal)}</td>
            <td>
              <input 
                type="number"
                min="0"
                max="100"
                value="${descontoAtual}"
                data-servico="${escapeHTML(item.servico)}"
                class="input-desconto"
                oninput="atualizarResumoDescontosModal()"
              />
            </td>
<td id="valor-final-${idSeguroServico(item.servico)}">
              ${moeda.format(valorComDesconto)}
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <h3 style="margin-top: 18px;">${titulo}</h3>
      <div class="table-responsive">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Valor Atual</th>
              <th>Desconto %</th>
              <th>Valor Final</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
          </tbody>
        </table>
      </div>
    `;
  }

  lista.innerHTML = `
    <div id="alertaDescontoDiretor" class="alerta-desconto hidden">
      Atenção: existe desconto acima de 20%. Ao salvar, a proposta será enviada para aprovação da diretoria e não será enviada ao cliente ainda.
    </div>

    ${renderTabela("Investimentos Mensais", itensMensais)}
    ${renderTabela("Investimentos Pontuais", itensPontuais)}

    <div class="resumo-desconto-modal">
      <div><span>Total Mensal:</span> <strong id="modalTotalMensal">R$ 0,00</strong></div>
      <div><span>Total Pontual:</span> <strong id="modalTotalPontual">R$ 0,00</strong></div>
      <div><span>Total Geral:</span> <strong id="modalTotalGeral">R$ 0,00</strong></div>
    </div>
  `;

  document.getElementById("modalDescontos").classList.remove("hidden");
  atualizarResumoDescontosModal();
}
function idSeguroServico(servico) {
  return servico.replace(/\W/g, "-");
}

function atualizarResumoDescontosModal() {
  const inputs = document.querySelectorAll(".input-desconto");
  const itensBase = obterItensCalculados();
  const descontosTemp = {};
  let temMaiorQue20 = false;

  inputs.forEach((input) => {
    const servico = input.dataset.servico;
    const desconto = Math.min(Math.max(Number(input.value || 0), 0), 100);

    input.value = desconto;
    descontosTemp[servico] = desconto;

    if (desconto > 20) temMaiorQue20 = true;
  });

  const itensComDesconto = itensBase.map((item) => {
    const desconto = Number(descontosTemp[item.servico] || 0);
    const valorOriginal = Number(item.valor || 0);
    const valorComDesconto = valorOriginal - valorOriginal * (desconto / 100);

    const campoValorFinal = document.getElementById(
      `valor-final-${idSeguroServico(item.servico)}`,
    );

    if (campoValorFinal) {
      campoValorFinal.innerText = moeda.format(valorComDesconto);
    }

    return {
      ...item,
      valor: valorComDesconto,
      descontoPercentual: desconto,
    };
  });

  const { totalMensal, totalPontual, totalGeral } =
    separarTotais(itensComDesconto);

  document.getElementById("modalTotalMensal").innerText =
    moeda.format(totalMensal);
  document.getElementById("modalTotalPontual").innerText =
    moeda.format(totalPontual);
  document.getElementById("modalTotalGeral").innerText =
    moeda.format(totalGeral);

  const alerta = document.getElementById("alertaDescontoDiretor");
  if (alerta) alerta.classList.toggle("hidden", !temMaiorQue20);
}

function fecharModalDescontos() {
  document.getElementById("modalDescontos").classList.add("hidden");
}

function confirmarDescontos() {
  const inputs = document.querySelectorAll(".input-desconto");

  inputs.forEach((input) => {
    const servico = input.dataset.servico;
    const desconto = Math.min(Math.max(Number(input.value || 0), 0), 100);
    descontosPorServico[servico] = desconto;
  });

  fecharModalDescontos();
  gerarProposta();

  alert(
    "Descontos aplicados. Agora revise os valores e clique em Salvar e Enviar Proposta.",
  );
}

function existeDescontoMaiorQue20(itens) {
  return itens.some((item) => Number(item.descontoPercentual || 0) > 20);
}

// 🏷️ CONTROLADOR DE DESCONTO COMERCIAL RÁPIDO
function aplicarDescontoRapido(percentual) {
  const perc = Math.max(0, Math.min(100, Number(percentual) || 0));
  const inputGlobal = document.getElementById("descontoGlobalInput");
  if (inputGlobal) inputGlobal.value = perc;

  // Atualizar visual dos chips
  document.querySelectorAll(".chip-desconto").forEach((chip) => {
    chip.classList.toggle("chip-ativo", Number(chip.dataset.desconto) === perc);
  });

  const itens = obterItensCalculados();
  descontosPorServico = {};
  itens.forEach((item) => {
    descontosPorServico[item.servico] = perc;
  });

  atualizarStatusDescontoVisual(perc);
  gerarProposta();
}

function aplicarDescontoInputManual(valor) {
  const perc = Math.max(0, Math.min(100, Number(valor) || 0));

  // Atualizar chips ativos
  document.querySelectorAll(".chip-desconto").forEach((chip) => {
    chip.classList.toggle("chip-ativo", Number(chip.dataset.desconto) === perc);
  });

  const itens = obterItensCalculados();
  descontosPorServico = {};
  itens.forEach((item) => {
    descontosPorServico[item.servico] = perc;
  });

  atualizarStatusDescontoVisual(perc);
  gerarProposta();
}

function limparDesconto() {
  aplicarDescontoRapido(0);
}

function atualizarStatusDescontoVisual(perc) {
  const badge = document.getElementById("badgeStatusDesconto");
  const boxJust = document.getElementById("boxJustificativaDesconto");

  if (boxJust) {
    boxJust.style.display = perc > 0 ? "block" : "none";
  }

  if (!badge) return;

  if (perc <= 0) {
    badge.style.display = "none";
  } else if (perc <= 20) {
    badge.style.display = "flex";
    badge.className = "badge-desconto-ok";
    badge.innerHTML = `Desconto de ${perc}% Autorizado (Envio Direto)`;
  } else {
    badge.style.display = "flex";
    badge.className = "badge-desconto-alerta";
    badge.innerHTML = `Desconto de ${perc}% (>20%) Requer Aprovação da Diretoria`;
  }
}

// ✨ ASSISTENTE DE JUSTIFICATIVA COM IA
window.sugerirJustificativaIA = function() {
  const nome = (document.getElementById("nomeClinica")?.value || "").trim() || "o cliente";
  const responsavel = (document.getElementById("nomeSocio")?.value || "").trim();
  const faturamentoNum = Number(document.getElementById("faturamento")?.value || 0);
  const cadeiras = document.getElementById("cadeiras")?.value || "2";
  const empCod = (document.getElementById("tipoProposta")?.value || "finora").toUpperCase();
  const percDesconto = document.getElementById("descontoGlobalInput")?.value || "25";

  const faturamentoFmt = faturamentoNum > 0
    ? `faturamento declarado de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(faturamentoNum)}/mês`
    : "alto volume operacional";

  const sugestoes = [
    `Parceria estratégica com ${nome}. Estrutura com ${cadeiras} cadeira(s) e ${faturamentoFmt}. A aplicação de ${percDesconto}% de desconto viabiliza o fechamento imediato do contrato anual de 12 meses no ecossistema ${empCod}, garantindo retenção a longo prazo.`,
    `Negociação competitiva com ${nome} (${responsavel ? `Dr(a). ${responsavel}` : 'gestão'}). O cliente solicitou condição de entrada diferenciada para migração contábil e implantação dos serviços. O desconto de ${percDesconto}% assegura o fechamento nesta semana.`,
    `Cliente de alto potencial na praça. A concessão do desconto de ${percDesconto}% foi acordada mediante compromisso de contratação de serviços adicionais e fidelidade contratual no ecossistema ${empCod}.`
  ];

  const escolhida = sugestoes[Math.floor(Math.random() * sugestoes.length)];

  const elJust = document.getElementById("justificativaDesconto");
  const elDashJust = document.getElementById("descJustificativa");

  if (elJust) {
    elJust.value = escolhida;
    elJust.style.transition = "background-color 0.4s ease";
    elJust.style.backgroundColor = "#f3e8ff";
    setTimeout(() => { elJust.style.backgroundColor = ""; }, 1200);
  }

  if (elDashJust) {
    elDashJust.value = escolhida;
  }
};

// 🔄 SINCRONIZAÇÃO BIDIRECIONAL DE REGIME HÍBRIDO
function sincronizarRegimeHibridoComTipoPessoa() {
  const elRegime = document.getElementById("regimeHibrido");
  if (!elRegime) return;

  const ehHibrido = elRegime.value === "Sim";
  const radioHibrida = document.querySelector('input[name="tipoPessoa"][value="HIBRIDA"]');
  const radioPj = document.querySelector('input[name="tipoPessoa"][value="PJ"]');

  if (ehHibrido && radioHibrida && !radioHibrida.checked) {
    radioHibrida.checked = true;
    if (typeof togglePfPj === "function") togglePfPj();
  } else if (!ehHibrido && radioHibrida && radioHibrida.checked && radioPj) {
    radioPj.checked = true;
    if (typeof togglePfPj === "function") togglePfPj();
  }
}
function usarTemplatePersonalizado() {
  document.getElementById("topicosPersonalizados").value = `Diagnóstico Inicial
- Levantamento documental
- Entrevista de alinhamento
- Identificação dos pontos críticos

Escopo do Trabalho
- Revisão financeira
- Revisão tributária
- Revisão operacional

Entregáveis
- Relatório executivo
- Plano de ação
- Reunião de apresentação`;
}

function usarTemplateAuditoria() {
  document.getElementById("topicosAuditoria").value = `Auditoria Financeira
- Fluxo de Caixa
- DRE
- Balancetes

Auditoria Tributária
- Regime tributário
- Obrigações acessórias
- Riscos fiscais

Conclusões
- Relatório final
- Recomendações
- Plano corretivo`;
}

function limparTopicos(id) {
  document.getElementById(id).value = "";
}

function trocarTipoProposta() {
  const tipo = valorCampo("tipoProposta");

  document.body.classList.remove("theme-finora", "theme-contabil", "theme-tech", "theme-auditoria", "theme-lagerhaus");
  document.body.classList.add(`theme-${tipo}`);

  const ehAuditoria = tipo === "auditoria";
  const ehTech = tipo === "tech";
  const ehContabil = tipo === "contabil";
  const ehFinora = tipo === "finora";
  const ehLagerhaus = tipo === "lagerhaus";

// Ajusta os textos dos dados cadastrais conforme a empresa selecionada
const labelNomeEmpresa = document.getElementById("labelNomeEmpresa");
const inputNomeEmpresa = document.getElementById("nomeClinica");
const inputEmail = document.getElementById("email");

if (labelNomeEmpresa && inputNomeEmpresa) {
  if (ehFinora) {
    labelNomeEmpresa.textContent = "Nome da Clínica";
    inputNomeEmpresa.placeholder = "Ex.: Clínica Sorriso Perfeito";

    if (inputEmail) {
      inputEmail.placeholder = "contato@clinica.com.br";
    }
  } else {
    labelNomeEmpresa.textContent = "Nome da Empresa";
    inputNomeEmpresa.placeholder = "Ex.: Empresa Exemplo Ltda.";

    if (inputEmail) {
      inputEmail.placeholder = "contato@empresa.com.br";
    }
  }
}
  // Controle de seções principais
  document.getElementById("secaoLocalizacao").style.display = (ehTech || ehAuditoria) ? "none" : "block";
  document.getElementById("secaoParametros").style.display = (ehTech || ehAuditoria) ? "none" : "block";
  document.getElementById("boxOutrosServicos").style.display = (ehTech || ehAuditoria) ? "none" : "block";
  
  const boxSecaoAuditoria = document.getElementById("boxSecaoAuditoria");
  if (boxSecaoAuditoria) {
    boxSecaoAuditoria.style.display = (ehTech || ehAuditoria) ? "none" : "block";
  }
  const boxAuditoriaContainer = document.getElementById("boxAuditoriaContainer");
  if (boxAuditoriaContainer) {
    boxAuditoriaContainer.style.display = ehAuditoria ? "block" : (ehTech ? "none" : (checked("servicoAuditoria") ? "block" : "none"));
  }

  document.getElementById("listaServicosDinamicos").style.display = ehTech ? "none" : "grid";
  document.getElementById("boxTech").style.display = ehTech ? "block" : "none";
  
  // Ocultar regularizações para Contabilidade, Tech, Finora, Auditoria e Lagerhaus
  document.getElementById("secaoRegularizacoes").style.display = (ehTech || ehContabil || ehFinora || ehAuditoria || ehLagerhaus)
    ? "none"
    : "grid";
  
  // Mostrar certificado digital para contabilidade e finora, ocultar para tech, auditoria e lagerhaus
  const elCertDig = document.getElementById("secaoCertificadoDigital");
  if (elCertDig) {
    elCertDig.style.display = (ehTech || ehAuditoria || ehLagerhaus) ? "none" : "block";
  }

  // Título dinâmico da Localização
  const tituloLocalizacao = document.getElementById("tituloLocalizacao");
  if (tituloLocalizacao) {
    tituloLocalizacao.innerText = "2. Localização e Distância";
  }

  // Controle de visibilidade de campos por empresa
  document.getElementById("grupoDistanciaKm").style.display = "block";
  document.getElementById("grupoCadeiras").style.display = ehContabil ? "none" : "block";
  document.getElementById("grupoMetragem").style.display = ehContabil ? "none" : "block";
  document.getElementById("grupoRegimeHibrido").style.display = ehContabil ? "none" : "block";

  // Resetar valores ocultados para não influenciarem nos cálculos (distanciaKm é mantida)
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  if (ehContabil) {
    setVal("cadeiras", "0");
    setVal("metragem", "0");
    setVal("regimeHibrido", "Não");
    setVal("temCRO", "Sim");
    setVal("temAlvara", "Sim");
    setVal("temAVCB", "Sim");
    setVal("temVigilancia", "Sim");
  }

  if (ehFinora || ehLagerhaus) {
    setVal("temCRO", "Sim");
    setVal("temAlvara", "Sim");
    setVal("temAVCB", "Sim");
    setVal("temVigilancia", "Sim");
  }

  if (ehTech) {
    atualizarPlanoTech();
  }

  if (typeof atualizarRevisao === "function") {
    atualizarRevisao();
  }

  if (typeof togglePfPj === "function") {
    togglePfPj();
  }

  carregarServicosDinamicos().then(() => {
    gerarProposta();
  });
}

function obterItensCalculadosTech() {
  const codigoPlano = valorCampo("planoTech");
  const plano = PLANOS_TECH.find((p) => p.codigo === codigoPlano);

  if (!plano) return [];

  return [
    {
      servico: plano.nome,
      valor: Number(plano.valor_implantacao || 0),
      observacao: "Implantação",
      detalhes: plano.servicos || [],
    },
    {
      servico: `Mensalidade ${plano.nome}`,
      valor: Number(plano.valor_mensalidade || 0),
      observacao: "Mensal",
    },
  ];
}
function obterServicosInclusosTech(planoCodigo) {
  const plano = PLANOS_TECH.find((p) => p.codigo === planoCodigo);
  return plano?.servicos || [];
}
function atualizarDescricaoPlanoTech() {
  const codigoPlano = valorCampo("planoTech");
  const box = document.getElementById("descricaoPlanoTech");
  if (!box) return;

  const plano = PLANOS_TECH.find((p) => p.codigo === codigoPlano);

  if (!plano) {
    box.innerHTML = "";
    return;
  }

  const inclusos = plano.servicos || [];

  box.innerHTML = `
    <strong>${plano.nome} inclui:</strong>
    <ul>
      ${inclusos.map((item) => `<li>${item}</li>`).join("")}
    </ul>
    <small>Os itens acima já estão inclusos no valor de implantação do plano.</small>
  `;
}
function atualizarPlanoTech() {
  const plano = valorCampo("planoTech");

  const landing = document.getElementById("techLanding");
  const marketing = document.getElementById("techMarketing");
  const emails = document.getElementById("techEmails");
  const indicacao = document.getElementById("techIndicacao");
  const identidade = document.getElementById("techIdentidade");

  landing.checked = false;
  marketing.checked = false;
  emails.checked = false;
  indicacao.checked = false;
  identidade.checked = false;

  landing.disabled = true;
  marketing.disabled = true;
  emails.disabled = true;
  indicacao.disabled = true;
  identidade.disabled = true;

  const inclusos = obterServicosInclusosTech(plano);

  landing.checked = inclusos.includes("Landing Page");
  marketing.checked = inclusos.includes("Marketing");
  emails.checked = inclusos.includes("E-mails Profissionais");
  indicacao.checked = inclusos.includes("Programa de Indicação");
  identidade.checked = inclusos.includes("Identidade Visual");

  atualizarDescricaoPlanoTech();
  gerarProposta();
}

async function buscarDadosCnpj() {
  const elCnpj = document.getElementById("cnpj");
  const elHint = document.getElementById("hintCnpj");
  if (!elCnpj) return;

  const cnpjLimpo = elCnpj.value.replace(/\D/g, "");

  if (cnpjLimpo.length !== 14) return;

  if (elHint) {
    elHint.textContent = "Buscando dados na Receita Federal...";
    elHint.style.color = "#0284c7";
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

    if (!response.ok) {
      throw new Error("CNPJ não encontrado");
    }

    const data = await response.json();

    // Auto-preenchimento Inteligente
    if (data.razao_social) {
      const elRazao = document.getElementById("razaoSocial");
      if (elRazao) elRazao.value = data.razao_social;
    }

    if (data.nome_fantasia || data.razao_social) {
      const elNomeClinica = document.getElementById("nomeClinica");
      if (elNomeClinica && !elNomeClinica.value.trim()) {
        elNomeClinica.value = data.nome_fantasia || data.razao_social;
      }
    }

    if (data.cep) {
      const elCep = document.getElementById("cep");
      if (elCep && !elCep.value.trim()) {
        elCep.value = data.cep;
        if (typeof buscarEnderecoEDistancia === "function") {
          buscarEnderecoEDistancia();
        }
      }
    }

    if (data.email) {
      const elEmail = document.getElementById("email");
      if (elEmail && !elEmail.value.trim()) {
        elEmail.value = data.email.toLowerCase();
      }
    }

    if (data.ddd_telefone_1) {
      const elTel = document.getElementById("telefone");
      if (elTel && !elTel.value.trim()) {
        elTel.value = data.ddd_telefone_1;
      }
    }

    if (elHint) {
      elHint.textContent = "Dados da empresa encontrados e preenchidos!";
      elHint.style.color = "#10b981";
    }

    if (typeof atualizarRevisao === "function") atualizarRevisao();
    if (typeof gerarProposta === "function") gerarProposta();

    // 🏢 Verificação inteligente de propostas anteriores para o mesmo CNPJ
    verificarHistoricoCnpj(cnpjLimpo);

  } catch (err) {
    console.warn("Erro ao buscar CNPJ:", err);
    if (elHint) {
      elHint.textContent = "Não foi possível carregar os dados automaticamente. Preencha manualmente.";
      elHint.style.color = "#f59e0b";
    }
  }
}

// 🏢 HISTÓRICO DE PROPOSTAS POR CNPJ
async function verificarHistoricoCnpj(cnpjLimpo) {
  try {
    const res = await fetchAuth(`/api/propostas/historico-cnpj/${cnpjLimpo}`);
    if (!res.ok) return;
    const historico = await res.json();

    const container = document.getElementById("alertaHistoricoCnpj");
    if (!container) return;

    if (historico && historico.length > 0) {
      const maisRecente = historico[0];
      // Objeto fica em variável; JSON dentro de onclick quebrava o atributo com aspas (XSS)
      window.PROPOSTA_ANTERIOR_CNPJ = maisRecente;
      const dataFmt = new Date(maisRecente.criado_em || maisRecente.data_proposta).toLocaleDateString("pt-BR");
      const valorFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(maisRecente.valor_total || 0));

      container.style.display = "block";
      container.innerHTML = `
        <div style="background:linear-gradient(135deg, #eff6ff, #dbeafe); border:1.5px solid #93c5fd; border-radius:14px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-top:12px;">
          <div>
            <strong style="color:#1e40af; font-size:13px; display:flex; align-items:center; gap:6px;">
              Histórico Encontrado: Proposta #${maisRecente.numero_proposta}
            </strong>
            <span style="font-size:12px; color:#3b82f6; display:block; margin-top:2px;">
              Gerada em ${dataFmt} • Status: <strong>${escapeHTML(maisRecente.status)}</strong> • Valor: <strong>${valorFmt}</strong>
            </span>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn-mini" style="background:#2563eb; color:#fff; padding:6px 12px; font-weight:800; border-radius:999px; cursor:pointer;" onclick="carregarDadosPropostaAnterior(window.PROPOSTA_ANTERIOR_CNPJ)">
              Clonar Parâmetros
            </button>
            <button type="button" class="btn-mini btn-mini-light" style="cursor:pointer;" onclick="document.getElementById('alertaHistoricoCnpj').style.display='none'">
              ✕
            </button>
          </div>
        </div>
      `;
    } else {
      container.style.display = "none";
    }
  } catch (err) {
    console.warn("Erro ao buscar histórico do CNPJ:", err);
  }
}

window.carregarDadosPropostaAnterior = function(prop) {
  if (!prop) return;
  if (prop.cadeiras !== undefined) document.getElementById("cadeiras").value = prop.cadeiras;
  if (prop.funcionarios !== undefined) document.getElementById("funcionarios").value = prop.funcionarios;
  if (prop.socios !== undefined) document.getElementById("socios").value = prop.socios;
  if (prop.faturamento !== undefined) document.getElementById("faturamento").value = prop.faturamento;
  if (prop.regime_fiscal) document.getElementById("regimeFiscal").value = prop.regime_fiscal;
  if (prop.regime_hibrido) document.getElementById("regimeHibrido").value = prop.regime_hibrido;
  if (prop.distancia_km !== undefined) document.getElementById("distanciaKm").value = prop.distancia_km;
  if (prop.metragem !== undefined) document.getElementById("metragem").value = prop.metragem;
  if (prop.nome_socio) document.getElementById("nomeSocio").value = prop.nome_socio;
  if (prop.cpf_socio) document.getElementById("cpfSocio").value = prop.cpf_socio;
  if (prop.email) document.getElementById("email").value = prop.email;
  if (prop.telefone) document.getElementById("telefone").value = prop.telefone;

  const alertContainer = document.getElementById("alertaHistoricoCnpj");
  if (alertContainer) alertContainer.style.display = "none";
  
  gerarProposta();
  alert(`Parâmetros da Proposta #${prop.numero_proposta} clonados com sucesso!`);
};

// 📄 RESUMO EXECUTIVO ONE-PAGER
window.gerarResumoExecutivoOnePager = function() {
  const dados = obterPayloadPreview();
  const itens = dados.itens || [];
  const { totalMensal, totalPontual, totalGeral } = separarTotais(itens);

  const nomeClinica = dados.nomeClinica || "Clínica";
  const responsavel = dados.nomeSocio || "Responsável";
  const cnpj = dados.cnpj || "Não informado";
  const dataFmt = new Date().toLocaleDateString("pt-BR");
  const empresa = (dados.empresaProposta || "FINORA").toUpperCase();

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita popups para visualizar o Resumo Executivo.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Resumo Executivo — ${nomeClinica}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
        .one-pager { border: 2px solid #0d9488; border-radius: 16px; padding: 24px; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px; }
        .brand { font-size: 24px; font-weight: 900; color: #0d9488; letter-spacing: -0.5px; }
        .tag { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; }
        .section-title { font-size: 13px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 14px 0 6px; }
        .grid-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; padding: 12px; border-radius: 10px; margin-bottom: 14px; }
        .grid-info div span { display: block; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
        .grid-info div strong { font-size: 13px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 800; color: #475569; border-radius: 4px; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
        .totals { margin-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .total-card { background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 12px; text-align: center; }
        .total-card.highlight { background: linear-gradient(135deg, #0d9488, #0284c7); color: #fff; border: none; }
        .total-card span { font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .total-card strong { display: block; font-size: 18px; font-weight: 900; margin-top: 4px; }
        .footer-terms { margin-top: 20px; font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; }
      </style>
    </head>
    <body onload="window.print()">
      <div class="one-pager">
        <div class="header">
          <div>
            <div class="brand">${empresa}</div>
            <small style="color:#64748b; font-weight:600;">Proposta Comercial & Resumo Executivo</small>
          </div>
          <div style="text-align:right;">
            <span class="tag">Validade: 10 dias corridos</span>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Emissão: ${dataFmt}</div>
          </div>
        </div>

        <div class="section-title">Dados do Cliente</div>
        <div class="grid-info">
          <div><span>Empresa / Clínica</span><strong>${nomeClinica}</strong></div>
          <div><span>CNPJ</span><strong>${cnpj}</strong></div>
          <div><span>Sócio Responsável</span><strong>${responsavel}</strong></div>
        </div>

        <div class="section-title">Escopo dos Serviços Contratados</div>
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Tipo</th>
              <th style="text-align:right;">Investimento</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map(i => `
              <tr>
                <td><strong>${escapeHTML(i.servico)}</strong><br><small style="color:#64748b;">${escapeHTML(i.observacao || "-")}</small></td>
                <td>${i.observacao && i.observacao.toLowerCase().includes('pontual') ? 'Pontual' : 'Mensal'}</td>
                <td style="text-align:right; font-weight:800;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(i.valor || 0))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-card">
            <span>Investimento Mensal</span>
            <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMensal)}</strong>
          </div>
          <div class="total-card">
            <span>Serviços Pontuais</span>
            <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPontual)}</strong>
          </div>
          <div class="total-card highlight">
            <span style="color:rgba(255,255,255,0.85);">Total da Proposta</span>
            <strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}</strong>
          </div>
        </div>

        <div class="footer-terms">
          <div>
            <strong>Condições:</strong> Pagamento via Pix (5% bônus 1º mês) ou Boleto bancário mensal.<br>
            Documento autenticado digitalmente pelo ecossistema ${empresa}.
          </div>
          <div style="text-align:right;">
            ____________________________________________<br>
            <small>De Acordo do Cliente</small>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

function enviarPropostaWhatsApp() {
  const nomeSocio = (document.getElementById("nomeSocio")?.value || "").trim();
  const primeiroNome = nomeSocio ? nomeSocio.split(" ")[0] : "Cliente";
  const nomeClinica = (document.getElementById("nomeClinica")?.value || "").trim() || "sua clínica";
  const tipoPessoa = typeof tipoPessoaAtual === "function" ? tipoPessoaAtual() : "PJ";
  const empCod = (document.getElementById("tipoProposta")?.value || "finora").toLowerCase();
  
  const nomesEmp = {
    finora: "FINORA Intelligence",
    contabil: "Q-MAX Contábil",
    tech: "Q-MAX Tech",
    auditoria: "Q-MAX Auditoria",
    lagerhaus: "LAGERHAUS"
  };
  const nomeEmpresaSel = nomesEmp[empCod] || "nossa empresa";

  const totalMensal = document.getElementById("totalMensal")?.textContent || "R$ 0,00";
  const totalPontual = document.getElementById("totalPontual")?.textContent || "R$ 0,00";

  let telefone = (document.getElementById("telefone")?.value || "").replace(/\D/g, "");
  
  // Formatador de mensagem
  let mensagem = `Olá, *${primeiroNome}*! Tudo bem?\n\n`;
  mensagem += `Conforme conversamos, elaboramos a proposta comercial personalizada para a *${nomeClinica}* através da *${nomeEmpresaSel}*.\n\n`;
  mensagem += `📋 *Resumo da Proposta:*\n`;
  mensagem += `• Perfil: ${tipoPessoa === 'PF' ? 'Pessoa Física' : (tipoPessoa === 'HIBRIDA' ? 'Pessoa Híbrida (PF+PJ)' : 'Pessoa Jurídica')}\n`;
  if (totalMensal !== 'R$ 0,00') mensagem += `• Investimento Mensal: *${totalMensal}*\n`;
  if (totalPontual !== 'R$ 0,00') mensagem += `• Investimento Pontual: *${totalPontual}*\n`;
  mensagem += `\nCaso tenha alguma dúvida ou queira alinhar algum ponto, estou à disposição por aqui!`;

  const urlWhatsapp = telefone.length >= 10 
    ? `https://api.whatsapp.com/send?phone=55${telefone}&text=${encodeURIComponent(mensagem)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;

  window.open(urlWhatsapp, "_blank");
}

// MODO PROPOSTA EXPRESS (IDEIA 2)
function ativarModoExpress() {
  const cnpjExpress = prompt("MODO PROPOSTA EXPRESS (30 Segundos)\n\nDigite o CNPJ da clínica para auto-preencher os dados:");

  if (cnpjExpress) {
    const elCnpj = document.getElementById("cnpj");
    if (elCnpj) {
      elCnpj.value = cnpjExpress;
      buscarDadosCnpj();
    }
  }

  // Preenchimentos Padrão Inteligentes
  const setValSeVazio = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value.trim()) el.value = val;
  };

  setValSeVazio("socios", "1");
  setValSeVazio("funcionarios", "2");
  setValSeVazio("estagiarios", "0");
  setValSeVazio("faturamento", "45000");

  if (typeof window.showToast === "function") {
    window.showToast("Modo Express ativado! Os dados padrões foram configurados.", "info");
  }
}

// CALCULADORA DE ROI E LUCRO LÍQUIDO DO CLIENTE (IDEIA 1 & 2)
function atualizarCalculoRoi(totalMensal = 0) {
  const txtRoi = document.getElementById("textoRoiEstimado");
  if (!txtRoi) return;

  // Campo #faturamento é ANUAL (input numérico): antes era usado como mensal (12x) e o replace tirava a vírgula decimal
  const faturamentoAnual = Number(document.getElementById("faturamento")?.value || 0);
  const faturamento = faturamentoAnual > 0 ? faturamentoAnual / 12 : 40000;
  
  // Estimativa de economia tributária mensal (~5% de otimização no Simples com Fator R / Equiparação)
  const economiaMensal = faturamento * 0.05;
  const economiaAnualEstimada = economiaMensal * 12;
  const mensalidade = Number(totalMensal || 0);
  const ganhoLiquido = Math.max(0, economiaMensal - mensalidade);

  const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const elEcoMensal = document.getElementById("roiEconomiaMensal");
  const elGanhoLiq = document.getElementById("roiGanhoLiquido");

  if (elEcoMensal) elEcoMensal.textContent = `+ ${moedaFmt.format(economiaMensal)}/mês`;
  if (elGanhoLiq) elGanhoLiq.textContent = `+ ${moedaFmt.format(ganhoLiquido)}/mês`;

  txtRoi.textContent = `~ ${moedaFmt.format(economiaAnualEstimada)} / ano em otimização fiscal e tributária`;
}

// 🎙️ ROTEIRO DE PITCH COMERCIAL DO VENDEDOR
window.abrirModalPitchVendas = function() {
  const modal = document.getElementById("modalPitchVendas");
  if (!modal) return;

  const nomeClinica = (document.getElementById("nomeClinica")?.value || "").trim() || "sua clínica";
  const responsavel = (document.getElementById("nomeSocio")?.value || "").trim() || "Dr(a)";
  // #faturamento é anual; o roteiro fala em valores mensais
  const faturamentoAnual = Number(document.getElementById("faturamento")?.value || 0);
  const faturamento = faturamentoAnual > 0 ? faturamentoAnual / 12 : 35000;
  const cadeiras = document.getElementById("cadeiras")?.value || "2";
  const empCod = (document.getElementById("tipoProposta")?.value || "finora").toUpperCase();
  const totalMensal = document.getElementById("totalMensal")?.textContent || "R$ 0,00";
  const faturamentoFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(faturamento);
  const ecoMensalFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(faturamento * 0.05);

  const empresaNomes = {
    FINORA: "FINORA Intelligence",
    CONTABIL: "Q-MAX Contábil",
    TECH: "Q-MAX Tech",
    AUDITORIA: "Q-MAX Auditoria",
    LAGERHAUS: "LAGERHAUS"
  };
  const empNomeFmt = empresaNomes[empCod] || "Q-MAX";

  document.getElementById("pitchAbertura").innerHTML = `
    "Olá, <strong>${responsavel}</strong>! Analisamos a estrutura da <strong>${nomeClinica}</strong> (${cadeiras} cadeiras e faturamento em torno de ${faturamentoFmt} por mês). Identificamos que a clínica tem um potencial gigante de expansão, mas hoje está vulnerável a pagar mais impostos do que deveria e a perder tempo com burocracias fiscais."
  `;

  document.getElementById("pitchValor").innerHTML = `
    "Com a parceria do ecossistema <strong>${empNomeFmt}</strong>, nós assumimos 100% da sua rotina contábil, tributária, departamento pessoal e regularizações. Você e sua equipe médica focam apenas no atendimento aos pacientes, com a certeza de que a clínica está blindada e operando no regime mais econômico da lei."
  `;

  document.getElementById("pitchPreco").innerHTML = `
    "Aqui está o principal diferencial: nossa assessoria especializada gera uma economia fiscal estimada em <strong>~${ecoMensalFmt} por mês</strong> com a aplicação correta do Fator R e enquadramentos societários. Ou seja, nosso investimento mensal de <strong>${totalMensal}</strong> se paga integralmente e ainda coloca dinheiro limpo no caixa da sua empresa todo mês."
  `;

  document.getElementById("pitchCta").innerHTML = `
    "Já estruturamos a proposta com todas as condições garantidas por 10 dias. Vou lhe enviar o link seguro agora para darmos o aceite digital e iniciarmos a transição imediatamente. Alguma dúvida antes de darmos início?"
  `;

  modal.style.display = "flex";
};

window.fecharModalPitchVendas = function() {
  const modal = document.getElementById("modalPitchVendas");
  if (modal) modal.style.display = "none";
};

window.copiarRoteiroPitch = function() {
  const ab = document.getElementById("pitchAbertura")?.innerText || "";
  const val = document.getElementById("pitchValor")?.innerText || "";
  const prc = document.getElementById("pitchPreco")?.innerText || "";
  const cta = document.getElementById("pitchCta")?.innerText || "";

  const textoCompleto = `🎙️ ROTEIRO DE PITCH & FECHAMENTO COMERCIAL\n\n1. ABERTURA:\n${ab}\n\n2. PROPOSTA DE VALOR:\n${val}\n\n3. QUEBRA DE OBJEÇÃO DE PREÇO (ROI):\n${prc}\n\n4. FECHAMENTO & PRÓXIMO PASSO:\n${cta}`;

  navigator.clipboard.writeText(textoCompleto).then(() => {
    alert("Roteiro de vendas copiado para a área de transferência!");
  });
};

// 📊 MATRIZ COMPARATIVA ANTES VS DEPOIS
window.abrirModalMatrizComparativa = function() {
  const modal = document.getElementById("modalMatrizComparativa");
  if (modal) modal.style.display = "flex";
};

window.fecharModalMatrizComparativa = function() {
  const modal = document.getElementById("modalMatrizComparativa");
  if (modal) modal.style.display = "none";
};

// 🎉 DISPARADOR DE CONFETES EM PURO HTML5 CANVAS
window.dispararConfetes = function() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");

  const particulas = [];
  const cores = ["#10b981", "#0284c7", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

  for (let i = 0; i < 140; i++) {
    particulas.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: (Math.random() - 0.7) * 22,
      size: Math.random() * 8 + 4,
      color: cores[Math.floor(Math.random() * cores.length)],
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.35,
    });
  }

  let animFrame;
  const inicio = Date.now();

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const decorrido = Date.now() - inicio;

    particulas.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.vrot;
      p.opacity = Math.max(0, 1 - decorrido / 3500);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.4);
      ctx.restore();
    });

    if (decorrido < 3500) {
      animFrame = requestAnimationFrame(animar);
    } else {
      cancelAnimationFrame(animFrame);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  animar();
};

// GERADOR DE PROPOSTA PARA IMPRESSÃO MINIMALISTA A4 (IDEIA 4)
async function imprimirPropostaMinimalista() {
  if (typeof window.showToast === "function") {
    window.showToast("Gerando PDF minimalista para impressão (Economia de tinta)...", "info");
  }

  try {
    const payload = typeof obterPayloadPreview === "function" ? obterPayloadPreview() : {};
    payload.pdfTheme = "impressao"; // Forçar tema de impressão minimalista A4

    const response = await fetch("/api/propostas/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("finora_token")}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Erro ao gerar versão para impressão.");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const win = window.open(blobUrl, "_blank");
    if (win) {
      win.focus();
    }
  } catch (err) {
    console.error("Erro ao imprimir proposta:", err);
    alert("Erro ao gerar versão minimalista para impressão.");
  }
}

// 📲 GERADOR DE QR CODE PARA ASSINATURA PRESENCIAL (FRENTE 3)
let qrCodeInstance = null;

function gerarQrCodeAssinatura() {
  const modal = document.getElementById("modalQrCode");
  const container = document.getElementById("canvasQrCode");

  if (!modal || !container) return;

  container.innerHTML = "";

  const tokenAtual = window.tokenPropostaAtual;
  if (!tokenAtual) {
    alert("Gere a proposta primeiro para criar o QR Code de assinatura.");
    return;
  }
  const urlPublica = `${window.location.origin}/proposta/p/${encodeURIComponent(tokenAtual)}`;

  if (typeof QRCode !== "undefined") {
    qrCodeInstance = new QRCode(container, {
      text: urlPublica,
      width: 220,
      height: 220,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    // Sem biblioteca local não geramos por serviço externo: a URL leva o token de acesso da proposta
    container.textContent = "Não foi possível gerar o QR Code. Recarregue a página e tente de novo.";
  }

  modal.classList.remove("hidden");
}

function fecharModalQrCode() {
  const modal = document.getElementById("modalQrCode");
  if (modal) modal.classList.add("hidden");
}

// 🔔 NOTIFICAÇÃO SONORA COMERCIAL - "EFEITO CHA-CHING" (FRENTE 1)
function tocarSomVenda() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Sintetizador do Som "Cha-Ching / Caixa Registradora"
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(987.77, audioCtx.currentTime); // Note B5
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08); // Note E6

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start();
    osc2.start(audioCtx.currentTime + 0.08);
    osc1.stop(audioCtx.currentTime + 0.6);
    osc2.stop(audioCtx.currentTime + 0.6);
  } catch (e) {
    console.warn("Áudio da venda não pôde ser reproduzido automaticamente:", e);
  }
}

// 🖥️ MODO APRESENTAÇÃO INTERATIVA AO VIVO / PITCH COMERCIAL (INOVAÇÃO 2)
let modoPitchAtivo = false;

function alternarModoPitch() {
  modoPitchAtivo = !modoPitchAtivo;
  const topbar = document.querySelector(".topbar");
  const wizardProgress = document.querySelector(".wizard-progress-card");
  const appSidebar = document.querySelector(".sidebar");

  if (topbar) topbar.style.display = modoPitchAtivo ? "none" : "flex";
  if (wizardProgress) wizardProgress.style.display = modoPitchAtivo ? "none" : "block";
  if (appSidebar) appSidebar.style.display = modoPitchAtivo ? "none" : "block";

  if (modoPitchAtivo) {
    document.body.style.background = "#0f172a";
    if (typeof window.showToast === "function") {
      window.showToast("Modo Pitch Comercial Ativado! Pressione ESC ou clique novamente para sair.", "info");
    }
  } else {
    document.body.style.background = "";
  }
}

// Escutar tecla ESC para sair do Modo Pitch
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modoPitchAtivo) {
    alternarModoPitch();
  }
});

// 💰 CONTROLE DE FATURAMENTO RÁPIDO & EQUIVALENTE MENSAL
window.definirFaturamentoAnual = function(valorAnual) {
  const el = document.getElementById("faturamento");
  if (el) {
    el.value = valorAnual;
    atualizarEquivalenteMensal();
    if (typeof gerarProposta === "function") gerarProposta();
  }
};

window.atualizarEquivalenteMensal = function() {
  const el = document.getElementById("faturamento");
  const elEquiv = document.getElementById("faturamentoMensalEquivalente");
  if (!el || !elEquiv) return;

  const valorAnual = Number(el.value || 0);
  const mensal = valorAnual / 12;
  const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  elEquiv.textContent = `(~ ${moedaFmt.format(mensal)}/mês)`;
};

// 🤖 ANÁLISE PREDITIVA DE PROBABILIDADE DE FECHAMENTO POR IA
function calcularProbabilidadeFechamento() {
  let score = 50; // Base inicial

  const cnpj = (document.getElementById("cnpj")?.value || "").replace(/\D/g, "");
  if (cnpj.length === 14) score += 15; // Empresa já constituída

  const faturamento = Number((document.getElementById("faturamento")?.value || "").replace(/\D/g, "")) || 0;
  if (faturamento > 30000) score += 15;

  const email = document.getElementById("email")?.value || "";
  if (email.includes("@")) score += 10;

  const telefone = (document.getElementById("telefone")?.value || "").replace(/\D/g, "");
  if (telefone.length >= 10) score += 10;

  score = Math.min(98, Math.max(25, score));
  return score;
}

// 🧭 NAVEGAÇÃO SUAVE INTERATIVA NOS PASSOS
const TITULOS_PASSOS = {
  1: { titulo: "1. Dados Cadastrais & Empresa", pct: "16%" },
  2: { titulo: "2. Localização e Endereço", pct: "33%" },
  3: { titulo: "3. Quadro Societário", pct: "50%" },
  4: { titulo: "4. Parâmetros Operacionais", pct: "66%" },
  5: { titulo: "5. Escopo de Serviços", pct: "83%" },
  6: { titulo: "6. Revisão & Investimento", pct: "100%" },
};

function atualizarProgressoVisual(stepNum) {
  const dados = TITULOS_PASSOS[stepNum] || TITULOS_PASSOS[1];
  
  const elTitle = document.getElementById("wizardCurrentTitle");
  const elPercent = document.getElementById("wizardPercent");
  const elBar = document.getElementById("wizardProgressBar");

  if (elTitle) elTitle.textContent = dados.titulo;
  if (elPercent) elPercent.textContent = dados.pct;
  if (elBar) elBar.style.width = dados.pct;

  document.querySelectorAll(".proposal-step").forEach((el) => {
    el.classList.toggle("active", el.dataset.stepIndicator === String(stepNum));
  });
}

function irParaPasso(passo) {
  const stepNum = String(passo);
  let targetEl = null;

  if (stepNum === "6") {
    targetEl = document.querySelector(".proposal-summary");
  } else {
    targetEl = document.querySelector(`.wizard-card[data-wizard-step="${stepNum}"]`);
  }

  atualizarProgressoVisual(stepNum);

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    targetEl.style.transition = "box-shadow 0.4s ease, border-color 0.4s ease";
    targetEl.style.boxShadow = "0 0 0 3px rgba(13, 148, 136, 0.45)";
    setTimeout(() => {
      targetEl.style.boxShadow = "";
    }, 1400);
  }
}

// 🍞 ENGINE DE NOTIFICAÇÕES TOAST EXECUTIVO (GERADOR)
window.mostrarToast = function(mensagem, tipo = "sucesso") {
  let toastContainer = document.getElementById("toastContainerGlobal");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainerGlobal";
    toastContainer.style.cssText = "position:fixed; top:24px; right:24px; z-index:999999; display:flex; flex-direction:column; gap:10px; max-width:380px; width:calc(100vw - 48px); pointer-events:none;";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  const corBorda = tipo === 'sucesso' ? '#10b981' : tipo === 'erro' ? '#ef4444' : '#0284c7';
  const icon = tipo === 'sucesso' ? '✓' : tipo === 'erro' ? '✕' : 'i';

  toast.style.cssText = `
    pointer-events:auto;
    background:rgba(15, 23, 42, 0.94);
    color:#f8fafc;
    border:1.5px solid ${corBorda};
    border-radius:14px;
    padding:12px 18px;
    box-shadow:0 20px 25px -5px rgba(0,0,0,0.3);
    font-size:13.5px;
    font-weight:600;
    display:flex;
    align-items:center;
    gap:10px;
    backdrop-filter:blur(12px);
    transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  toast.innerHTML = `<span style="font-size:18px;">${icon}</span><span style="flex:1; line-height:1.4;">${mensagem}</span>`;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px) scale(0.95)";
    setTimeout(() => toast.remove(), 350);
  }, 3200);
};

// CENTRAL DE QUEBRA DE OBJEÇÕES COMERCIAIS
window.abrirModalObjecoes = function() {
  const modal = document.getElementById("modalObjecoes");
  if (modal) modal.style.display = "flex";
};

window.fecharModalObjecoes = function() {
  const modal = document.getElementById("modalObjecoes");
  if (modal) modal.style.display = "none";
};

window.copiarTextoObjecao = function(num) {
  const el = document.getElementById(`txtObjecao${num}`);
  if (!el) return;
  const texto = el.innerText.trim();
  navigator.clipboard.writeText(texto).then(() => {
    window.mostrarToast(`Resposta para Objeção #${num} copiada com sucesso!`);
  });
};

// 📅 AGENDADOR RÁPIDO DE FOLLOW-UP COMERCIAL (48H)
window.agendarFollowUpComercial = function() {
  const nomeClinica = (document.getElementById("nomeClinica")?.value || "").trim() || "Clínica";
  const responsavel = (document.getElementById("nomeSocio")?.value || "").trim() || "Dr(a)";
  const faturamento = document.getElementById("faturamento")?.value || "";
  const totalMensal = document.getElementById("totalMensal")?.textContent || "R$ 0,00";

  const agora = new Date();
  const dataFollowUp = new Date(agora.getTime() + 48 * 60 * 60 * 1000); // 48 horas depois
  
  // Formatador ISO para Google Calendar
  const inicioIso = dataFollowUp.toISOString().replace(/-|:|\.\d\d\d/g, "");
  const fimIso = new Date(dataFollowUp.getTime() + 30 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");

  const titulo = encodeURIComponent(`📞 Follow-up Comercial: ${nomeClinica} (${responsavel})`);
  const detalhes = encodeURIComponent(`Follow-up da proposta comercial (${totalMensal}/mês).\nVerificar se o cliente teve dúvidas na assinatura digital ou na transição contábil.`);
  
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${inicioIso}/${fimIso}&details=${detalhes}`;

  window.open(googleCalendarUrl, "_blank");
};

// --- 🔍 CONSULTA AUTOMÁTICA DE CNPJ (RECEITA FEDERAL) ---
window.buscarDadosCnpj = async function() {
  const cnpjInput = document.getElementById("cnpj");
  const hintCnpj = document.getElementById("hintCnpj");
  if (!cnpjInput) return;

  const cnpjClean = cnpjInput.value.replace(/\D/g, "");
  if (cnpjClean.length !== 14) return;

  if (hintCnpj) {
    hintCnpj.innerHTML = `<span style="color:#0284c7; font-weight:700;">Consultando dados da Receita Federal...</span>`;
  }

  try {
    let dados = null;
    // Tentativa 1: BrasilAPI
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (res.ok) dados = await res.json();
    } catch (e) {
      console.warn("BrasilAPI falhou, tentando fallback ReceitaWS...", e);
    }

    // Fallback: MinhaReceita
    if (!dados) {
      const res2 = await fetch(`https://minhareceita.org/${cnpjClean}`);
      if (res2.ok) dados = await res2.json();
    }

    if (!dados) {
      if (hintCnpj) {
        hintCnpj.innerHTML = `<span style="color:#f59e0b;">Não foi possível consultar o CNPJ automaticamente. Preencha manualmente.</span>`;
      }
      return;
    }

    // Preencher campos
    const razaoSocial = dados.razao_social || dados.nome || "";
    const nomeFantasia = dados.nome_fantasia || dados.fantasia || razaoSocial;
    const email = dados.email || "";
    const tel = dados.ddd_telefone_1 || dados.telefone || "";
    const cep = (dados.cep || "").replace(/\D/g, "");
    const logradouro = `${dados.descricao_tipo_de_logradouro || ''} ${dados.logradouro || ''}`.trim();
    const numero = dados.numero || "S/N";
    const complemento = dados.complemento || "";
    const bairro = dados.bairro || "";
    const municipio = dados.municipio || "";
    const uf = dados.uf || "";

    // Sócio principal do QSA
    let nomeSocioPrincipal = "";
    if (dados.qsa && dados.qsa.length > 0) {
      nomeSocioPrincipal = dados.qsa[0].nome_socio || dados.qsa[0].nome || "";
    }

    // Aplicar aos campos
    const elRazao = document.getElementById("razaoSocial");
    if (elRazao && !elRazao.value) elRazao.value = razaoSocial;

    const elNomeClinica = document.getElementById("nomeClinica");
    if (elNomeClinica && !elNomeClinica.value) elNomeClinica.value = nomeFantasia;

    const elEmail = document.getElementById("email");
    if (elEmail && !elEmail.value && email) elEmail.value = email.toLowerCase();

    const elTel = document.getElementById("telefone");
    if (elTel && !elTel.value && tel) elTel.value = tel;

    const elSocio = document.getElementById("nomeSocio");
    if (elSocio && !elSocio.value && nomeSocioPrincipal) elSocio.value = nomeSocioPrincipal;

    // Endereço
    const elCep = document.getElementById("cep");
    if (elCep && cep) elCep.value = cep;

    const elLog = document.getElementById("logradouroClinica");
    if (elLog && logradouro) elLog.value = logradouro;

    const elNum = document.getElementById("numeroClinica");
    if (elNum && numero) elNum.value = numero;

    const elComp = document.getElementById("complementoClinica");
    if (elComp && complemento) elComp.value = complemento;

    const elBairro = document.getElementById("bairroClinica");
    if (elBairro && bairro) elBairro.value = bairro;

    const elCidade = document.getElementById("cidadeClinica");
    if (elCidade && municipio) elCidade.value = municipio;

    const elUf = document.getElementById("ufClinica");
    if (elUf && uf) elUf.value = uf;

    if (typeof atualizarEnderecoCompleto === "function") {
      atualizarEnderecoCompleto();
    }

    // Feedback de Sucesso
    if (hintCnpj) {
      hintCnpj.innerHTML = `<span style="color:#15803d; font-weight:800;">Dados da clínica carregados da Receita Federal com sucesso!</span>`;
    }
  } catch (err) {
    console.error("Erro ao buscar CNPJ:", err);
    if (hintCnpj) {
      hintCnpj.innerHTML = `<span style="color:#64748b;">Digite o CNPJ para buscar os dados na Receita Federal.</span>`;
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Tornar os passos do topo clicáveis
  document.querySelectorAll(".proposal-step").forEach((stepEl) => {
    stepEl.style.cursor = "pointer";
    stepEl.addEventListener("click", () => {
      const stepNum = stepEl.dataset.stepIndicator;
      if (stepNum) irParaPasso(stepNum);
    });
  });

  // ScrollSpy automático conforme o usuário rola a página
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = entry.target.dataset.wizardStep;
            if (step) atualizarProgressoVisual(step);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    document.querySelectorAll(".wizard-card[data-wizard-step]").forEach((card) => {
      observer.observe(card);
    });
  }
});

// 🎙️ GRAVADOR DE MENSAGEM DE VOZ DO CONSULTOR COMERCIAL
let mediaRecorderInstance = null;
let audioChunksGravados = [];
let gravandoAudioPitch = false;

window.toggleGravacaoAudioPitch = async function() {
  const btn = document.getElementById("btnGravarAudioPitch");
  const btnExcluir = document.getElementById("btnExcluirAudioPitch");
  const playerDiv = document.getElementById("playerAudioPitchPreview");
  const player = document.getElementById("audioPitchPlayer");
  const inputHidden = document.getElementById("audioPitchBase64");

  if (!gravandoAudioPitch) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksGravados = [];
      mediaRecorderInstance = new MediaRecorder(stream);

      mediaRecorderInstance.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksGravados.push(e.data);
      };

      mediaRecorderInstance.onstop = () => {
        const audioBlob = new Blob(audioChunksGravados, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (inputHidden) inputHidden.value = reader.result;
          if (player) player.src = reader.result;
          if (playerDiv) playerDiv.style.display = "block";
          if (btnExcluir) btnExcluir.style.display = "inline-flex";
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderInstance.start();
      gravandoAudioPitch = true;
      if (btn) {
        btn.innerText = "Parar Gravação";
        btn.style.background = "#0f172a";
      }
    } catch (err) {
      console.warn("Microfone não disponível:", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões do seu navegador.");
    }
  } else {
    if (mediaRecorderInstance && mediaRecorderInstance.state !== "inactive") {
      mediaRecorderInstance.stop();
    }
    gravandoAudioPitch = false;
    if (btn) {
      btn.innerText = "Gravar Novamente";
      btn.style.background = "#0284c7";
    }
  }
};

window.excluirAudioPitch = function() {
  const btn = document.getElementById("btnGravarAudioPitch");
  const btnExcluir = document.getElementById("btnExcluirAudioPitch");
  const playerDiv = document.getElementById("playerAudioPitchPreview");
  const player = document.getElementById("audioPitchPlayer");
  const inputHidden = document.getElementById("audioPitchBase64");

  if (inputHidden) inputHidden.value = "";
  if (player) player.src = "";
  if (playerDiv) playerDiv.style.display = "none";
  if (btnExcluir) btnExcluir.style.display = "none";
  if (btn) {
    btn.innerText = "Gravar Áudio";
    btn.style.background = "#ef4444";
  }
};

// ⌨️ ATALHOS DE TECLADO DE ALTA PRODUTIVIDADE (MODO TURBO)
document.addEventListener("keydown", (e) => {
  // Ctrl + S / Cmd + S -> Salvar rascunho local
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (typeof salvarRascunhoLocal === "function") {
      salvarRascunhoLocal();
      if (typeof window.mostrarToast === "function") {
        window.mostrarToast("Rascunho da proposta salvo com sucesso!");
      }
    }
  }

  // Ctrl + Enter / Cmd + Enter -> Gerar Proposta Comercial
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    const btnGerar = document.getElementById("btnGerarProposta") || document.querySelector("button[type='submit']");
    if (btnGerar) {
      btnGerar.click();
    } else if (typeof gerarProposta === "function") {
      gerarProposta();
    }
  }

  // Esc -> Fechar qualquer modal ativo
  if (e.key === "Escape") {
    document.querySelectorAll(".modal, .modal-recusar-overlay").forEach((modal) => {
      modal.style.display = "none";
    });
  }

  // Alt + 1..6 -> Navegação direta nos passos
  if (e.altKey && e.key >= "1" && e.key <= "6") {
    e.preventDefault();
    if (typeof irParaPasso === "function") {
      irParaPasso(Number(e.key));
    }
  }
});
