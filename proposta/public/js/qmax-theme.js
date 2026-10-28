(function () {
  const THEMES = {
    finora: {
      label: "FINORA",
      className: "theme-finora",
      primary: "#663399",
      secondary: "#006666",
      accent: "#D5EFD6",
      mark: "F",
    },
    contabil: {
      label: "QMAX Contábil",
      className: "theme-contabil",
      primary: "#0BD3C4",
      secondary: "#078F88",
      accent: "#FFFFFF",
      mark: "C",
    },
    tech: {
      label: "QMAX Tech",
      className: "theme-tech",
      primary: "#070E8C",
      secondary: "#0B15D9",
      accent: "#FFFFFF",
      mark: "T",
    },
    auditoria: {
      label: "QMAX Auditoria",
      className: "theme-auditoria",
      primary: "#D4AF37",
      secondary: "#AA7C11",
      accent: "#FFFFFF",
      mark: "A",
    },
    lagerhaus: {
      label: "LAGERHAUS",
      className: "theme-lagerhaus",
      primary: "#C8860A",
      secondary: "#E6A817",
      accent: "#FFF8E7",
      mark: "L",
    },
  };

  function normalizarEmpresa(valor) {
    const texto = String(valor || "finora")
      .trim()
      .toLowerCase();

    if (texto.includes("tech")) return "tech";
    if (texto.includes("auditoria")) return "auditoria";
    if (texto.includes("lagerhaus")) return "lagerhaus";
    if (
      texto.includes("contabil") ||
      texto.includes("contábil") ||
      texto.includes("qmax")
    )
      return "contabil";
    return "finora";
  }

  function aplicarTemaEmpresa(valor) {
    const empresa = normalizarEmpresa(valor);
    const tema = THEMES[empresa] || THEMES.finora;

    document.body.classList.remove(
      "theme-finora",
      "theme-contabil",
      "theme-tech",
      "theme-auditoria",
      "theme-lagerhaus",
    );
    document.body.classList.add(tema.className);
    document.body.dataset.empresaTema = empresa;

    document.documentElement.style.setProperty("--brand-primary", tema.primary);
    document.documentElement.style.setProperty(
      "--brand-secondary",
      tema.secondary,
    );
    document.documentElement.style.setProperty("--brand-accent", tema.accent);
    document.documentElement.style.setProperty("--primary", tema.primary);
    document.documentElement.style.setProperty(
      "--primary-dark",
      tema.secondary,
    );

    document.querySelectorAll("[data-brand-label]").forEach((el) => {
      el.textContent = tema.label;
    });

    document
      .querySelectorAll(".login-mark, .viewer-mark, [data-brand-mark]")
      .forEach((el) => {
        el.textContent = tema.mark;
      });

    document
      .querySelectorAll(".empresa-switch button, .empresa-btn")
      .forEach((btn) => {
        const btnEmpresa = normalizarEmpresa(
          btn.dataset.empresa || btn.textContent,
        );
        btn.classList.toggle("empresa-ativa", btnEmpresa === empresa);
      });
  }

  function observarSelect(select) {
    if (!select) return;

    aplicarTemaEmpresa(select.value);

    select.addEventListener("change", () => {
      aplicarTemaEmpresa(select.value);
    });
  }

  window.normalizarEmpresaTema = normalizarEmpresa;
  window.aplicarTemaEmpresa = aplicarTemaEmpresa;
  window.setQmaxThemeFromEmpresa = aplicarTemaEmpresa;

  // Custom Toast Notification System
  function showToast(message, type = 'success') {
    let container = document.getElementById('qmax-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'qmax-toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `qmax-toast qmax-toast-${type}`;
    toast.style.cssText = `
      min-width: 300px;
      max-width: 450px;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #fff;
      padding: 16px 20px;
      border-radius: 16px;
      font-size: 13.5px;
      font-weight: 700;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      pointer-events: auto;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    let accentColor = '#10b981'; // success
    let icon = '✓';
    if (type === 'error' || type === 'danger') {
      accentColor = '#ef4444';
      icon = '✕';
    } else if (type === 'warning') {
      accentColor = '#f59e0b';
      icon = '!';
    } else if (type === 'info') {
      accentColor = 'var(--brand-primary, #12c8c2)';
      icon = 'i';
    }
    
    toast.style.borderLeft = `4px solid ${accentColor}`;
    
    // Mensagem como texto: alert() recebe data.error do servidor e dados do cliente; pre-line mantém as quebras \n
    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 16px;">${icon}</span>
        <span class="qmax-toast-texto" style="white-space: pre-line;"></span>
      </div>
      <button style="background: transparent; border: none; color: rgba(255, 255, 255, 0.4); cursor: pointer; font-size: 16px; font-weight: bold; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    toast.querySelector(".qmax-toast-texto").textContent = String(message ?? "");
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 50);
    
    setTimeout(() => {
      toast.style.transform = 'translateY(-20px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 4500);
  }

  window.showToast = showToast;

  // Sidebar Master Initialization
  function inicializarSidebarUnificada() {
    const token = localStorage.getItem("finora_token");
    let usuario = null;
    if (token) {
      try {
        usuario = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))));
      } catch (e) {}
    }

    const nomeSalvo = localStorage.getItem("finora_nome") || usuario?.nome || usuario?.email;
    const roleSalva = localStorage.getItem("finora_role") || usuario?.role;

    const nameEl = document.getElementById("userName");
    const roleEl = document.getElementById("userRole");
    const avatarEl = document.getElementById("userAvatar");

    if (nameEl) nameEl.textContent = nomeSalvo || "Usuário Q-MAX";
    if (roleEl) roleEl.textContent = roleSalva || "Consultor Comercial";
    if (avatarEl) avatarEl.textContent = (nomeSalvo || "Q").charAt(0).toUpperCase();

    const rawRole = String(roleSalva || "").toUpperCase();
    const isMaster = rawRole.includes("ADMIN") || rawRole.includes("GESTOR") || rawRole.includes("DIRETOR");

    const secGestaoTitle = document.getElementById("secGestaoTitle");
    const navAdmin = document.getElementById("navAdmin");
    const navCrmConfig = document.getElementById("navCrmConfig");

    if (secGestaoTitle) secGestaoTitle.style.display = isMaster ? "flex" : "none";
    if (navAdmin) navAdmin.style.display = isMaster ? "flex" : "none";
    if (navCrmConfig) navCrmConfig.style.display = isMaster ? "flex" : "none";

    // Auto active link highlighting
    const pathName = window.location.pathname.toLowerCase();
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      link.classList.remove("active");
    });

    if (pathName.includes("dashboard.html")) {
      document.getElementById("navDashboard")?.classList.add("active");
    } else if (pathName.includes("crm.html")) {
      document.getElementById("navCrm")?.classList.add("active");
    } else if (pathName.includes("prospeccao.html")) {
      document.getElementById("navProspeccao")?.classList.add("active");
    } else if (pathName.includes("admin.html")) {
      document.getElementById("navAdmin")?.classList.add("active");
    } else if (pathName.includes("crm-config.html")) {
      document.getElementById("navCrmConfig")?.classList.add("active");
    } else if (pathName.includes("index.html") || pathName.endsWith("/proposta/") || pathName.endsWith("/proposta")) {
      document.getElementById("navNovaProposta")?.classList.add("active");
    }

    // Audio Mute State
    const btnMute = document.getElementById("btnToggleSound");
    if (btnMute) {
      const isMuted = localStorage.getItem("finora_mute_sound") === "true";
      btnMute.innerText = isMuted ? "Mudo" : "Som";
      btnMute.title = isMuted ? "Ativar sons de notificação" : "Silenciar sons de notificação";
    }
  }

  window.inicializarSidebarUnificada = inicializarSidebarUnificada;

  // No celular/tablet o CSS esconde a sidebar (styles.css ≤900px, proposta-v2-fix.css ≤1050px) e não havia como
  // trocar de página nem sair. Botão "Menu" abre a mesma sidebar por cima do conteúdo (abaixo dos modais, z-index 1000).
  function inicializarMenuMobile() {
    const sidebar = document.querySelector("aside.sidebar");
    if (!sidebar || document.getElementById("qmaxBotaoMenu")) return;

    const estilo = document.createElement("style");
    estilo.textContent = `
      #qmaxBotaoMenu { display: none; position: fixed; top: 12px; left: 12px; z-index: 990; padding: 8px 14px;
        border: 0; border-radius: 10px; background: #0f172a; color: #fff; font-weight: 800; font-size: 13px; cursor: pointer;
        box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
      @media (max-width: 1050px) {
        #qmaxBotaoMenu { display: inline-flex; }
        body.qmax-menu-aberto aside.sidebar { display: flex !important; position: fixed; top: 0; left: 0; bottom: 0;
          width: 260px; max-width: 85vw; z-index: 980; overflow-y: auto; box-shadow: 0 0 40px rgba(0,0,0,0.35);
          padding-top: 56px !important; }
        body.qmax-com-menu .main-content { padding-top: 56px !important; }
      }`;
    document.head.appendChild(estilo);
    document.body.classList.add("qmax-com-menu");

    const botao = document.createElement("button");
    botao.id = "qmaxBotaoMenu";
    botao.type = "button";
    botao.textContent = "Menu";
    botao.setAttribute("aria-label", "Abrir menu de navegação");
    botao.setAttribute("aria-expanded", "false");
    botao.addEventListener("click", () => {
      const aberto = document.body.classList.toggle("qmax-menu-aberto");
      botao.textContent = aberto ? "Fechar" : "Menu";
      botao.setAttribute("aria-expanded", String(aberto));
    });
    document.body.appendChild(botao);

    // Clicar num link do menu fecha o painel
    sidebar.addEventListener("click", (e) => {
      if (e.target.closest("a")) document.body.classList.remove("qmax-menu-aberto");
    });
  }

  // Botão Som/Mudo da sidebar existe em todas as páginas, mas toggleMuteSound só vinha em dashboard-init.js
  // (admin, CRM, config e prospecção davam ReferenceError). Aqui só alterna a preferência; dashboard-init sobrescreve com som.
  if (!window.toggleMuteSound) {
    window.toggleMuteSound = function () {
      const mudo = localStorage.getItem("finora_mute_sound") !== "true";
      localStorage.setItem("finora_mute_sound", String(mudo));
      const btn = document.getElementById("btnToggleSound");
      if (btn) {
        btn.innerText = mudo ? "Mudo" : "Som";
        btn.title = mudo ? "Ativar sons de notificação" : "Silenciar sons de notificação";
      }
    };
  }

  // Escape para innerHTML em páginas sem dashboard-utils.js (prospecção, config do CRM); mesmo código de lá
  if (!window.escapeHTML) {
    window.escapeHTML = (str) => String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  }

  // Override window.alert to route to custom toast
  window.alert = function(msg) {
    const text = String(msg || "").toLowerCase();
    if (text.includes('sucesso') || text.includes('enviada') || text.includes('salvo') || text.includes('criado') || text.includes('aprovada') || text.includes('atualizado') || text.includes('sucesso!')) {
      showToast(msg, 'success');
    } else if (text.includes('erro') || text.includes('falha') || text.includes('crítico') || text.includes('inválido') || text.includes('insira') || text.includes('preencha')) {
      showToast(msg, 'danger');
    } else if (text.includes('atenção') || text.includes('desconto') || text.includes('recomenda') || text.includes('diretoria')) {
      showToast(msg, 'warning');
    } else {
      showToast(msg, 'info');
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    inicializarSidebarUnificada();
    inicializarMenuMobile();

    const selectProposta = document.getElementById("tipoProposta");
    const selectDashboard = document.getElementById("filtroEmpresa");

    if (selectProposta) {
      observarSelect(selectProposta);
      return;
    }

    if (selectDashboard) {
      observarSelect(selectDashboard);
      return;
    }

    aplicarTemaEmpresa(document.body.dataset.empresaTema || "finora");
  });
})();
