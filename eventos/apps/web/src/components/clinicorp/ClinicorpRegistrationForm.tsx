"use client";

import { AlertCircle, ArrowRight, CalendarCheck, CheckCircle2, Clock, Crown, Gift, Globe, LoaderCircle, Sparkles, Ticket, Trophy, Users, X } from "lucide-react";
import { getApiBaseUrl, fetchApi } from "@/lib/api-client";
import Link from "next/link";
import { StepBar } from "@/components/brand/Brand";
import { Alert, Check, Field, PaperHeading, Segmented, StickyActions, primaryButton } from "@/components/form/Paper";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { postRegistration } from "@/lib/offline-queue";
import OfflineSaved from "@/components/form/OfflineSaved";
import GoldenTicket from "@/components/brand/GoldenTicket";
import VipScheduler from "@/components/VipScheduler";

type Props = {
  eventId: number;
  eventName: string;
  initialVipCode?: string;
  route?: string;
};

function onlyNumbers(value: string) {
  return value.replace(/\D/g, "");
}

export function validateCpfAlgorithmic(cpf: string): boolean {
  const clean = onlyNumbers(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

function formatCpf(value: string) {
  const numbers = onlyNumbers(value).slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatPhone(value: string) {
  const numbers = onlyNumbers(value).slice(0, 11);
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return numbers
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function createDeviceId() {
  if (typeof window === "undefined") return "FINORA-SERVER";
  const existing = window.localStorage.getItem("finora-clinicorp-device-id");
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `FINORA-${crypto.randomUUID()}`
      : `FINORA-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem("finora-clinicorp-device-id", generated);
  return generated;
}

type ClinicPrefill = {
  clinicName?: string;
  chairsCount?: number | null;
  croState?: string;
};

// "Novo cadastro" depois de salvar offline: remonta o formulário zerado (sem navegar, a rede pode estar fora).
export default function ClinicorpRegistrationForm(props: Props) {
  const [round, setRound] = useState(0);
  const [prefill, setPrefill] = useState<ClinicPrefill | null>(null);

  return (
    <RegistrationForm
      key={round}
      {...props}
      initialPrefill={prefill}
      onReset={() => {
        setPrefill(null);
        setRound((r) => r + 1);
      }}
      onResetWithClinic={(data) => {
        setPrefill(data);
        setRound((r) => r + 1);
      }}
    />
  );
}

function RegistrationForm({
  onReset,
  onResetWithClinic,
  initialPrefill,
  eventId,
  eventName: _eventName,
  initialVipCode = "",
  route = "invictus",
}: Props & {
  onReset: () => void;
  onResetWithClinic: (data: ClinicPrefill) => void;
  initialPrefill?: ClinicPrefill | null;
}) {
  const router = useRouter();

  const [deviceId, setDeviceId] = useState("");
  const [fullName, setFullName] = useState("");
  const [isForeigner, setIsForeigner] = useState(false);
  const [countryCode, setCountryCode] = useState("+351");
  const [foreignDoc, setForeignDoc] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clinicName, setClinicName] = useState(initialPrefill?.clinicName || "");
  const [cro, setCro] = useState("");
  const [croState, setCroState] = useState(initialPrefill?.croState || "SP");
  const [chairsCount, setChairsCount] = useState<number | null>(initialPrefill?.chairsCount ?? null);
  const [vipCode, setVipCode] = useState(initialVipCode.toUpperCase());
  const [vipStatus, setVipStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [vipMessage, setVipMessage] = useState<string>("");

  useEffect(() => {
    const clean = vipCode.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!clean) {
      setVipStatus("idle");
      setVipMessage("");
      return;
    }

    if (clean.length < 4) {
      setVipStatus("invalid");
      setVipMessage("Código VIP incompleto.");
      return;
    }

    let active = true;
    setVipStatus("checking");

    const timer = setTimeout(async () => {
      try {
        const apiUrl = getApiBaseUrl();
        const res = await fetch(`${apiUrl}/vip-codes/event/${eventId}/validate/${encodeURIComponent(clean)}`, {
          cache: "no-store",
        });
        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setVipStatus("valid");
            setVipMessage("Código VIP Validado com Sucesso!");
          } else {
            setVipStatus("invalid");
            setVipMessage(data.message || "Código VIP não encontrado ou já utilizado.");
          }
        } else {
          setVipStatus("invalid");
          setVipMessage("Código VIP não encontrado para este evento.");
        }
      } catch {
        if (!active) return;
        setVipStatus("idle");
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [vipCode, eventId]);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [acceptMarketing, setAcceptMarketing] = useState(true);

  const [loading, setLoading] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ceoModalOpen, setCeoModalOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [ceoNextSlot, setCeoNextSlot] = useState<string | null>(null);
  const [bookingCeo, setBookingCeo] = useState(false);
  const [pendingParticipationData, setPendingParticipationData] = useState<{
    id: number;
    participantId: number;
    name: string;
    isVip: boolean;
    vipCode?: string;
    alreadyRegistered: boolean;
    hasDrawn: boolean;
    drawnPrize: string | null;
  } | null>(null);

  const [registeredParticipation, setRegisteredParticipation] = useState<{
    id: number;
    name: string;
    autoBookedSlot?: string | null;
    isVip?: boolean;
    vipCode?: string;
    alreadyRegistered?: boolean;
    hasDrawn?: boolean;
    drawnPrize?: string | null;
  } | null>(null);

  function handleAcceptCeoMeeting() {
    setCeoModalOpen(false);
    setSchedulerModalOpen(true);
  }

  async function handleQuickBookNextSlot() {
    if (!pendingParticipationData || !ceoNextSlot) return;
    setBookingCeo(true);
    try {
      await fetchApi(`/meetings/event/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({
          participantId: pendingParticipationData.participantId,
          scheduledAt: ceoNextSlot,
          meetingEmail: email.trim(),
        }),
      });
      handleMeetingBooked();
    } catch {
      // Se o horário rápido já tiver sido tomado, abre o seletor completo
      setCeoModalOpen(false);
      setSchedulerModalOpen(true);
    } finally {
      setBookingCeo(false);
    }
  }

  function handleMeetingBooked() {
    if (!pendingParticipationData) return;
    setCeoModalOpen(false);
    setSchedulerModalOpen(false);
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#FF9900", "#FFF9B8", "#FFFFFF"],
      disableForReducedMotion: true,
    });
    setRegisteredParticipation({
      ...pendingParticipationData,
      isVip: true,
    });
    setTicketModalOpen(false);
  }

  function handleDeclineCeoMeeting() {
    if (!pendingParticipationData) return;
    setCeoModalOpen(false);
    setSchedulerModalOpen(false);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22C3DC", "#0077FF", "#4ADE80", "#FFFFFF"],
      disableForReducedMotion: true,
    });
    setRegisteredParticipation({
      ...pendingParticipationData,
      isVip: Boolean(pendingParticipationData.isVip),
      autoBookedSlot: null,
    });
    setTicketModalOpen(false);
  }

  useEffect(() => {
    setDeviceId(createDeviceId());
  }, []);

  const isCpfValid = validateCpfAlgorithmic(cpf);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanCpf = onlyNumbers(cpf);
    const cleanPhone = onlyNumbers(phone);

    if (!isForeigner) {
      if (cleanCpf.length !== 11 || !isCpfValid) {
        setError("Por favor, digite um CPF válido.");
        return;
      }

      if (cleanPhone.length < 10) {
        setError("Por favor, informe um WhatsApp válido com DDD.");
        return;
      }
    } else {
      const cleanDoc = foreignDoc.trim().replace(/[^a-zA-Z0-9]/g, '');
      if (cleanDoc.length < 4) {
        setError("Por favor, informe um número de documento/passaporte válido com pelo menos 4 caracteres.");
        return;
      }

      if (cleanPhone.length < 7) {
        setError("Por favor, informe um telefone/WhatsApp internacional válido (mínimo 7 dígitos).");
        return;
      }
    }

    if (!acceptTerms) {
      setError("É necessário aceitar os termos para participar.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Por favor, informe um E-mail válido.");
      return;
    }

    setLoading(true);

    try {
      const res = await postRegistration({
        eventId,
        fullName: fullName.trim(),
        isForeigner,
        countryCode: isForeigner ? countryCode : undefined,
        foreignDocument: isForeigner ? foreignDoc.trim() : undefined,
        cpf: isForeigner ? foreignDoc.trim() : cleanCpf,
        phone: cleanPhone,
        email: email.trim(),
        clinicName: clinicName.trim() || undefined,
        croNumber: cro.trim() || undefined,
        croState: isForeigner ? undefined : (croState.trim() || "SP"),
        chairsCount: chairsCount || undefined,
        deviceId,
        marketingConsent: acceptMarketing,
        privacyConsent: acceptTerms,
        vipCode: vipCode.trim() || undefined,
      });

      if (res === "queued") {
        setOfflineSaved(fullName.trim());
        return;
      }

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.message || "Erro ao processar cadastro.");
      }

      const participation = result.participation || result;

      if (participation.status === "APPROVED" || participation.status === "PENDING" || result.alreadyRegistered) {
        const isVipUser = Boolean(
          result.vip ||
            participation.vip ||
            participation.vip_codes ||
            result.participation?.vipCode ||
            (vipStatus === "valid" && !result.error)
        );

        const partData = {
          id: participation.id,
          participantId: result.participant?.id || participation.participantId || participation.participant_id || participation.id,
          name: fullName.trim() || result.participant?.fullName || "Participante",
          isVip: isVipUser,
          vipCode: result.participation?.vipCode || participation.vipCode || (vipStatus === "valid" ? vipCode.trim() : undefined),
          alreadyRegistered: Boolean(result.alreadyRegistered),
          hasDrawn: Boolean(result.participation?.hasDrawn),
          drawnPrize: result.participation?.drawnPrize || null,
        };

        // Para TODOS os participantes (inclusive VIP) que ainda não realizaram o sorteio, oferece agendamento exclusivo com o CEO!
        if (!partData.hasDrawn) {
          setPendingParticipationData(partData);
          setCeoModalOpen(true);
          fetch(`${getApiBaseUrl()}/meetings/event/${eventId}/next-slot`)
            .then((r) => r.json())
            .then((d) => {
              if (d?.nextSlot) setCeoNextSlot(d.nextSlot);
            })
            .catch(() => {});
          return;
        }

        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#22C3DC", "#FFD700", "#0077FF", "#4ADE80", "#FFFFFF"],
          disableForReducedMotion: true,
        });
        setRegisteredParticipation({
          ...partData,
          autoBookedSlot: result.autoBookedSlot || null,
        });
        setTicketModalOpen(false);
        return;
      }

      if (participation.status === "REVIEW") {
        setError(
          result?.blockedReason ||
            "Sua participação precisa de uma rápida validação. Procure a equipe Finora no estande.",
        );
        return;
      }

      if (participation.status === "BLOCKED") {
        setError(
          result?.blockedReason ||
            "Esta participação atingiu o limite de giros para este CPF/evento. Procure nossa equipe.",
        );
        return;
      }

      setError(result?.blockedReason || "Não foi possível liberar a participação neste momento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao realizar o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  if (offlineSaved) return <OfflineSaved name={offlineSaved} onNew={onReset} />;

  // Passo 2: confirmação imediata (sem WhatsApp e com suporte a já cadastrado)
  if (registeredParticipation) {
    const isVip = registeredParticipation.isVip;
    const isAlready = registeredParticipation.alreadyRegistered;
    const hasDrawn = registeredParticipation.hasDrawn;
    const drawnPrize = registeredParticipation.drawnPrize;
    const nameParts = registeredParticipation.name.trim().split(/\s+/);
    const firstName =
      (nameParts[0]?.toLowerCase().startsWith("dr") && nameParts.length > 1)
        ? `${nameParts[0]} ${nameParts[1]}`
        : nameParts[0] || "Participante";

    return (
      <div className="flex flex-1 flex-col pb-36 sm:pb-32 overscroll-y-contain">
        <PaperHeading
          eyebrow={
            <>
              <StepBar step={2} total={2} />
              <span className="mt-2.5 block font-mono text-xs uppercase tracking-wider text-accent font-semibold">
                {isAlready
                  ? "CPF Já Cadastrado · Giro Confirmado"
                  : isVip
                    ? "Bilhete Dourado Emitido · VIP"
                    : "Cadastro Concluído · Giro Liberado"}
              </span>
            </>
          }
          title={
            isAlready
              ? (hasDrawn ? "Participação Já Realizada" : "Você Já Possui Cadastro!")
              : (isVip ? "Seu Bilhete Dourado de Mentorado" : "Cadastro Concluído com Sucesso!")
          }
        >
          <p className="text-[17px] leading-[1.45] text-slate-300">
            {isAlready ? (
              hasDrawn ? (
                <>
                  Olá, <strong>{firstName}</strong>! Identificamos que este CPF já girou a roleta neste evento e conquistou o prêmio: <strong className="text-accent">{drawnPrize || "Brinde Especial"}</strong>.
                </>
              ) : (
                <>
                  Olá, <strong>{firstName}</strong>! Seu cadastro já consta em nossa base de participantes. Seu giro está <strong className="text-emerald-600">100% liberado</strong>! Apresente o código abaixo para nossa equipe no estande.
                </>
              )
            ) : isVip ? (
              `Parabéns, ${firstName}! Seu bilhete VIP exclusivo foi emitido com sucesso. Apresente no estande Finora para girar no Pool VIP e concorrer ao Grande Sorteio no Telão.`
            ) : (
              `Pronto, ${firstName}! Seu cadastro foi concluído com sucesso e seu giro já está liberado. Não é necessário confirmar por WhatsApp.`
            )}
          </p>
        </PaperHeading>

        <div className="flex flex-col gap-3 px-5">
          {isVip ? (
            <GoldenTicket
              code={registeredParticipation.vipCode || `#${String(registeredParticipation.id).padStart(4, "0")}`}
              eventName={_eventName}
              eventSlug={route}
              participantName={registeredParticipation.name}
              ticketNumber={registeredParticipation.id}
              showPrintButton={false}
              className="my-1"
            />
          ) : (
            registeredParticipation.id && (
              <div className="holographic-card flex items-center justify-between rounded-card bg-ink-950/90 px-6 py-5 text-ink-text shadow-[0_12px_40px_rgba(34,195,220,0.2)] border border-accent/40 animate-pop-burst">
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-accent uppercase">SEU CÓDIGO DE RETIRADA</span>
                  <span className="text-xs text-ink-text-2 mt-0.5">Apresente no balcão Finora</span>
                </div>
                <span className="font-mono text-[32px] font-black tracking-[0.05em] text-accent drop-shadow-[0_0_14px_rgba(var(--accent-rgb),0.6)]">
                  #{String(registeredParticipation.id).padStart(4, "0")}
                </span>
              </div>
            )
          )}

          {registeredParticipation.autoBookedSlot && (
            <div className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4">
              <CalendarCheck size={22} className="mt-0.5 flex-none text-accent-ink" />
              <div className="flex flex-col gap-1">
                <strong>
                  Conversa VIP às{" "}
                  {new Date(registeredParticipation.autoBookedSlot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </strong>
                <span className="text-sm leading-[1.4] text-text-2">Vá até o estande neste horário para falar com nossos especialistas.</span>
              </div>
            </div>
          )}

          {/* Confirmação do Grande Sorteio Geral */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-amber-950/30 p-4 text-amber-200 shadow-md">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              <Trophy size={18} className="text-amber-400 flex-none" />
              <span>Inscrição Confirmada no Grande Sorteio Geral (19/11)!</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Seu cupom está registrado e concorrendo oficialmente ao <strong>Fotopolimerizador Odontológico</strong> no sorteio geral do dia 19/11 no telão.
            </p>
            <div className="mt-1 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 font-semibold">
              📍 <strong>Dias 20 e 21/11:</strong> Venha ao estande Finora com seu código PIN para girar a Roleta VIP e retirar brindes exclusivos!
            </div>
          </div>

          {!hasDrawn && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-[14px]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Passo a Passo das Próximas Etapas</span>
              </div>
              <ol className="flex flex-col gap-2.5 text-text">
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-bold text-accent">1</span>
                  <span>Dirija-se ao estande da Finora.</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-bold text-accent">2</span>
                  <span>Apresente seu código para o operador, gire a roleta e retire seu prêmio.</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-400/30 text-xs font-mono font-bold text-amber-300">3</span>
                  <span><strong>Dia 19/11:</strong> Acompanhe a apuração ao vivo do Grande Sorteio Geral!</span>
                </li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-6" />

        <StickyActions>
          {!hasDrawn ? (
            <>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3.5 text-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] animate-pulse-glow">
                <span className="font-display text-base font-extrabold text-white flex items-center justify-center gap-2">
                  📍 Mostre esta tela no estande Finora
                </span>
                <span className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Apresente seu código para a nossa equipe liberar seu giro no tablet da roleta!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTicketModalOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-3 text-[14px] font-black text-[#3E2723] hover:brightness-110 transition-all cursor-pointer shadow-md active:scale-[0.98]"
              >
                <Ticket size={18} />
                {isVip ? "Visualizar Bilhete VIP em Popup 🎫" : "Visualizar Cupom em Popup 🎫"}
              </button>
              {clinicName && (
                <button
                  type="button"
                  onClick={() => onResetWithClinic({ clinicName, chairsCount, croState })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-accent/15 border border-accent/40 py-2.5 text-[14px] font-bold text-accent hover:bg-accent/25 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Users size={16} />
                  Cadastrar Colega da Clínica {clinicName}
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className="inline-flex w-full items-center justify-center rounded-button py-2 text-[13px] font-medium text-text-2 hover:text-text transition-colors"
              >
                Cadastrar Outro Participante
              </button>
              <Link
                href={`/${route}/roleta?pin=${registeredParticipation.id}${registeredParticipation.vipCode ? `&vip=${registeredParticipation.vipCode}` : ""}`}
                className="text-[12px] font-mono text-center text-slate-400 hover:text-accent transition-colors pt-0.5"
              >
                Acesso equipe Finora: abrir roleta
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={onReset}
              className={primaryButton}
            >
              Fazer Novo Cadastro
            </button>
          )}
          <span className="text-center text-[13px] text-text-2">
            {isVip ? "Bilhete VIP válido para o Pool VIP e Grande Sorteio." : "Você já concorre ao Grande Sorteio de encerramento."}
          </span>
        </StickyActions>

        {/* Modal Popup: Bilhete / Cupom Oficial em Popup */}
        {ticketModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-3xl border-2 border-[#FFD700] bg-[#090E1C] p-4 sm:p-7 text-white shadow-[0_25px_80px_rgba(255,215,0,0.5)] animate-pop-burst my-auto">
              <button
                type="button"
                onClick={() => setTicketModalOpen(false)}
                aria-label="Fechar"
                className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 px-3.5 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-[#FFDF73]">
                  <Crown size={14} className="text-[#FFD700]" />
                  {isVip ? "SEU PASSE VIP OFICIAL EMITIDO" : "SEU CUPOM DE PARTICIPAÇÃO"}
                </span>
                <h3 className="mt-2 font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                  {isVip ? "Bilhete Dourado do Mentorado" : "Cupom de Participação Finora"}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#C2CEE3]">
                  {isVip
                    ? "Apresente no estande Finora para girar a Roleta VIP e concorrer aos prêmios executivos!"
                    : "Apresente seu código no estande Finora para girar a roleta e retirar seu brinde!"}
                </p>
              </div>

              <div className="w-full flex justify-center py-2 overflow-x-auto">
                <GoldenTicket
                  code={registeredParticipation.vipCode || `#${String(registeredParticipation.id).padStart(4, "0")}`}
                  eventName={_eventName}
                  eventSlug={route}
                  participantName={registeredParticipation.name}
                  ticketNumber={registeredParticipation.id}
                  showPrintButton={true}
                  className="my-1 scale-[0.92] sm:scale-100 origin-center"
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-white/10 pt-4">
                <div className="text-xs font-mono text-slate-400 text-center sm:text-left">
                  Código: <strong className="text-white">#{String(registeredParticipation.id).padStart(4, "0")}</strong>
                  {isVip && (
                    <span className="ml-2 text-[#FFD700] font-bold">★ Roleta VIP Liberada</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setTicketModalOpen(false)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] font-bold text-xs uppercase tracking-wider text-[#3E2723] hover:brightness-110 transition-all cursor-pointer shadow-md"
                >
                  Concluir & Ir para o Estande 🚀
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overscroll-y-contain">
      <PaperHeading
        eyebrow={<><StepBar step={1} total={2} /><span className="mt-2.5 block">Passo 1 de 2 · leva 1 minuto</span></>}
        title="Cadastro · Roleta de Prêmios & Sorteio Geral"
      />

      <div className="flex flex-1 flex-col gap-5 px-5 pt-2 pb-32 sm:pb-28">
        {error && <Alert>{error}</Alert>}

        {/* Banner Oficial Finora Experience - Sem imagem pesada, design luxuoso */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-900/95 via-slate-950 to-amber-950/20 p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-accent border border-accent/30">
              ✦ FINORA EXPERIENCE · INVICTUS 2026 ✦
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/40">
              ✨ Roleta VIP & Sorteio Geral
            </span>
          </div>

          {/* Destaque Dia 19 e Visita Dias 20 e 21 */}
          <div className="rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 p-3.5 text-center shadow-xs">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-display text-sm font-black uppercase tracking-wide">
              <span>🗓️</span>
              <span>Cadastros Realizados no Dia 19/11</span>
            </div>
            <p className="mt-1.5 text-xs sm:text-[13px] text-slate-200 leading-relaxed">
              Compareça ao estande da Finora nos <strong>dias 20 ou 21/11</strong> com o seu <strong>código PIN</strong> para girar a <strong>Roleta VIP</strong> e retirar seus prêmios exclusivos!
            </p>
          </div>

          {/* 3 Passos Minimalistas e Elegantes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-black text-accent">
                1
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white">Preencha os Dados</strong>
                <span className="text-[11px] text-slate-400 leading-tight">Gere seu código oficial</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-400/20 text-xs font-mono font-black text-amber-300">
                2
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-amber-200">Guarde seu PIN</strong>
                <span className="text-[11px] text-slate-400 leading-tight">Receba seu número único</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-950/20 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-mono font-black">
                3
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-amber-200">Estande dias 20 e 21</strong>
                <span className="text-[11px] text-amber-300/80 leading-tight">Gire a Roleta VIP</span>
              </div>
            </div>
          </div>
        </div>

        {initialVipCode && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-100/90 via-amber-50 to-amber-100/60 p-3.5 shadow-sm text-amber-950 animate-pop-burst">
            <span className="text-2xl">👑</span>
            <div className="flex flex-col">
              <span className="font-extrabold text-xs uppercase tracking-wider text-amber-900">
                Passe VIP Identificado via QR Code
              </span>
              <span className="text-xs font-semibold text-amber-800">
                Bilhete <strong className="font-mono font-black text-amber-950">#{vipCode}</strong> ativado! Seus prêmios exclusivos já estão liberados.
              </span>
            </div>
          </div>
        )}

        {initialPrefill?.clinicName && (
          <div className="flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/15 px-3.5 py-2.5 text-xs text-slate-200 animate-pop-burst">
            <Users size={16} className="text-accent flex-none" />
            <span>
              Cadastrando colega de <strong>{initialPrefill.clinicName}</strong>. Dados da clínica pré-preenchidos!
            </span>
          </div>
        )}

        <Field id="c-nome" label="Nome completo" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />

        {/* Seletor de Nacionalidade: Brasileiro x Estrangeiro */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-300">Nacionalidade / Documento</label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setIsForeigner(false);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isForeigner
                  ? "bg-accent text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🇧🇷 Brasileiro (CPF)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsForeigner(true);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isForeigner
                  ? "bg-amber-400 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🌐 Estrangeiro (Passaporte)</span>
            </button>
          </div>
        </div>

        {!isForeigner ? (
          <Field
            id="c-cpf"
            label="CPF"
            inputMode="numeric"
            required
            maxLength={14}
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            error={cpf.length === 14 && !isCpfValid ? "CPF inválido. Confira os números." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Globe size={15} />
              <span>Visitante Internacional / Estrangeiro</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="c-country" className="text-xs font-semibold text-slate-300">
                País de Origem / Código do País *
              </label>
              <select
                id="c-country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3.5 text-sm text-white outline-none focus:border-amber-400"
              >
                <option value="+351">🇵🇹 Portugal (+351)</option>
                <option value="+1">🇺🇸 Estados Unidos (+1)</option>
                <option value="+54">🇦🇷 Argentina (+54)</option>
                <option value="+595">🇵🇾 Paraguai (+595)</option>
                <option value="+598">🇺🇾 Uruguai (+598)</option>
                <option value="+56">🇨🇱 Chile (+56)</option>
                <option value="+34">🇪🇸 Espanha (+34)</option>
                <option value="+39">🇮🇹 Itália (+39)</option>
                <option value="+33">🇫🇷 França (+33)</option>
                <option value="+49">🇩🇪 Alemanha (+49)</option>
                <option value="+44">🇬🇧 Reino Unido (+44)</option>
                <option value="+52">🇲🇽 México (+52)</option>
                <option value="+57">🇨🇴 Colômbia (+57)</option>
                <option value="+51">🇵🇪 Peru (+51)</option>
                <option value="+591">🇧🇴 Bolívia (+591)</option>
                <option value="OUTRO">🌐 Outro País / Internacional</option>
              </select>
            </div>

            <Field
              id="c-passport"
              label="Passaporte ou Documento de Identificação (DNI / ID) *"
              required
              maxLength={30}
              placeholder="Ex: Passaporte ou DNI do seu país"
              value={foreignDoc}
              onChange={(e) => setForeignDoc(e.target.value.toUpperCase())}
              hint="Informe o número do seu documento oficial de identificação estrangeiro."
            />
          </div>
        )}

        <Field
          id="c-wpp"
          label={isForeigner ? "WhatsApp / Telefone Internacional" : "WhatsApp"}
          type="tel"
          inputMode="tel"
          required
          maxLength={isForeigner ? 25 : 15}
          placeholder={isForeigner ? "+351 912 345 678" : "(00) 00000-0000"}
          value={phone}
          onChange={(e) => {
            if (isForeigner) {
              setPhone(e.target.value);
            } else {
              setPhone(formatPhone(e.target.value));
            }
          }}
          hint={isForeigner ? "Informe seu número com código do país (DDI)." : "Seu número de contato no evento."}
        />
        <Field id="c-mail" label="E-mail" type="email" inputMode="email" required placeholder="voce@clinica.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />

        <Field
          id="c-vip"
          label="Código do cartão VIP (opcional)"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={16}
          hint="Recebeu um cartão VIP? Digite o código para liberar a roleta VIP."
          value={vipCode}
          onChange={(e) => setVipCode(e.target.value.toUpperCase())}
        />

        {vipStatus === "checking" && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5 text-xs text-slate-300">
            <LoaderCircle size={14} className="animate-spin text-accent" />
            <span>Verificando autenticidade do código VIP...</span>
          </div>
        )}

        {vipStatus === "valid" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100/70 p-3 text-xs font-bold text-amber-900 shadow-xs animate-pop-burst">
            <span className="text-xl">👑</span>
            <div>
              <p className="font-extrabold text-amber-900">
                {initialVipCode ? `Bilhete VIP #${vipCode} Ativado via QR Code!` : `Bilhete VIP #${vipCode} Validado!`}
              </p>
              <p className="text-[11px] text-amber-800 font-medium">Seu cadastro terá acesso liberado ao Pool de Prêmios VIP exclusivos no estande.</p>
            </div>
          </div>
        )}

        {vipStatus === "invalid" && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-400/40 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle size={15} className="text-rose-400 flex-none" />
            <span>{vipMessage || "Código VIP não encontrado ou já utilizado. Deixe em branco caso não possua cartão VIP."}</span>
          </div>
        )}

        <div className="my-1 h-px bg-line" />

        <Field id="c-clin" label="Nome da clínica (opcional)" autoComplete="organization" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
          <Field id="c-cro" label="CRO (opcional)" inputMode="numeric" value={cro} onChange={(e) => setCro(e.target.value)} />
          <Field id="c-uf" label="UF" maxLength={2} value={croState} onChange={(e) => setCroState(e.target.value.toUpperCase())} />
        </div>

        <Segmented
          label="Quantas cadeiras na clínica?"
          value={chairsCount}
          onChange={setChairsCount}
          options={[
            { value: 1, label: "1–2" },
            { value: 4, label: "3–5" },
            { value: 6, label: "6 ou mais" },
          ]}
        />

        <div className="flex flex-col gap-3 pt-1">
          <Check checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}>
            Aceito o regulamento e o uso dos meus dados para esta ativação e o sorteio.
          </Check>
          <Check checked={acceptMarketing} onChange={(e) => setAcceptMarketing(e.target.checked)}>
            Quero receber novidades da Finora.
          </Check>
        </div>
      </div>

      <StickyActions>
        <button
          type="submit"
          disabled={
            loading ||
            (!isForeigner && (cpf.length === 14 && !isCpfValid)) ||
            (isForeigner && foreignDoc.trim().length < 4) ||
            vipStatus === "checking" ||
            vipStatus === "invalid"
          }
          className={primaryButton}
        >
          {loading ? (
            <><LoaderCircle size={20} className="animate-spin" /> Liberando giro…</>
          ) : vipStatus === "valid" ? (
            "👑 Liberar Giro VIP na Roleta 🌟"
          ) : (
            "Liberar Meu Giro na Roleta 🎯"
          )}
        </button>
        <span className="text-center text-[13px] text-slate-400">Giro liberado no estande · Participação garantida no Grande Sorteio Geral dia 19/11</span>
      </StickyActions>

      {/* Modal Popup: Convite de Reunião com o CEO para Destravar Roleta VIP */}
      {ceoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[#FFD700] bg-[#090E1C] p-6 sm:p-8 text-white shadow-[0_20px_70px_rgba(255,215,0,0.45)] animate-pop-burst">
            {/* Fechar no X recusa e vai para roleta normal */}
            <button
              type="button"
              onClick={handleDeclineCeoMeeting}
              aria-label="Fechar"
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Ícone de Destaque Nobre */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFE57F] via-[#FFD700] to-[#FF9900] shadow-[0_0_25px_rgba(255,215,0,0.6)]">
              <Crown size={32} className="text-[#3E2723]" />
            </div>

            <h3 className="mt-4 text-center font-display text-2xl sm:text-3xl font-black text-white leading-tight">
              {pendingParticipationData?.isVip
                ? "Agende sua Consultoria VIP com o CEO"
                : "Deseja marcar uma reunião com nosso CEO?"}
            </h3>

            <p className="mt-2 text-center text-sm sm:text-[15px] text-[#C2CEE3] leading-relaxed">
              {pendingParticipationData?.isVip ? (
                <>
                  Como participante VIP, garanta seu horário de consultoria estratégica individual de <strong>45 minutos</strong> com nosso CEO Hugo Werninghaus!
                </>
              ) : (
                <>
                  Ao agendar um bate-papo exclusivo com nosso CEO durante o evento, você ganha acesso instantâneo à{" "}
                  <strong className="text-[#FFD700] font-black">Roleta VIP</strong>!
                </>
              )}
            </p>

            {/* Benefícios VIP */}
            <div className="my-4 flex flex-col gap-2 rounded-2xl border border-[#FFD700]/40 bg-gradient-to-r from-[#FFD700]/15 via-[#FF9900]/10 to-[#FFD700]/15 p-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2 font-mono font-black text-[#FFD700] uppercase text-[11px]">
                <Sparkles size={14} className="text-[#FFD700]" />
                <span>O que você concorre na Roleta VIP:</span>
              </div>
              <ul className="grid grid-cols-1 gap-2 text-slate-200 text-xs sm:text-[13px] pt-1">
                <li className="flex items-center gap-2.5">
                  <span className="text-[#FFD700] text-base">👑</span>
                  <span><strong>Mentoria Exclusiva com o CEO (2 horas)</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#FFD700] text-base">💎</span>
                  <span><strong>100% ou 50% de Desconto no 1º Honorário</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="text-[#FFD700] text-base">📜</span>
                  <span><strong>Certificado Oficial Finora & Diagnóstico Tributário</strong></span>
                </li>
              </ul>
            </div>

            {/* Informação do Próximo Horário */}
            {ceoNextSlot && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                <CalendarCheck size={18} className="text-[#FFD700] flex-none" />
                <span>
                  Horário sugerido:{" "}
                  <strong className="text-white">
                    {new Date(ceoNextSlot).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })} às{" "}
                    {new Date(ceoNextSlot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </strong>{" "}
                  no estande Finora.
                </span>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col gap-2.5 pt-1">
              {ceoNextSlot && (
                <button
                  type="button"
                  onClick={handleQuickBookNextSlot}
                  disabled={bookingCeo}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-3.5 px-6 font-display text-base font-black text-[#3E2723] shadow-[0_10px_30px_rgba(255,215,0,0.5)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {bookingCeo ? (
                    <>
                      <LoaderCircle size={18} className="animate-spin text-[#3E2723]" />
                      <span>Confirmando agendamento automático...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmar Reunião no Horário Sugerido ⚡</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleAcceptCeoMeeting}
                disabled={bookingCeo}
                className={`w-full flex items-center justify-center gap-2 rounded-full py-3 px-6 font-display text-sm sm:text-base font-bold transition-all cursor-pointer ${
                  ceoNextSlot
                    ? "border border-[#FFD700]/50 bg-[#FFD700]/15 text-[#FFE57F] hover:bg-[#FFD700]/25"
                    : "bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] font-black py-3.5"
                }`}
              >
                <span>{ceoNextSlot ? "📅 Escolher Outro Dia ou Horário" : "Sim, Escolher Horário & Liberar Roleta VIP 🌟"}</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={handleDeclineCeoMeeting}
                disabled={bookingCeo}
                className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {pendingParticipationData?.isVip
                  ? "Pular agendamento e acessar meu bilhete VIP ➔"
                  : "Prefiro não agendar agora, ir para a roleta padrão ➔"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup: Agendamento com o CEO em Popup Dedicado */}
      {schedulerModalOpen && pendingParticipationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border-2 border-[#FFD700] bg-[#090E1C] p-4 sm:p-6 text-white shadow-[0_25px_80px_rgba(255,215,0,0.5)] animate-pop-burst my-auto">
            <button
              type="button"
              onClick={() => {
                setSchedulerModalOpen(false);
                handleDeclineCeoMeeting();
              }}
              aria-label="Fechar"
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 px-3.5 py-1 font-mono text-[11px] font-black uppercase tracking-wider text-[#FFDF73]">
                <Crown size={14} className="text-[#FFD700]" />
                AGENDAMENTO EXCLUSIVO COM O CEO
              </span>
              <h3 className="mt-2 font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                Selecione o Dia e Horário
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#C2CEE3]">
                Reunião estratégica de <strong>45 minutos</strong> com <strong>Hugo Werninghaus (CEO Grupo Q-Max)</strong> via Microsoft Teams.
              </p>
              <div className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-amber-400/10 border border-amber-400/30 px-3 py-1.5 text-[11.5px] text-amber-200">
                ⏰ Horários de hora em hora · Intervalo de almoço (12h às 14h) fechado.
              </div>
            </div>

            <VipScheduler
              participantId={pendingParticipationData.participantId}
              eventId={eventId}
              meetingEmail={email.trim()}
              onBooked={handleMeetingBooked}
            />
          </div>
        </div>
      )}
    </form>
  );
}
