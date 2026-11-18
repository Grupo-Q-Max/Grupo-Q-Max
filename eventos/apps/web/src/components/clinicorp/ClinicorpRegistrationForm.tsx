"use client";

import { AlertCircle, ArrowRight, CalendarCheck, CheckCircle2, Clock, Crown, LoaderCircle, Sparkles, Users, X } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-client";
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

  async function handleAcceptCeoMeeting() {
    if (!pendingParticipationData) return;
    setBookingCeo(true);
    let chosenSlot = ceoNextSlot;

    try {
      if (!chosenSlot) {
        const resSlot = await fetch(`${getApiBaseUrl()}/meetings/event/${eventId}/next-slot`).catch(() => null);
        if (resSlot?.ok) {
          const d = await resSlot.json();
          chosenSlot = d.nextSlot;
        }
      }

      if (chosenSlot) {
        await fetch(`${getApiBaseUrl()}/meetings/event/${eventId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: pendingParticipationData.participantId,
            scheduledAt: chosenSlot,
          }),
        });
      }

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
        autoBookedSlot: chosenSlot,
      });
      setCeoModalOpen(false);
    } catch (e) {
      console.error("Erro ao agendar reunião com CEO:", e);
      setRegisteredParticipation({
        ...pendingParticipationData,
        isVip: true,
      });
      setCeoModalOpen(false);
    } finally {
      setBookingCeo(false);
    }
  }

  function handleDeclineCeoMeeting() {
    if (!pendingParticipationData) return;
    setCeoModalOpen(false);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22C3DC", "#0077FF", "#4ADE80", "#FFFFFF"],
      disableForReducedMotion: true,
    });
    setRegisteredParticipation({
      ...pendingParticipationData,
      isVip: false,
      autoBookedSlot: null,
    });
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

    if (cleanCpf.length !== 11 || !isCpfValid) {
      setError("Por favor, digite um CPF válido.");
      return;
    }

    if (cleanPhone.length < 10) {
      setError("Por favor, informe um WhatsApp válido com DDD.");
      return;
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
        cpf: cleanCpf,
        phone: cleanPhone,
        email: email.trim(),
        clinicName: clinicName.trim() || undefined,
        croNumber: cro.trim() || undefined,
        croState: croState.trim() || "SP",
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

        // Se NÃO for VIP e ainda não realizou o sorteio, abre o popup perguntando se quer marcar com o CEO para ter Roleta VIP!
        if (!isVipUser && !partData.hasDrawn) {
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
      <div className="flex flex-1 flex-col pb-6 overscroll-y-contain">
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
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20 p-4 text-amber-200 shadow-lg animate-pop-burst">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              <span className="text-lg">🎉</span>
              <span>Inscrição Confirmada no Grande Sorteio Geral (19/11)!</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-950/60 rounded-xl p-2.5 border border-amber-400/30">
              <img
                src="/fotopolimerizador.jpg"
                alt="Fotopolimerizador"
                className="h-16 w-16 object-contain rounded-lg bg-white/10 p-1 flex-none"
              />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-300">Prêmio Oficial</span>
                <strong className="text-xs sm:text-sm text-white font-bold">Fotopolimerizador Odontológico</strong>
                <span className="text-[11px] text-slate-300 leading-tight">Apuração ao vivo no dia 19/11.</span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Além de girar a roleta e retirar seu brinde exclusivo no estande Finora, <strong>seu número de cadastro está automaticamente concorrendo ao Fotopolimerizador no Grande Sorteio Geral do dia 19/11</strong>! Fique atento às transmissões no telão.
            </p>
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overscroll-y-contain">
      <PaperHeading
        eyebrow={<><StepBar step={1} total={2} /><span className="mt-2.5 block">Passo 1 de 2 · leva 1 minuto</span></>}
        title="Cadastro · Roleta de Prêmios & Sorteio Geral"
      />

      <div className="flex flex-1 flex-col gap-4.5 px-5 pt-2 pb-6">
        {error && <Alert>{error}</Alert>}

        {/* Card Passo a Passo & Grande Sorteio Geral 19/11 */}
        <div className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-gradient-to-b from-slate-900/95 to-slate-950 p-4.5 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-accent border border-accent/30">
              ⚡ Passo a Passo
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11.5px] font-bold text-amber-300 border border-amber-400/40">
              🎁 Grande Sorteio Geral dia 19/11
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/25 text-xs font-mono font-black text-accent">
                1
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white">Preencha o Cadastro</strong>
                <span className="text-[11px] text-slate-300 leading-tight">Insira seus dados rápidos abaixo para gerar seu código.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent/25 text-xs font-mono font-black text-accent">
                2
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-white">Gire a Roleta no Estande</strong>
                <span className="text-[11px] text-slate-300 leading-tight">Apresente seu código no estande Finora e retire brindes na hora.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-950/30 p-2.5">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-amber-400 text-slate-950 text-xs font-mono font-black">
                3
              </span>
              <div className="flex flex-col">
                <strong className="text-xs font-bold text-amber-200">Grande Sorteio Geral</strong>
                <span className="text-[11px] text-amber-300/90 leading-tight">Concorra automaticamente ao sorteio oficial no dia 19/11!</span>
              </div>
            </div>
          </div>

          {/* Card Recompensa Sorteio Geral 19/11 */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 p-3 shadow-md">
            <div className="relative h-20 w-20 flex-none overflow-hidden rounded-lg border border-amber-400/60 bg-white/5 shadow-inner">
              <img
                src="/fotopolimerizador.jpg"
                alt="Fotopolimerizador - Grande Sorteio Geral"
                className="h-full w-full object-contain p-1"
              />
            </div>
            <div className="flex flex-1 flex-col text-center sm:text-left">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                🏆 Grande Prêmio Oficial · Sorteio Geral 19/11
              </span>
              <strong className="text-sm font-bold text-white leading-snug">
                Fotopolimerizador Odontológico
              </strong>
              <span className="text-[11px] text-slate-300 leading-tight mt-0.5">
                O sorteio geral acontecerá exclusivamente no dia 19/11. Todo participante cadastrado concorre automaticamente!
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-amber-500/15 px-3.5 py-2.5 text-center text-xs font-semibold text-amber-200 shadow-xs">
            📢 <strong>Atenção:</strong> Ao concluir o cadastro, você garante seu brinde na roleta e <strong>estará concorrendo oficialmente ao Fotopolimerizador no dia 19/11</strong>!
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
        <Field
          id="c-wpp"
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          required
          maxLength={15}
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          hint="Seu número de contato no evento."
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
          disabled={loading || (cpf.length === 14 && !isCpfValid) || vipStatus === "checking" || vipStatus === "invalid"}
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
              Deseja marcar uma reunião com nosso CEO?
            </h3>

            <p className="mt-2 text-center text-sm sm:text-[15px] text-[#C2CEE3] leading-relaxed">
              Ao agendar um bate-papo exclusivo com nosso CEO durante o evento, você ganha acesso instantâneo à{" "}
              <strong className="text-[#FFD700] font-black">Roleta VIP</strong>!
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
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleAcceptCeoMeeting}
                disabled={bookingCeo}
                className="w-full flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-3.5 px-6 font-display text-base sm:text-lg font-black text-[#3E2723] shadow-[0_10px_30px_rgba(255,215,0,0.5)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                {bookingCeo ? (
                  <>
                    <LoaderCircle size={20} className="animate-spin text-[#3E2723]" />
                    <span>Liberando Roleta VIP…</span>
                  </>
                ) : (
                  <>
                    <span>Sim, Agendar com CEO & Liberar Roleta VIP 🌟</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDeclineCeoMeeting}
                disabled={bookingCeo}
                className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Não, quero continuar apenas com a Roleta Normal
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
