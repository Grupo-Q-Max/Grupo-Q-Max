function obterUsuarioLogado() {
  const token = localStorage.getItem("finora_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
    return payload;
  } catch (e) {
    return null;
  }
}

function tocarSomNotificacao() {
  if (localStorage.getItem("finora_mute_sound") === "true") return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain1.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.15);
    
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, audioCtx.currentTime);
      gain2.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.25);
    }, 80);
  } catch (e) {
    console.error("Audio Context não suportado:", e);
  }
}

function toggleMuteSound() {
  const btn = document.getElementById("btnToggleSound");
  const isMuted = localStorage.getItem("finora_mute_sound") === "true";
  
  if (isMuted) {
    localStorage.setItem("finora_mute_sound", "false");
    if (btn) {
      btn.innerText = "Som";
      btn.title = "Silenciar sons de notificação";
    }
    tocarSomNotificacao();
  } else {
    localStorage.setItem("finora_mute_sound", "true");
    if (btn) {
      btn.innerText = "Mudo";
      btn.title = "Ativar sons de notificação";
    }
  }
}

function inicializarEstadoSom() {
  const btn = document.getElementById("btnToggleSound");
  const isMuted = localStorage.getItem("finora_mute_sound") === "true";
  if (btn) {
    btn.innerText = isMuted ? "Mudo" : "Som";
    btn.title = isMuted ? "Ativar sons de notificação" : "Silenciar sons de notificação";
  }
}
window.toggleMuteSound = toggleMuteSound;

function exibirToastNotificacao(codigo, titulo, mensagem) {
  let container = document.getElementById("qmax-notifications-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "qmax-notifications-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "qmax-toast";
  toast.innerHTML = `
    <div class="toast-header">
      <span>${codigo}</span>
      <span style="cursor:pointer;" onclick="this.parentElement.parentElement.remove()">✕</span>
    </div>
    <div class="toast-title">${titulo}</div>
    <div class="toast-body">${mensagem}</div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add("show"), 50);
  
  tocarSomNotificacao();

  setTimeout(() => {
    toast.classList.replace("show", "hide");
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

function exibirLiveLeadRadar(data) {
  let container = document.getElementById("qmax-notifications-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "qmax-notifications-container";
    document.body.appendChild(container);
  }

  const nomeSocio = data.nomeSocio || "Cliente";
  const primeiroNome = nomeSocio.split(" ")[0];
  const clinica = data.nomeClinica || "Clínica";
  const dispositivo = data.dispositivo || "Celular";
  const tel = (data.telefone || "").replace(/\D/g, "");

  const msgWhats = encodeURIComponent(
    `Olá, *${primeiroNome}*! Tudo bem?\n\nVi que você conseguiu abrir a nossa proposta comercial da *${clinica}*.\n\nFicou com alguma dúvida em relação aos serviços ou valores? Estou à disposição para conversar!`
  );

  const urlWhats = tel ? `https://wa.me/55${tel}?text=${msgWhats}` : `https://wa.me/?text=${msgWhats}`;

  const toast = document.createElement("div");
  toast.className = "qmax-toast";
  toast.style.borderLeft = "4px solid #10b981";
  toast.style.background = "#ffffff";
  toast.style.boxShadow = "0 10px 25px rgba(0,0,0,0.12)";
  toast.style.padding = "16px";
  toast.style.borderRadius = "12px";

  toast.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="display:inline-flex; align-items:center; gap:6px; background:#dcfce7; color:#15803d; font-weight:800; font-size:11px; padding:3px 8px; border-radius:999px; text-transform:uppercase;">
        <span style="width:7px; height:7px; border-radius:50%; background:#16a34a; display:inline-block; animation:pulse 1.5s infinite;"></span>
        Live Lead Radar
      </span>
      <span style="cursor:pointer; color:#94a3b8; font-weight:700;" onclick="this.closest('.qmax-toast').remove()">✕</span>
    </div>
    <div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px;">
      ${escapeHTML(nomeSocio)} acabou de abrir a proposta!
    </div>
    <div style="font-size:12px; color:#64748b; margin-bottom:12px; line-height:1.4;">
      Clínica: <strong>${escapeHTML(clinica)}</strong> (Proposta #${escapeHTML(data.numeroProposta)})<br>
      Acesso detectado via <strong>${dispositivo}</strong> agora mesmo.
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <a href="${urlWhats}" target="_blank" style="background:#25D366; color:#fff; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:800; text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
        Chamar no WhatsApp (Timing Perfeito)
      </a>
      <a href="/proposta/visualizar.html?token=${encodeURIComponent(data.tokenAcesso)}" target="_blank" style="background:#f1f5f9; color:#334155; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:700; text-decoration:none;">
        Ver Proposta
      </a>
    </div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  tocarSomNotificacao();

  setTimeout(() => {
    toast.classList.replace("show", "hide");
    setTimeout(() => toast.remove(), 400);
  }, 12000);
}

function inicializarStreamNotificacoes() {
  const token = localStorage.getItem("finora_token");
  if (!token) return;

  const usuario = obterUsuarioLogado();
  if (!usuario) return;

  const sseDot = document.getElementById("sseStatusDot");
  const sseText = document.getElementById("sseStatusText");

  function setSSEStatus(status) {
    if (!sseDot || !sseText) return;
    if (status === "connected") {
      sseDot.style.background = "#22c55e";
      sseDot.style.boxShadow = "0 0 8px #22c55e";
      sseText.innerText = "Conectado";
    } else if (status === "connecting") {
      sseDot.style.background = "#f59e0b";
      sseDot.style.boxShadow = "0 0 8px #f59e0b";
      sseText.innerText = "Reconectando...";
    } else {
      sseDot.style.background = "#ef4444";
      sseDot.style.boxShadow = "0 0 8px #ef4444";
      sseText.innerText = "Desconectado";
    }
  }

  setSSEStatus("connecting");

  const streamUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
  const eventSource = new EventSource(streamUrl);

  eventSource.onopen = () => {
    setSSEStatus("connected");
  };

  eventSource.addEventListener("visualizada", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (usuario.role === "Diretor" || usuario.id === Number(data.criadoPor)) {
        exibirLiveLeadRadar(data);
        if (typeof carregarPropostas === "function") {
          carregarPropostas();
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("aprovada", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (usuario.role === "Diretor" || usuario.id === Number(data.criadoPor)) {
        if (typeof dispararConfetes === "function") {
          dispararConfetes();
        }
        exibirToastNotificacao(
          "SYS.NTF_APPR",
          "Contrato Fechado com Sucesso!",
          `Parabéns à equipe! A clínica <strong>${escapeHTML(data.nomeClinica)}</strong> (Proposta #${escapeHTML(data.numeroProposta)}) acaba de aprovar e assinar a proposta.`
        );
        if (typeof carregarPropostas === "function") {
          carregarPropostas();
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("recusada", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (usuario.role === "Diretor" || usuario.id === Number(data.criadoPor)) {
        exibirToastNotificacao(
          "SYS.NTF_RECD",
          "Proposta Recusada/Renegociada",
          `A clínica <strong>${escapeHTML(data.nomeClinica)}</strong> (Proposta #${escapeHTML(data.numeroProposta)}) solicitou renegociação: <em>"${escapeHTML(data.justificativa)}"</em>`
        );
        if (typeof carregarPropostas === "function") {
          carregarPropostas();
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("nova_solicitacao", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (usuario.role === "Diretor") {
        exibirToastNotificacao(
          "SYS.NTF_REQD",
          "Novo Pedido de Desconto",
          `Vendedor <strong>${escapeHTML(data.vendedorNome)}</strong> solicitou <strong>${escapeHTML(data.percentual)}%</strong> de desconto para a clínica <strong>${escapeHTML(data.nomeClinica)}</strong>.`
        );
        if (typeof carregarSolicitacoes === "function") {
          carregarSolicitacoes();
        }
        if (typeof carregarPropostas === "function") {
          carregarPropostas();
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Cliente lendo a proposta agora (alerta-quente) e reativação pelo link: o servidor já enviava, ninguém ouvia
  eventSource.addEventListener("leitura_quente_alerta", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (typeof window.exibirAlertaLeadQuente === "function") {
        window.exibirAlertaLeadQuente({ clinica: data.clinica, telefone: data.telefone_cliente, tempo: "agora" });
      }
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("proposta_reativada", (event) => {
    try {
      const data = JSON.parse(event.data);
      exibirToastNotificacao(
        "SYS.NTF_REAT",
        "Proposta Reativada pelo Cliente",
        `A clínica <strong>${escapeHTML(data.clinica)}</strong> (Proposta #${escapeHTML(data.numero_proposta)}) reativou a condição comercial.`
      );
      if (typeof carregarPropostas === "function") carregarPropostas();
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("desconto_respondido", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (usuario.id === Number(data.solicitadoPor)) {
        const status = data.acao === "Aprovar" ? "APROVADO" : "RECUSADO";
        const emoji = data.acao === "Aprovar" ? "" : "";
        exibirToastNotificacao(
          "SYS.NTF_RSPD",
          `${emoji} Pedido de Desconto Respondido`,
          `Seu pedido de desconto para a clínica <strong>${escapeHTML(data.nomeClinica)}</strong> foi <strong>${status}</strong> pelo Diretor.`
        );
        if (typeof carregarPropostas === "function") {
          carregarPropostas();
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.addEventListener("contrato_nao_assinado", (event) => {
    try {
      const data = JSON.parse(event.data);
      exibirToastNotificacao(
        "SYS.NTF_D4SG",
        "Contrato Não Assinado",
        `Proposta #${escapeHTML(data.numeroProposta)} (<strong>${escapeHTML(data.nomeClinica)}</strong>): ${escapeHTML(data.motivo)}`
      );
      if (typeof carregarPropostas === "function") carregarPropostas();
    } catch (e) {
      console.error(e);
    }
  });

  eventSource.onerror = (err) => {
    console.warn("Erro na conexão SSE. Tentando reconectar...", err);
    if (eventSource.readyState === EventSource.CLOSED) {
      setSSEStatus("disconnected");
    } else {
      setSSEStatus("connecting");
    }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  inicializarEstadoSom();

  const role = localStorage.getItem("finora_role") || "Vendedor";
  const nomeUser = document.getElementById("nomeUser");

  if (nomeUser) {
    nomeUser.innerText = `${localStorage.getItem("finora_nome")} (${role})`;
  }

  const inputEmpresa = document.getElementById("filtroEmpresa");

  if (inputEmpresa) {
    inputEmpresa.value = "FINORA";
  }

  if (typeof aplicarTemaEmpresa === "function") {
    aplicarTemaEmpresa("FINORA");
  }

  if (role === "Diretor") {
    const linkAdmin = document.getElementById("linkPainelAdmin");
    if (linkAdmin) linkAdmin.style.display = "inline-block";
    
    const bloco = document.getElementById("blocoSolicitacoes");
    if (bloco) bloco.style.display = "block";
    
    if (typeof carregarSolicitacoes === "function") {
      carregarSolicitacoes();
    }
  }

  if (typeof carregarPropostas === "function") {
    await carregarPropostas();
  }
  inicializarStreamNotificacoes();

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") fecharTodosModais();
  });

  window.addEventListener("click", (event) => {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (event.target === modal) fecharModal(modal.id);
    });
  });
});

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

  for (let i = 0; i < 150; i++) {
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
