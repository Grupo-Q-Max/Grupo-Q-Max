"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  GripVertical,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Palette,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface TeamMember {
  id: string;
  name: string;
  role: string;
  sector: string;
  image: string | null;
  order: number;
}

interface BrandLogo {
  id: string;
  label: string;
  filename: string; // the file that will be overwritten in /public/brands/
  current: string;  // public path shown in UI
  accent: string;
}

interface SiteSettings {
  siteName: string;
  tagline: string;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  adminPassword: string;
}

type Tab = "dashboard" | "team" | "logos" | "settings";

const BRAND_LOGOS: BrandLogo[] = [
  {
    id: "auditoria",
    label: "Q-Max Auditoria",
    filename: "brand-auditoria.png",
    current: "/brands/brand-auditoria.png",
    accent: "#ff315f",
  },
  {
    id: "contabil",
    label: "Q-Max Contábil",
    filename: "brand-contabil.png",
    current: "/brands/brand-contabil.png",
    accent: "#14d0c1",
  },
  {
    id: "talents",
    label: "Q-Max Talents",
    filename: "brand-talents.png",
    current: "/brands/brand-talents.png",
    accent: "#b26bff",
  },
  {
    id: "technology",
    label: "Q-Max Technology",
    filename: "brand-technology.png",
    current: "/brands/brand-technology.png",
    accent: "#5077ff",
  },
  {
    id: "lagerhaus",
    label: "Lagerhaus",
    filename: "brand-lagerhaus.png",
    current: "/brands/brand-lagerhaus.png",
    accent: "#d8eb34",
  },
  {
    id: "grupo",
    label: "Grupo Q-Max (branca)",
    filename: "grupo-qmax-white.png",
    current: "/brands/grupo-qmax-white.png",
    accent: "#14d0c1",
  },
  {
    id: "grupo-dark",
    label: "Grupo Q-Max (escura)",
    filename: "grupo-qmax-dark.png",
    current: "/brands/grupo-qmax-dark.png",
    accent: "#14d0c1",
  },
  {
    id: "qxback",
    label: "QXBACK",
    filename: "qxback.png",
    current: "/brands/qxback.png",
    accent: "#79ef2d",
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function reorder<T>(list: T[], from: number, to: number): T[] {
  const r = [...list];
  const [removed] = r.splice(from, 1);
  r.splice(to, 0, removed);
  return r;
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`qadmin-toast qadmin-toast--${type}`}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      {message}
    </div>
  );
}

/* ─── Member Modal ───────────────────────────────────────────────────────── */
function MemberModal({
  onSave,
  onClose,
}: {
  onSave: (data: Partial<TeamMember>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [sector, setSector] = useState("");

  return (
    <div className="qadmin-modal-overlay" onClick={onClose}>
      <div className="qadmin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qadmin-modal__header">
          <h3>Adicionar Membro</h3>
          <button className="qadmin-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="qadmin-modal__body">
          <label>
            <span>Nome completo</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rodrigo Sante"
              autoFocus
            />
          </label>
          <label>
            <span>Cargo</span>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ex: CEO & Founder"
            />
          </label>
          <label>
            <span>Setor / Área</span>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Ex: Liderança"
            />
          </label>
        </div>
        <div className="qadmin-modal__footer">
          <button className="qadmin-btn qadmin-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="qadmin-btn qadmin-btn--primary"
            onClick={() => onSave({ name, role, sector })}
            disabled={!name.trim()}
          >
            <CheckCircle2 size={16} />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard Tab ──────────────────────────────────────────────────────── */
function DashboardTab({
  teamCount,
  onNavigate,
}: {
  teamCount: number;
  onNavigate: (tab: Tab) => void;
}) {
  const cards = [
    {
      icon: Users,
      label: "Membros no Time",
      value: teamCount,
      tab: "team" as Tab,
      accent: "#14d0c1",
      hint: "Gerenciar equipe",
    },
    {
      icon: Palette,
      label: "Logos de Empresas",
      value: BRAND_LOGOS.length,
      tab: "logos" as Tab,
      accent: "#a855f7",
      hint: "Atualizar logos",
    },
    {
      icon: Settings,
      label: "Configurações",
      value: "—",
      tab: "settings" as Tab,
      accent: "#e91e8c",
      hint: "Editar dados do site",
    },
  ];

  return (
    <div className="qadmin__dashboard">
      <div className="qadmin__dashWelcome">
        <h2>Bem-vindo ao painel</h2>
        <p>Gerencie o conteúdo do site do Grupo Q-Max em um só lugar.</p>
      </div>

      <div className="qadmin__dashCards">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.tab}
              className="qadmin__dashCard"
              style={{ "--dash-accent": c.accent } as React.CSSProperties}
              onClick={() => onNavigate(c.tab)}
            >
              <div className="qadmin__dashCardIcon">
                <Icon size={24} />
              </div>
              <div className="qadmin__dashCardBody">
                <span className="qadmin__dashCardLabel">{c.label}</span>
                <strong className="qadmin__dashCardValue">{c.value}</strong>
              </div>
              <div className="qadmin__dashCardHint">
                {c.hint} <ChevronRight size={14} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="qadmin__dashTips">
        <h3>Dicas rápidas</h3>
        <ul>
          <li>
            <strong>Time:</strong> Arraste os cards para reordenar a equipe. Clique na foto para
            fazer upload da imagem.
          </li>
          <li>
            <strong>Logos:</strong> Substitua as logos das empresas clicando no card — o arquivo
            original é sobrescrito mantendo o nome.
          </li>
          <li>
            <strong>Configurações:</strong> Atualize contatos, endereço e senha de acesso ao admin.
          </li>
          <li>
            <strong>Carrossel do site:</strong> A seção "Nosso Time" atualiza automaticamente após
            salvar no painel.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ─── Team Tab ───────────────────────────────────────────────────────────── */
function TeamTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setTeam(data.sort((a: TeamMember, b: TeamMember) => a.order - b.order));
    } catch {
      showToast("Erro ao carregar o time", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  async function handleAdd(data: Partial<TeamMember>) {
    try {
      await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await fetchTeam();
      setModal(false);
      showToast("Membro adicionado!");
    } catch {
      showToast("Erro ao adicionar", "error");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este membro?")) return;
    try {
      await fetch(`/api/team/${id}`, { method: "DELETE" });
      setTeam((p) => p.filter((m) => m.id !== id));
      showToast("Membro removido.");
    } catch {
      showToast("Erro ao remover", "error");
    }
  }

  async function handleUpload(member: TeamMember, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("memberId", member.id);
    try {
      const res = await fetch("/api/team/upload", { method: "POST", body: fd });
      const { path } = await res.json();
      await fetch(`/api/team/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: path }),
      });
      setTeam((p) => p.map((m) => (m.id === member.id ? { ...m, image: path } : m)));
      showToast("Foto atualizada!");
    } catch {
      showToast("Erro no upload", "error");
    }
  }

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }
  function onDragEnter(idx: number) {
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      setTeam((p) => {
        const newList = reorder(p, dragIdx.current!, idx);
        dragIdx.current = idx;
        return newList;
      });
    }
  }
  async function onDragEnd() {
    dragIdx.current = null;
    try {
      await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: team.map((m) => m.id) }),
      });
      showToast("Ordem salva!");
    } catch {
      showToast("Erro ao salvar ordem", "error");
    }
  }

  return (
    <div>
      {modal && <MemberModal onSave={handleAdd} onClose={() => setModal(false)} />}

      <div className="qadmin__toolbar">
        <div>
          <h2>Membros da equipe</h2>
          <p>Arraste para reordenar · Clique na foto para fazer upload</p>
        </div>
        <button className="qadmin-btn qadmin-btn--primary" onClick={() => setModal(true)}>
          <Plus size={18} />
          Adicionar membro
        </button>
      </div>

      {loading ? (
        <div className="qadmin__loading">
          <div className="qadmin__spinner" />
          <span>Carregando...</span>
        </div>
      ) : team.length === 0 ? (
        <div className="qadmin__empty">
          <Users size={48} />
          <h3>Nenhum membro ainda</h3>
          <p>Clique em "Adicionar membro" para começar.</p>
        </div>
      ) : (
        <div className="qadmin__grid">
          {team.map((member, idx) => (
            <div
              key={member.id}
              className="qadmin__card"
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="qadmin__dragHandle">
                <GripVertical size={18} />
              </div>

              <label className="qadmin__photoLabel" title="Clique para trocar a foto">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(member, file);
                  }}
                />
                <div className="qadmin__photo">
                  {member.image ? (
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="160px"
                      unoptimized
                    />
                  ) : (
                    <div className="qadmin__photoPlaceholder">
                      <ImageIcon size={28} />
                      <span>Sem foto</span>
                    </div>
                  )}
                  <div className="qadmin__photoOverlay">
                    <Upload size={20} />
                    <span>Trocar foto</span>
                  </div>
                </div>
              </label>

              <div className="qadmin__cardInfo">
                <span className="qadmin__cardSector">{member.sector}</span>
                <strong className="qadmin__cardName">{member.name}</strong>
                <span className="qadmin__cardRole">{member.role}</span>
              </div>

              <button
                className="qadmin__deleteBtn"
                onClick={() => handleDelete(member.id)}
                aria-label={`Remover ${member.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Logos Tab ──────────────────────────────────────────────────────────── */
function LogosTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [logos, setLogos] = useState<BrandLogo[]>(BRAND_LOGOS);
  const [uploading, setUploading] = useState<string | null>(null);

  async function handleLogoUpload(logo: BrandLogo, file: File) {
    if (!file.type.startsWith("image/")) {
      showToast("Apenas imagens são permitidas", "error");
      return;
    }
    setUploading(logo.id);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("filename", logo.filename);
    try {
      await fetch("/api/brands", { method: "POST", body: fd });
      // Bust cache by appending timestamp
      setLogos((prev) =>
        prev.map((l) =>
          l.id === logo.id
            ? { ...l, current: `/brands/${logo.filename}?t=${Date.now()}` }
            : l
        )
      );
      showToast(`Logo "${logo.label}" atualizada!`);
    } catch {
      showToast("Erro ao fazer upload", "error");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div>
      <div className="qadmin__toolbar">
        <div>
          <h2>Logos das Empresas</h2>
          <p>Clique em uma logo para substituí-la · O arquivo original é sobrescrito</p>
        </div>
      </div>

      <div className="qadmin__logosGrid">
        {logos.map((logo) => (
          <label
            key={logo.id}
            className="qadmin__logoCard"
            style={{ "--logo-accent": logo.accent } as React.CSSProperties}
            title={`Trocar logo de ${logo.label}`}
          >
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(logo, file);
              }}
            />

            <div className="qadmin__logoPreview">
              {uploading === logo.id ? (
                <div className="qadmin__spinner" />
              ) : (
                <Image
                  src={logo.current}
                  alt={logo.label}
                  fill
                  style={{ objectFit: "contain" }}
                  sizes="200px"
                  unoptimized
                />
              )}
              <div className="qadmin__logoOverlay">
                <Upload size={22} />
                <span>Trocar logo</span>
              </div>
            </div>

            <div className="qadmin__logoInfo">
              <strong>{logo.label}</strong>
              <span>{logo.filename}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ─── Settings Tab ───────────────────────────────────────────────────────── */
function SettingsTab({
  showToast,
}: {
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => showToast("Erro ao carregar configurações", "error"));
  }, [showToast]);

  function update(key: keyof SiteSettings, value: string) {
    setSettings((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      showToast("Configurações salvas!");
    } catch {
      showToast("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="qadmin__loading">
        <div className="qadmin__spinner" />
        <span>Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="qadmin__settings">
      <div className="qadmin__toolbar">
        <div>
          <h2>Configurações do Site</h2>
          <p>Dados de contato e informações gerais</p>
        </div>
        <button
          className="qadmin-btn qadmin-btn--primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? <RefreshCw size={16} className="qadmin__spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      <div className="qadmin__settingsGrid">
        {/* Site info */}
        <div className="qadmin__settingsSection">
          <h3>
            <Building2 size={16} />
            Informações do Site
          </h3>
          <label>
            <span>Nome do site</span>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => update("siteName", e.target.value)}
            />
          </label>
          <label>
            <span>Tagline / slogan</span>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => update("tagline", e.target.value)}
            />
          </label>
        </div>

        {/* Contact */}
        <div className="qadmin__settingsSection">
          <h3>
            <Phone size={16} />
            Contato
          </h3>
          <label>
            <span>WhatsApp</span>
            <input
              type="text"
              value={settings.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
              placeholder="+55 (11) 91295-7356"
            />
          </label>
          <label>
            <span>Telefone</span>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+55 (11) 2897-6514"
            />
          </label>
          <label>
            <span>
              <Mail size={14} style={{ display: "inline", marginRight: 4 }} />
              E-mail
            </span>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="contato@grupoqmax.com.br"
            />
          </label>
          <label>
            <span>
              <MapPin size={14} style={{ display: "inline", marginRight: 4 }} />
              Endereço
            </span>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => update("address", e.target.value)}
            />
          </label>
        </div>

        {/* Security */}
        <div className="qadmin__settingsSection qadmin__settingsSection--danger">
          <h3>
            <Lock size={16} />
            Segurança
          </h3>
          <label>
            <span>Senha de acesso ao admin</span>
            <div className="qadmin__pwWrap">
              <input
                type={showPw ? "text" : "password"}
                value={settings.adminPassword}
                onChange={(e) => update("adminPassword", e.target.value)}
              />
              <button
                type="button"
                className="qadmin__pwToggle"
                onClick={() => setShowPw((p) => !p)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <p className="qadmin__settingsHint">
            ⚠️ Altere a senha e salve. A nova senha passa a valer no próximo login.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Admin Page ────────────────────────────────────────────────────── */
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "team", label: "Nosso Time", icon: Users },
  { id: "logos", label: "Logos", icon: Palette },
  { id: "settings", label: "Configurações", icon: Settings },
];

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [teamCount, setTeamCount] = useState(0);

  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => setToast({ msg, type }),
    []
  );

  // Load team count for dashboard
  useEffect(() => {
    if (auth) {
      fetch("/api/team")
        .then((r) => r.json())
        .then((d) => setTeamCount(d.length))
        .catch(() => {});
    }
  }, [auth, tab]);

  async function login() {
    // Validate against settings API
    try {
      const res = await fetch("/api/settings");
      const s = await res.json();
      if (pwInput === s.adminPassword) {
        setAuth(true);
        setPwError(false);
      } else {
        setPwError(true);
      }
    } catch {
      // Fallback to default password if API fails
      if (pwInput === "qmax2025") {
        setAuth(true);
        setPwError(false);
      } else {
        setPwError(true);
      }
    }
  }

  /* ── Login ── */
  if (!auth) {
    return (
      <div className="qadmin-login">
        <div className="qadmin-login__card">
          <div className="qadmin-login__logo">
            <Shield size={32} />
          </div>
          <h1>Área Administrativa</h1>
          <p>Acesso restrito — Grupo Q-Max</p>
          <div className="qadmin-login__form">
            <input
              type="password"
              placeholder="Senha de acesso"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className={pwError ? "error" : ""}
              autoFocus
            />
            {pwError && <span className="qadmin-login__error">Senha incorreta.</span>}
            <button className="qadmin-btn qadmin-btn--primary" onClick={login}>
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Panel ── */
  return (
    <div className="qadmin">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Sidebar */}
      <aside className="qadmin__sidebar">
        <div className="qadmin__sidebarBrand">
          <div className="qadmin__sidebarLogo">Q</div>
          <div>
            <strong>Q-Max</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="qadmin__sidebarNav">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`qadmin__navItem${tab === id ? " qadmin__navItem--active" : ""}`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="qadmin__sidebarFooter">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="qadmin__navItem"
          >
            <ChevronRight size={18} />
            Ver site
          </a>
          <button className="qadmin__navItem" onClick={() => setAuth(false)}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="qadmin__content">
        <div className="qadmin__contentInner">
          {tab === "dashboard" && (
            <DashboardTab teamCount={teamCount} onNavigate={setTab} />
          )}
          {tab === "team" && <TeamTab showToast={showToast} />}
          {tab === "logos" && <LogosTab showToast={showToast} />}
          {tab === "settings" && <SettingsTab showToast={showToast} />}
        </div>
      </main>
    </div>
  );
}
