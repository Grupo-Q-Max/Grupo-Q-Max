"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Gift,
  LoaderCircle,
  MapPin,
  MessageSquare,
  PackageCheck,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { ui } from "@/components/form/Paper";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAdminProxyUrl } from "@/lib/api-client";


type FraudCheck = {
  id: number;
  rule_type: string;
  decision: string;
  previous_count: number;
  configured_limit: number;
  reason: string;
};

type Prize = {
  id: number;
  name: string;
};

type Draw = {
  id: number;
  source: string;
  drawn_at: string;
  claimed_at?: string | null;
  prizes: Prize;
};

type Participant = {
  id: number;
  status:
    | "APPROVED"
    | "BLOCKED"
    | "REVIEW"
    | string;

  started_at: string | null;
  completed_at: string | null;
  created_at: string;

  participants: {
    id: number;
    full_name: string;
    cpf?: string;
    cpf_formatted?: string;
    cpf_last_digits: string;
    phone: string;
    email: string;
    cro_number: string;
    cro_state: string;
    clinic_name: string | null;
    city: string | null;
    state: string | null;
    chairs_count: number | null;
    meetings?: Array<{
      id: number;
      scheduled_at: string;
      status: string;
    }>;
  };

  vip_codes?: {
    id: number;
    code: string;
    redeemed_at?: string | null;
  } | null;

  draws: Draw[];
  fraud_checks: FraudCheck[];
};

type Props = {
  participations: Participant[];
  canExport: boolean;
};

type Filter =
  | "ALL"
  | "HOT_LEADS"
  | "WARM_LEADS"
  | "GENERAL_LEADS"
  | "VIP_MENTOR"
  | "VIP_CHAIRS"
  | "SPUN"
  | "PENDING_SPIN"
  | "APPROVED"
  | "BLOCKED"
  | "REVIEW";


function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function statusInfo(status: string) {
  switch (status) {
    case "APPROVED":
      return {
        label: "Aprovado",
        className:
          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
        icon: CheckCircle2,
      };

    case "BLOCKED":
      return {
        label: "Bloqueado",
        className:
          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold border-rose-500/30 bg-rose-500/15 text-rose-400",
        icon: XCircle,
      };

    case "REVIEW":
      return {
        label: "Em análise",
        className:
          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold border-[#F2D19B] bg-[#FFF3DC] text-[#8A4B00]",
        icon: AlertTriangle,
      };

    default:
      return {
        label: status,
        className:
          "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold border-line bg-paper text-text-2",
        icon: ShieldCheck,
      };
  }
}

function buildWhatsAppDirectUrl(participant: Participant["participants"], prizeName?: string) {
  const cleanPhone = (participant.phone || "").replace(/\D/g, "");
  if (!cleanPhone) return null;
  const internationalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  const firstName = participant.full_name?.split(" ")[0] || "Doutor(a)";
  let msg = `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora. Vimos sua participação no Summit Clinicorp!`;
  if (prizeName && prizeName !== "Nenhum" && prizeName !== "Não sorteado") {
    msg += ` Parabéns pelo seu prêmio (${prizeName})!`;
  }
  msg += ` Gostaríamos de conversar sobre como otimizar a gestão financeira da sua clínica. Você tem 5 minutinhos hoje?`;
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(msg)}`;
}

export function getLeadCommercialCategory(item: Participant): {
  type: "HOT" | "WARM" | "GENERAL";
  label: string;
  badgeClass: string;
  pillColor: string;
} {
  const hasMeeting = item.participants?.meetings?.some(
    (m) => m.status === "SCHEDULED" || m.status === "COMPLETED",
  );
  const draw = Array.isArray(item.draws) ? item.draws[0] : (item.draws as any);
  const hasClaimed = Boolean(draw?.claimed_at);

  if (hasMeeting || hasClaimed) {
    return {
      type: "HOT",
      label: "🟢 Quente",
      badgeClass: "border-emerald-500/40 bg-emerald-50 text-emerald-800 font-extrabold shadow-2xs",
      pillColor: "#10B981",
    };
  }

  const isVip = Boolean(item.vip_codes) || (item.participants?.chairs_count || 0) >= 6;
  if (isVip) {
    return {
      type: "WARM",
      label: "🟡 Morno (VIP)",
      badgeClass: "border-amber-400 bg-amber-50 text-amber-900 font-extrabold shadow-2xs",
      pillColor: "#F59E0B",
    };
  }

  return {
    type: "GENERAL",
    label: "⚪ Geral",
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700 font-medium",
    pillColor: "#64748B",
  };
}

export default function ParticipantsManager({
  participations,
  canExport,
}: Props) {
  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<Filter>("ALL");

  const [selected, setSelected] =
    useState<Participant | null>(
      null,
    );

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key === "Escape") {
        if (search) {
          setSearch("");
        } else if (selected) {
          setSelected(null);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search, selected]);

  const [resendingWhatsapp, setResendingWhatsapp] = useState(false);
  const [whatsappFeedback, setWhatsappFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [claimingPrize, setClaimingPrize] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleClaimPrize(participationId: number) {
    setClaimingPrize(true);
    setClaimFeedback(null);
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/draws/participation/${participationId}/claim`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimFeedback({ type: 'success', message: data.message || "Prêmio marcado como ENTREGUE!" });
        if (selected) {
          setSelected({ ...selected, status: "COMPLETED" });
        }
      } else {
        setClaimFeedback({ type: 'error', message: data.message || "Falha ao registrar entrega." });
      }
    } catch {
      setClaimFeedback({ type: 'error', message: "Erro de conexão ao registrar entrega." });
    } finally {
      setClaimingPrize(false);
    }
  }

  async function handleResendWhatsapp(participationId: number) {
    setResendingWhatsapp(true);
    setWhatsappFeedback(null);
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/whatsapp/resend/${participationId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWhatsappFeedback({ type: 'success', message: data.message || "Notificação reenviada com sucesso!" });
      } else {
        setWhatsappFeedback({ type: 'error', message: data.message || "Falha ao enviar notificação WhatsApp." });
      }
    } catch {
      setWhatsappFeedback({ type: 'error', message: "Erro de conexão ao solicitar reenvio." });
    } finally {
      setResendingWhatsapp(false);
    }
  } 

  function hasSpun(item: any): boolean {
    if (item.status === "COMPLETED") return true;
    if (Array.isArray(item.draws)) return item.draws.length > 0;
    if (item.draws && typeof item.draws === "object" && Object.keys(item.draws).length > 0) return true;
    return false;
  }

  const counts = useMemo(() => {
    return {
      all: participations.length,
      hotLeads: participations.filter((item) => getLeadCommercialCategory(item).type === "HOT").length,
      warmLeads: participations.filter((item) => getLeadCommercialCategory(item).type === "WARM").length,
      generalLeads: participations.filter((item) => getLeadCommercialCategory(item).type === "GENERAL").length,
      vipMentor: participations.filter((item) => Boolean(item.vip_codes)).length,
      vipChairs: participations.filter(
        (item) => (item.participants?.chairs_count || 0) >= 6,
      ).length,
      spun: participations.filter((item) => hasSpun(item)).length,
      pendingSpin: participations.filter(
        (item) => (item.status === "APPROVED" || item.status === "PENDING") && !hasSpun(item),
      ).length,
      blocked: participations.filter((item) => item.status === "BLOCKED").length,
      review: participations.filter((item) => item.status === "REVIEW").length,
    };
  }, [participations]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return participations.filter((item) => {
      const participant = item.participants;

      if (filter === "HOT_LEADS" && getLeadCommercialCategory(item).type !== "HOT") {
        return false;
      }

      if (filter === "WARM_LEADS" && getLeadCommercialCategory(item).type !== "WARM") {
        return false;
      }

      if (filter === "GENERAL_LEADS" && getLeadCommercialCategory(item).type !== "GENERAL") {
        return false;
      }

      if (filter === "VIP_MENTOR" && !item.vip_codes) {
        return false;
      }

      if (filter === "VIP_CHAIRS" && (participant?.chairs_count || 0) < 6) {
        return false;
      }

      if (filter === "SPUN" && !hasSpun(item)) {
        return false;
      }

      if (
        filter === "PENDING_SPIN" &&
        (hasSpun(item) || (item.status !== "APPROVED" && item.status !== "PENDING"))
      ) {
        return false;
      }

      if (filter === "APPROVED" && item.status !== "APPROVED") {
        return false;
      }

      if (filter === "BLOCKED" && item.status !== "BLOCKED") {
        return false;
      }

      if (filter === "REVIEW" && item.status !== "REVIEW") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchable = [
        participant.full_name,
        participant.cpf,
        participant.cpf_formatted,
        participant.email,
        participant.phone,
        participant.cro_number,
        participant.cro_state,
        participant.clinic_name,
        participant.city,
        participant.state,
        participant.cpf_last_digits,
        item.vip_codes?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [participations, search, filter]);

  function handleExportCsv(onlyFiltered: boolean = false) {
    const listToExport = onlyFiltered ? filtered : participations;
    if (listToExport.length === 0) return;

    const headers = [
      "PIN",
      "Nome Completo",
      "VIP / Mentorado",
      "Código VIP",
      "Telefone (WhatsApp)",
      "Link WhatsApp Direto",
      "E-mail",
      "CRO",
      "UF CRO",
      "Clínica",
      "Cidade",
      "UF",
      "Qtd Cadeiras",
      "Classificação Lead",
      "CPF",
      "Status Participação",
      "Girou Roleta",
      "Prêmio Ganho",
      "Data Sorteio",
      "Status Entrega",
      "Data Cadastro",
    ];

    const escapeCsvField = (field: string | number | null | undefined): string => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = listToExport.map((item) => {
      const p = item.participants;
      const isVip = Boolean(item.vip_codes);
      const draw = Array.isArray(item.draws) && item.draws.length > 0
        ? item.draws[0]
        : (item.draws && typeof item.draws === 'object' ? (item.draws as any) : null);
      const spun = hasSpun(item);
      const prizeName = draw?.prizes?.name || (spun ? "Prêmio Registrado" : "Não sorteado");
      const drawDate = draw?.drawn_at
        ? new Date(draw.drawn_at).toLocaleString("pt-BR")
        : (item.completed_at ? new Date(item.completed_at).toLocaleString("pt-BR") : "");
      const isDelivered = item.status === "COMPLETED";

      const cleanPhone = (p.phone || "").replace(/\D/g, "");
      const intlPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
      const waLink = intlPhone ? `https://wa.me/${intlPhone}` : "";
      const isBigClinic = (p.chairs_count || 0) >= 6;
      const leadClassification = isVip
        ? `VIP Mentorado (${isBigClinic ? "6+ Cad." : "Geral"})`
        : (isBigClinic ? "VIP (6+ Cadeiras)" : "Padrão");

      return [
        escapeCsvField(`#${String(item.id).padStart(4, '0')}`),
        escapeCsvField(p.full_name),
        escapeCsvField(isVip ? "SIM (VIP / Mentorado)" : "NÃO"),
        escapeCsvField(item.vip_codes?.code || "-"),
        escapeCsvField(p.phone),
        escapeCsvField(waLink),
        escapeCsvField(p.email),
        escapeCsvField(p.cro_number || ""),
        escapeCsvField(p.cro_state || ""),
        escapeCsvField(p.clinic_name || ""),
        escapeCsvField(p.city || ""),
        escapeCsvField(p.state || ""),
        escapeCsvField(p.chairs_count ?? ""),
        escapeCsvField(leadClassification),
        escapeCsvField(p.cpf_formatted || p.cpf || (p.cpf_last_digits ? `***.***.***-${p.cpf_last_digits}` : "")),
        escapeCsvField(item.status),
        escapeCsvField(spun ? "SIM" : "NÃO"),
        escapeCsvField(prizeName),
        escapeCsvField(drawDate),
        escapeCsvField(isDelivered ? "ENTREGUE" : (spun ? "PENDENTE NO ESTANDE" : "AGUARDANDO GIRO")),
        escapeCsvField(item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : ""),
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads-finora-experience-${onlyFiltered ? 'filtrados-' : 'todos-'}${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportVCard(onlyFiltered: boolean = false) {
    const listToExport = onlyFiltered ? filtered : participations;
    if (listToExport.length === 0) return;

    const vcards = listToExport.map((item) => {
      const p = item.participants;
      const cleanPhone = (p.phone || "").replace(/\D/g, "");
      const intlPhone = cleanPhone ? (cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`) : "";
      const isBigClinic = (p.chairs_count || 0) >= 6;
      const draw = Array.isArray(item.draws) && item.draws.length > 0 ? item.draws[0] : null;
      const prizeName = draw?.prizes?.name || (hasSpun(item) ? "Premiado" : "Participante");

      const prefix = isBigClinic ? "👑 Dr(a)." : "Dr(a).";
      const orgInfo = p.clinic_name ? ` (${p.clinic_name}${p.chairs_count ? ` · ${p.chairs_count} cad.` : ""})` : "";
      const formattedName = `${prefix} ${p.full_name}${orgInfo}`;

      const notes = [
        `Evento: Summit Clinicorp / Finora Experience`,
        p.clinic_name ? `Clínica: ${p.clinic_name}` : null,
        p.chairs_count ? `Cadeiras: ${p.chairs_count}` : null,
        p.cro_number ? `CRO: ${p.cro_number}/${p.cro_state || "SP"}` : null,
        p.city ? `Cidade: ${p.city}/${p.state || ""}` : null,
        `Status: ${item.status}`,
        `Prêmio: ${prizeName}`,
        intlPhone ? `WhatsApp: https://wa.me/${intlPhone}` : null,
      ].filter(Boolean).join("\\n");

      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `FN:${formattedName}`,
        `N:${p.full_name.split(" ").slice(-1)[0] || ""};${p.full_name.split(" ").slice(0, -1).join(" ") || ""};;;Dr(a).`,
        p.clinic_name ? `ORG:${p.clinic_name}` : "ORG:Clínica Odontológica",
        "TITLE:Dentista / Cirurgião-Dentista",
        intlPhone ? `TEL;TYPE=CELL,VOICE,WHATSAPP:+${intlPhone}` : "",
        p.email ? `EMAIL;TYPE=WORK:${p.email}` : "",
        p.city ? `ADR;TYPE=WORK:;;;${p.city};${p.state || "SP"};;Brasil` : "",
        `NOTE:${notes}`,
        "END:VCARD",
      ].filter(Boolean).join("\r\n");
    }).join("\r\n");

    const blob = new Blob([vcards], { type: "text/vcard;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `contatos-finora-celular-${onlyFiltered ? 'filtrados-' : 'todos-'}${dateStr}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <div className="flex h-11 items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-text-2 focus-within:border-finora-600 [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm [&_input]:text-text [&_input]:outline-none [&_button]:grid [&_button]:size-7 [&_button]:place-items-center [&_button]:rounded-full [&_button]:bg-surface">
          <Search size={17} />

          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar por nome, CRO, clínica, telefone ou e-mail (Pressione / para buscar)"
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch("")
              }
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="[&>button]:inline-flex [&>button]:h-9 [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-full [&>button]:border [&>button]:border-line [&>button]:bg-surface [&>button]:px-3.5 [&>button]:text-[13px] [&>button]:font-semibold [&>button]:text-text-2 [&_span]:min-w-[22px] [&_span]:rounded-full [&_span]:bg-surface [&_span]:px-2 [&_span]:py-0.5 [&_span]:text-[11px] [&_span]:font-bold [&_span]:text-text flex items-center flex-wrap gap-2">
          <button
            type="button"
            className={
              filter === "ALL"
                ? "border-finora-600! bg-cyan-500/15! text-cyan-400! [&>span]:bg-finora-600! [&>span]:text-white!"
                : ""
            }
            onClick={() =>
              setFilter("ALL")
            }
          >
            Todos
            <span>{counts.all}</span>
          </button>

          <button
            type="button"
            className={
              filter === "HOT_LEADS"
                ? "border-emerald-600! bg-gradient-to-r from-emerald-600 to-teal-600! text-white! font-black! shadow-sm [&>span]:bg-white! [&>span]:text-emerald-950!"
                : "border-emerald-400/80 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 font-bold [&>span]:bg-emerald-200 [&>span]:text-emerald-950"
            }
            onClick={() => setFilter("HOT_LEADS")}
            title="Filtrar Leads Quentes: Agendaram reunião ou passaram pelo estande (Alta Prioridade)"
          >
            🟢 Quentes
            <span>{counts.hotLeads}</span>
          </button>

          <button
            type="button"
            className={
              filter === "WARM_LEADS"
                ? "border-amber-500! bg-gradient-to-r from-amber-500 to-yellow-500! text-white! font-black! shadow-sm [&>span]:bg-white! [&>span]:text-amber-950!"
                : "border-amber-400/80 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold [&>span]:bg-amber-200 [&>span]:text-amber-950"
            }
            onClick={() => setFilter("WARM_LEADS")}
            title="Filtrar Leads Mornos: VIPs / Mentorados sem reunião confirmada"
          >
            🟡 Mornos
            <span>{counts.warmLeads}</span>
          </button>

          <button
            type="button"
            className={
              filter === "GENERAL_LEADS"
                ? "border-slate-500! bg-slate-700! text-white! font-black! shadow-sm [&>span]:bg-white! [&>span]:text-slate-900!"
                : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 font-medium [&>span]:bg-slate-200 [&>span]:text-slate-800"
            }
            onClick={() => setFilter("GENERAL_LEADS")}
            title="Filtrar Leads Gerais: Visitantes de feira para nutrição ampla"
          >
            ⚪ Gerais
            <span>{counts.generalLeads}</span>
          </button>

          <button
            type="button"
            className={
              filter === "VIP_MENTOR"
                ? "border-amber-500! bg-gradient-to-r from-amber-500 to-yellow-500! text-white! font-black! shadow-sm [&>span]:bg-white! [&>span]:text-amber-950!"
                : "border-amber-400/80 bg-amber-100/70 text-amber-950 hover:bg-amber-200/70 font-bold [&>span]:bg-amber-300/80 [&>span]:text-amber-950"
            }
            onClick={() =>
              setFilter("VIP_MENTOR")
            }
            title="Filtrar participantes VIPs que resgataram código de mentorado"
          >
            👑 VIPs / Mentorados
            <span>{counts.vipMentor}</span>
          </button>

          <button
            type="button"
            className={
              filter === "VIP_CHAIRS"
                ? "border-amber-500! bg-amber-500! text-white! font-bold! shadow-sm [&>span]:bg-white! [&>span]:text-amber-800!"
                : "border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 [&>span]:bg-amber-200/80 [&>span]:text-amber-900"
            }
            onClick={() =>
              setFilter("VIP_CHAIRS")
            }
            title="Filtrar clínicas de grande porte com 6 ou mais cadeiras (Leads de Alto Valor)"
          >
            👑 Grandes Clínicas (6+ Cadeiras)
            <span>{counts.vipChairs}</span>
          </button>

          <button
            type="button"
            className={
              filter === "SPUN"
                ? "border-finora-600! bg-cyan-500/15! text-cyan-400! [&>span]:bg-finora-600! [&>span]:text-white!"
                : ""
            }
            onClick={() =>
              setFilter("SPUN")
            }
          >
            🎉 Já Giraram (Premiados)
            <span>
              {counts.spun}
            </span>
          </button>

          <button
            type="button"
            className={
              filter === "PENDING_SPIN"
                ? "border-finora-600! bg-cyan-500/15! text-cyan-400! [&>span]:bg-finora-600! [&>span]:text-white!"
                : ""
            }
            onClick={() =>
              setFilter("PENDING_SPIN")
            }
          >
            ⏳ Aguardando Giro
            <span>
              {counts.pendingSpin}
            </span>
          </button>

          <button
            type="button"
            className={
              filter === "BLOCKED"
                ? "border-finora-600! bg-cyan-500/15! text-cyan-400! [&>span]:bg-finora-600! [&>span]:text-white!"
                : ""
            }
            onClick={() =>
              setFilter(
                "BLOCKED",
              )
            }
          >
            Bloqueados
            <span>
              {counts.blocked}
            </span>
          </button>

          <button
            type="button"
            className={
              filter === "REVIEW"
                ? "border-finora-600! bg-cyan-500/15! text-cyan-400! [&>span]:bg-finora-600! [&>span]:text-white!"
                : ""
            }
            onClick={() =>
              setFilter("REVIEW")
            }
          >
            Em análise
            <span>
              {counts.review}
            </span>
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="px-5 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-line">
          <div>
            <strong className="text-text font-extrabold text-base">
              {filtered.length}
            </strong>
            <span className="text-text-2 text-sm">
              {filtered.length === 1
                ? " participante exibido"
                : " participantes exibidos"}
            </span>
            <span className="text-text-2 text-xs font-semibold ml-2">
              (Total no evento: {participations.length})
            </span>
          </div>

          {canExport && (
          <div className="flex items-center gap-2 flex-wrap">
            {filtered.length !== participations.length && (
              <button
                type="button"
                onClick={() => handleExportCsv(true)}
                className="px-3.5 py-1.5 rounded-full bg-surface hover:bg-line-strong border border-line-strong text-text text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Exportar apenas os participantes filtrados na tela"
              >
                <Download size={14} className="text-text" />
                <span className="text-text font-bold">Exportar Filtrados ({filtered.length})</span>
              </button>
            )}

            <button
              type="button"
              disabled={participations.length === 0}
              onClick={() => handleExportVCard(filtered.length !== participations.length)}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              title="Baixar arquivo .vcf para importar todos os contatos com 1 clique direto na agenda do celular / WhatsApp"
            >
              <Smartphone size={14} className="text-white" />
              <span className="text-white font-extrabold">Salvar no Celular (.vcf)</span>
            </button>

            <button
              type="button"
              disabled={participations.length === 0}
              onClick={() => handleExportCsv(false)}
              className="px-4 py-1.5 rounded-full bg-finora-600 hover:bg-finora-700 text-white text-xs font-extrabold transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Baixar planilha completa de todos os leads cadastrados para o Comercial"
            >
              <FileSpreadsheet size={15} className="text-white" />
              <span className="text-white font-extrabold">Exportar Planilha ({participations.length} Leads)</span>
            </button>
          </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center text-center text-text-2 [&>div]:mb-2.5 [&>div]:grid [&>div]:size-11 [&>div]:place-items-center [&>div]:rounded-xl [&>div]:bg-cyan-500/15 [&>div]:text-cyan-400 [&_strong]:text-[15px] [&_strong]:text-text [&_p]:mt-1 [&_p]:text-sm">
            <div>
              <Search size={22} />
            </div>

            <strong>
              Nenhum participante
              encontrado
            </strong>

            <p>
              Tente alterar a busca
              ou os filtros.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((item) => {
              const participant =
                item.participants;

              const status =
                statusInfo(
                  item.status,
                );

              const StatusIcon =
                status.icon;

              const prize =
                item.draws?.[0]
                  ?.prizes;

              const directWaUrl = buildWhatsAppDirectUrl(
                participant,
                prize?.name,
              );
              const isVipLead = (participant.chairs_count || 0) >= 6;
              const isVipMentor = Boolean(item.vip_codes);
              const isAnyVip = isVipLead || isVipMentor;

              return (
                <button
                  key={item.id}
                  type="button"
                  className="grid min-h-[72px] w-full cursor-pointer grid-cols-[44px_minmax(170px,1.2fr)_minmax(130px,1fr)_105px_minmax(120px,0.8fr)_90px_36px_20px] items-center gap-2.5 border-b border-[#EEF1F5] px-[18px] py-3 text-left transition-colors last:border-b-0 hover:bg-paper max-[1050px]:grid-cols-[38px_minmax(140px,1fr)_95px_34px_18px]"
                  onClick={() =>
                    setSelected(item)
                  }
                >
                  <div className={`grid size-10 place-items-center rounded-xl relative ${
                    isAnyVip
                      ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400"
                      : "bg-cyan-500/15 text-cyan-400"
                  }`}>
                    <UserRound
                      size={18}
                    />
                    {isAnyVip && (
                      <span className="absolute -top-1 -right-1 text-[11px]" title={isVipMentor ? `Mentorado VIP (${item.vip_codes?.code})` : "Clínica VIP (6+ cadeiras)"}>👑</span>
                    )}
                  </div>

                  <div className="[&_strong]:block [&_strong]:text-sm [&_strong]:font-bold [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong>
                        {
                          participant.full_name
                        }
                      </strong>
                      {(() => {
                        const comm = getLeadCommercialCategory(item);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${comm.badgeClass}`}
                            title={`Classificação Comercial: ${comm.label}`}
                          >
                            {comm.label}
                          </span>
                        );
                      })()}
                      {isVipMentor && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-200 to-yellow-300 border border-amber-400 text-[10px] font-black text-amber-950 shadow-2xs tracking-wide">
                          👑 VIP · {item.vip_codes?.code}
                        </span>
                      )}
                      {isVipLead && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[10px] font-extrabold text-amber-900 tracking-tight">
                          {participant.chairs_count} cad.
                        </span>
                      )}
                    </div>

                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        CRO {participant.cro_number}/{participant.cro_state}
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        CPF: {participant.cpf_formatted || participant.cpf || (participant.cpf_last_digits ? `***.***.***-${participant.cpf_last_digits}` : "-")}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-text-2 max-[1050px]:hidden truncate">
                    <Building2
                      size={14}
                      className="shrink-0"
                    />

                    <span className="truncate">
                      {participant.clinic_name ||
                        "Clínica não informada"}
                    </span>
                  </div>

                  <div>
                    <span
                      className={
                        status.className
                      }
                    >
                      <StatusIcon
                        size={13}
                      />

                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#6B4FD8] max-[1050px]:hidden truncate">
                    {prize ? (
                      <>
                        <Gift
                          size={14}
                          className="shrink-0"
                        />

                        <span className="truncate">
                          {prize.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-text-2">
                        —
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-xs text-text-2 max-[1050px]:hidden">
                    {formatDate(
                      item.created_at,
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                    {directWaUrl ? (
                      <a
                        href={directWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-[#25D366] hover:text-white transition-all shadow-xs cursor-pointer active:scale-95"
                        title={`Chamar ${participant.full_name.split(' ')[0]} no WhatsApp Web`}
                        aria-label={`Chamar ${participant.full_name} no WhatsApp Web`}
                      >
                        <MessageSquare size={16} />
                      </a>
                    ) : (
                      <span className="inline-flex size-8 items-center justify-center text-text-2 opacity-25">
                        <MessageSquare size={16} />
                      </span>
                    )}
                  </div>

                  <ChevronRight
                    size={17}
                    className="text-text-2"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div
          className="fixed inset-0 z-[9999] flex justify-end bg-text/30 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelected(null);
            }
          }}
        >
          <aside className="h-full w-[min(520px,100%)] overflow-y-auto border-l border-line bg-paper text-text">
            <header className="sticky top-0 z-[3] flex items-start justify-between border-b border-line bg-surface/95 p-5 backdrop-blur [&_h2]:my-1 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_p]:text-sm [&_p]:text-text-2 [&_button]:grid [&_button]:size-9 [&_button]:place-items-center [&_button]:rounded-full [&_button]:border [&_button]:border-line [&_button]:text-text-2">
              <div>
                <span className={ui.eyebrow}>
                  PARTICIPANTE
                </span>

                <h2>
                  {
                    selected
                      .participants
                      .full_name
                  }
                </h2>

                <p>
                  Participação #
                  {selected.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelected(null)
                }
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex flex-col gap-3 p-4">
              {/* Card Classificação Comercial */}
              {(() => {
                const comm = getLeadCommercialCategory(selected);
                const meeting = selected.participants?.meetings?.[0];
                return (
                  <div className={`flex items-center justify-between rounded-2xl border p-3.5 shadow-xs ${
                    comm.type === "HOT"
                      ? "border-emerald-400 bg-emerald-50/80 text-emerald-950"
                      : comm.type === "WARM"
                      ? "border-amber-400 bg-amber-50/80 text-amber-950"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">Qualificação Comercial</span>
                      <strong className="text-sm font-extrabold flex items-center gap-1.5 mt-0.5">
                        {comm.label}
                        {meeting && (
                          <span className="text-xs font-semibold text-emerald-700">
                            · Reunião: {new Date(meeting.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </strong>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/80 border border-current shadow-2xs">
                      {comm.type === "HOT" ? "Prioridade 1" : comm.type === "WARM" ? "Prioridade 2" : "Prioridade 3"}
                    </span>
                  </div>
                );
              })()}

              {/* Card Destaque VIP Mentorado */}
              {selected.vip_codes && (
                <div className="flex items-center justify-between rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100/60 p-3.5 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">👑</span>
                    <div className="flex flex-col">
                      <strong className="text-xs font-black text-amber-950 uppercase tracking-wide">Participante VIP · Mentorado</strong>
                      <span className="text-[12px] text-amber-900 font-mono mt-0.5">
                        Código ativado: <strong className="text-amber-950 underline font-black">{selected.vip_codes.code}</strong>
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] uppercase tracking-wider shadow-2xs">
                    Pool VIP
                  </span>
                </div>
              )}

              {/* 1-Clique WhatsApp Comercial */}
              {(() => {
                const prizeName = selected.draws?.[0]?.prizes?.name;
                const waUrl = buildWhatsAppDirectUrl(selected.participants, prizeName);
                const isVip = (selected.participants.chairs_count || 0) >= 6;
                if (!waUrl) return null;
                return (
                  <section className="rounded-[18px] border-2 border-[#25D366]/40 bg-gradient-to-br from-[#E3F6EA]/70 via-white to-amber-50/50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-9 place-items-center rounded-xl bg-[#25D366] text-white shadow-xs">
                          <MessageSquare size={19} />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-emerald-400 leading-tight">Contato Comercial Direto</h4>
                          <p className="text-[11px] text-text-2">Abre WhatsApp Web com abordagem personalizada</p>
                        </div>
                      </div>
                      {isVip && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white font-extrabold text-[10px] tracking-wide uppercase shadow-xs">
                          👑 Lead VIP
                        </span>
                      )}
                    </div>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2.5 w-full py-3 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all active:scale-[0.98] tracking-wide cursor-pointer"
                    >
                      <MessageSquare size={16} />
                      <span>Iniciar Conversa no WhatsApp com Dr(a). {selected.participants.full_name.split(" ")[0]}</span>
                    </a>
                  </section>
                );
              })()}

              <section className="rounded-[18px] border border-line bg-surface p-4 [&_h3]:mb-3 [&_h3]:text-[15px] [&_h3]:font-bold">
                <h3>
                  Cadastro
                </h3>

                <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1 [&>div]:rounded-lg [&>div]:bg-paper [&>div]:p-2.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-sm [&_strong]:[overflow-wrap:anywhere]">
                  <div>
                    <span>
                      CPF
                    </span>
                    <strong className="font-mono text-emerald-400">
                      {selected.participants.cpf_formatted ||
                        selected.participants.cpf ||
                        (selected.participants.cpf_last_digits
                          ? `***.***.***-${selected.participants.cpf_last_digits}`
                          : "-")}
                    </strong>
                  </div>

                  <div>
                    <span>
                      CRO
                    </span>
                    <strong>
                      {
                        selected
                          .participants
                          .cro_number
                      }
                      /
                      {
                        selected
                          .participants
                          .cro_state
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Telefone
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <strong>
                        {
                          selected
                            .participants
                            .phone
                        }
                      </strong>
                      {(() => {
                        const prizeName = selected.draws?.[0]?.prizes?.name;
                        const waUrl = buildWhatsAppDirectUrl(selected.participants, prizeName);
                        return waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline"
                          >
                            <MessageSquare size={12} />
                            Zap
                          </a>
                        ) : null;
                      })()}
                    </div>
                  </div>

                  <div>
                    <span>
                      E-mail
                    </span>
                    <strong>
                      {
                        selected
                          .participants
                          .email
                      }
                    </strong>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-line bg-surface p-4 [&_h3]:mb-3 [&_h3]:text-[15px] [&_h3]:font-bold">
                <div className="flex items-center justify-between mb-3">
                  <h3>
                    Clínica
                  </h3>
                  {(selected.participants.chairs_count || 0) >= 6 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                      👑 6+ Cadeiras (Lead VIP Ouro)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1 [&>div]:rounded-lg [&>div]:bg-cyan-500/15 [&>div]:p-3 [&>div]:text-cyan-400 [&_span]:mt-2 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-sm [&_strong]:text-text">
                  <div>
                    <Building2
                      size={17}
                    />

                    <span>
                      Clínica
                    </span>

                    <strong>
                      {selected
                        .participants
                        .clinic_name ||
                        "Não informada"}
                    </strong>
                  </div>

                  <div>
                    <MapPin
                      size={17}
                    />

                    <span>
                      Localização
                    </span>

                    <strong>
                      {[
                        selected
                          .participants
                          .city,
                        selected
                          .participants
                          .state,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          " / ",
                        ) ||
                        "Não informada"}
                    </strong>
                  </div>

                  <div>
                    <Stethoscope
                      size={17}
                    />

                    <span>
                      Cadeiras
                    </span>

                    <strong>
                      {selected
                        .participants
                        .chairs_count ??
                        "—"}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-line bg-surface p-4 [&_h3]:mb-3 [&_h3]:text-[15px] [&_h3]:font-bold">
                <h3>
                  Participação
                </h3>

                <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1 [&>div]:rounded-lg [&>div]:bg-paper [&>div]:p-2.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-sm [&_strong]:[overflow-wrap:anywhere]">
                  <div>
                    <span>
                      Status
                    </span>

                    <strong>
                      {
                        statusInfo(
                          selected.status,
                        ).label
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Registrado
                    </span>

                    <strong>
                      {formatDate(
                        selected.created_at,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Prêmio
                    </span>

                    <strong>
                      {selected
                        .draws?.[0]
                        ?.prizes
                        ?.name ||
                        "Nenhum"}
                    </strong>
                  </div>
                </div>

                {selected.draws?.[0] && (
                  <div className="mt-3 flex flex-col gap-2">
                    {selected.status === 'COMPLETED' ? (
                      <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold">
                        <CheckCircle2 size={15} />
                        <span>Prêmio Entregue no Balcão</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={claimingPrize}
                        onClick={() => handleClaimPrize(selected.id)}
                        className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-finora-600 hover:bg-finora-700 text-white rounded-full text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {claimingPrize ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <PackageCheck size={15} />
                        )}
                        <span>Confirmar Retirada do Brinde</span>
                      </button>
                    )}

                    {claimFeedback && (
                      <p className={`text-xs px-2 py-1 rounded-lg ${claimFeedback.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                        {claimFeedback.message}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={resendingWhatsapp}
                      onClick={() => handleResendWhatsapp(selected.id)}
                      className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-surface hover:bg-line-strong text-text border border-line-strong rounded-xl text-xs font-medium transition-all disabled:opacity-50 mt-1"
                    >
                      {resendingWhatsapp ? (
                        <LoaderCircle size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Reenviar Mensagem WhatsApp</span>
                    </button>
                    {whatsappFeedback && (
                      <p className={`text-xs px-2 py-1 rounded-lg ${whatsappFeedback.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                        {whatsappFeedback.message}
                      </p>
                    )}
                  </div>
                )}
              </section>



              <section className="rounded-[18px] border border-line bg-surface p-4 [&_h3]:mb-3 [&_h3]:text-[15px] [&_h3]:font-bold">
                <h3>
                  Antifraude
                </h3>

                {selected
                  .fraud_checks
                  ?.length ? (
                  <div className="flex flex-col gap-1.5">
                    {selected.fraud_checks.map(
                      (
                        check,
                      ) => (
                        <div
                          key={
                            check.id
                          }
                          className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-paper p-2.5 [&>div:first-child]:grid [&>div:first-child]:size-[29px] [&>div:first-child]:place-items-center [&>div:first-child]:rounded-lg [&>div:first-child]:bg-[#FFF3DC] [&>div:first-child]:text-[#8A4B00] [&_strong]:text-sm [&_p]:mt-0.5 [&_p]:text-xs [&_p]:text-text-2 [&>span]:text-xs [&>span]:font-bold [&>span]:text-text-2"
                        >
                          <div>
                            <ShieldCheck
                              size={
                                16
                              }
                            />
                          </div>

                          <div>
                            <strong>
                              {
                                check.rule_type
                              }
                            </strong>

                            <p>
                              {
                                check.reason
                              }
                            </p>
                          </div>

                          <span>
                            {
                              check.decision
                            }
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 p-2.5 text-sm font-semibold text-emerald-400">
                    <CheckCircle2
                      size={17}
                    />

                    Nenhuma ocorrência
                    registrada.
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
