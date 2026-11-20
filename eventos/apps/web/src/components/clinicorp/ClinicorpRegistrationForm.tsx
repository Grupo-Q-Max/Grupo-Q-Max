"use client";

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Globe,
  LoaderCircle,
  Sparkles,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-client";
import Link from "next/link";
import { StepBar } from "@/components/brand/Brand";
import { Alert, Check, Field, PaperHeading, StickyActions, primaryButton } from "@/components/form/Paper";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import confetti from "canvas-confetti";
import { postRegistration } from "@/lib/offline-queue";
import OfflineSaved from "@/components/form/OfflineSaved";
import VipScheduler from "@/components/VipScheduler";

type Props = {
  eventId: number;
  eventName: string;
  initialVipCode?: string;
  route?: string;
};

type SavedDeviceRegistration = {
  id: number;
  participantId: number;
  name: string;
  email: string;
  hasScheduledMeeting: boolean;
  declinedMeeting?: boolean;
  hasDrawn?: boolean;
  drawnPrize?: string | null;
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
  let numbers = onlyNumbers(value);
  if (numbers.startsWith("55") && numbers.length > 11) {
    numbers = numbers.substring(2);
  }
  numbers = numbers.slice(0, 11);
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
  if (existing && existing.length >= 8 && existing.length <= 180) return existing;

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `FINORA-${crypto.randomUUID()}`
      : `FINORA-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem("finora-clinicorp-device-id", generated);
  return generated;
}

function getStorageKey(eventId: number) {
  return `finora-device-registration-v2-${eventId}`;
}

export default function ClinicorpRegistrationForm(props: Props) {
  const [round, setRound] = useState(0);

  return (
    <RegistrationForm
      key={round}
      {...props}
      onReset={() => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(getStorageKey(props.eventId));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        setRound((r) => r + 1);
      }}
    />
  );
}

function RegistrationForm({
  onReset,
  eventId,
  route = "invictus",
}: Props & {
  onReset: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [fullName, setFullName] = useState("");
  const [isForeigner, setIsForeigner] = useState(false);
  const [countryCode, setCountryCode] = useState("+351");
  const [foreignDoc, setForeignDoc] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [acceptMarketing, setAcceptMarketing] = useState(true);

  const [loading, setLoading] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ceoModalOpen, setCeoModalOpen] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [registeredParticipation, setRegisteredParticipation] = useState<SavedDeviceRegistration | null>(null);

  // Rola sempre para o topo ao abrir modais ou concluir o cadastro para nunca ficar lá embaixo no celular
  function scrollToTop() {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }

  function saveDeviceRegistration(data: SavedDeviceRegistration) {
    setRegisteredParticipation(data);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(getStorageKey(eventId), JSON.stringify(data));
      } catch {}
    }
  }

  // Ao abrir no dispositivo, verifica se já houve cadastro feito neste aparelho
  useEffect(() => {
    setMounted(true);
    setDeviceId(createDeviceId());

    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getStorageKey(eventId));
      if (!raw) return;
      const saved: SavedDeviceRegistration = JSON.parse(raw);
      if (saved && saved.id && saved.participantId) {
        setRegisteredParticipation(saved);
        if (saved.email) setEmail(saved.email);

        // Consulta o status atualizado na API (caso tenha agendado reunião em outra aba/QR)
        fetch(`${getApiBaseUrl()}/participants/${saved.id}/public`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((live) => {
            if (!live) return;
            const updated: SavedDeviceRegistration = {
              ...saved,
              name: live.participant?.fullName || saved.name,
              hasScheduledMeeting: Boolean(live.hasScheduledMeeting || saved.hasScheduledMeeting),
              hasDrawn: Boolean(live.draw || saved.hasDrawn),
              drawnPrize: live.draw?.prizes?.name || saved.drawnPrize || null,
            };
            saveDeviceRegistration(updated);
          })
          .catch(() => {});
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Trava o scroll do fundo quando qualquer modal estiver aberto no celular
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (ceoModalOpen || schedulerModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [ceoModalOpen, schedulerModalOpen]);

  function handleMeetingBooked() {
    if (!registeredParticipation) return;
    setCeoModalOpen(false);
    setSchedulerModalOpen(false);
    scrollToTop();
    confetti({
      particleCount: 110,
      spread: 85,
      origin: { y: 0.5 },
      colors: ["#FFD700", "#FF9900", "#FFF9B8", "#FFFFFF"],
      disableForReducedMotion: true,
    });
    saveDeviceRegistration({
      ...registeredParticipation,
      hasScheduledMeeting: true,
      declinedMeeting: false,
    });
  }

  function handleDeclineMeeting() {
    if (!registeredParticipation) return;
    setCeoModalOpen(false);
    setSchedulerModalOpen(false);
    scrollToTop();
    saveDeviceRegistration({
      ...registeredParticipation,
      declinedMeeting: true,
    });
  }

  const isCpfValid = validateCpfAlgorithmic(cpf);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const cleanCpf = onlyNumbers(cpf);
    const cleanPhone = onlyNumbers(phone);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Por favor, digite seu nome completo.");
      return;
    }

    if (!isForeigner) {
      if (cleanCpf.length !== 11 || !isCpfValid) {
        setError("Por favor, digite um CPF válido com 11 dígitos.");
        return;
      }

      if (cleanPhone.length < 10) {
        setError("Por favor, informe um WhatsApp válido com DDD.");
        return;
      }
    } else {
      const doc = foreignDoc.trim();
      if (!doc || doc.length < 2) {
        setError("Por favor, informe seu passaporte ou documento de identificação.");
        return;
      }

      if (cleanPhone.length < 7) {
        setError("Por favor, informe um telefone/WhatsApp internacional válido.");
        return;
      }
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Por favor, informe um e-mail válido.");
      return;
    }

    if (!acceptTerms) {
      setError("É necessário aceitar os termos para participar.");
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
        deviceId: deviceId || createDeviceId(),
        marketingConsent: acceptMarketing,
        privacyConsent: acceptTerms,
      });

      if (res === "queued") {
        setOfflineSaved(fullName.trim());
        scrollToTop();
        return;
      }

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.message || "Erro ao processar cadastro.");
      }

      const participation = result.participation || result;

      if (
        participation.status === "APPROVED" ||
        participation.status === "PENDING" ||
        result.alreadyRegistered
      ) {
        const partId =
          result.participant?.id ||
          participation.participantId ||
          participation.participant_id ||
          participation.id;

        // Consulta rápida para saber se este participante já tinha reunião agendada
        let alreadyHasMeeting = false;
        try {
          const pubRes = await fetch(`${getApiBaseUrl()}/participants/${participation.id}/public`, {
            cache: "no-store",
          });
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            alreadyHasMeeting = Boolean(pubData.hasScheduledMeeting);
          }
        } catch {}

        const savedData: SavedDeviceRegistration = {
          id: participation.id,
          participantId: partId,
          name: fullName.trim() || result.participant?.fullName || "Participante",
          email: email.trim(),
          hasScheduledMeeting: alreadyHasMeeting,
          declinedMeeting: false,
          hasDrawn: Boolean(result.participation?.hasDrawn),
          drawnPrize: result.participation?.drawnPrize || null,
        };

        scrollToTop();

        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.5 },
          colors: ["#22C3DC", "#FFD700", "#0077FF", "#4ADE80", "#FFFFFF"],
          disableForReducedMotion: true,
        });

        saveDeviceRegistration(savedData);

        // Se ainda não agendou reunião, abre o popup centralizado perguntando se deseja agendar!
        if (!alreadyHasMeeting) {
          setCeoModalOpen(true);
        }
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
            "Esta participação atingiu o limite para este CPF/evento. Procure nossa equipe no estande.",
        );
        return;
      }

      setError(result?.blockedReason || "Não foi possível concluir o cadastro neste momento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao realizar o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  if (offlineSaved) return <OfflineSaved name={offlineSaved} onNew={onReset} />;

  // ============================================================================
  // TELA DE PÓS-CADASTRO / DISPOSITIVO JÁ CADASTRADO
  // ============================================================================
  if (registeredParticipation) {
    const safeName = String(registeredParticipation.name || "Participante").trim();
    const nameParts = safeName.split(/\s+/);
    const firstName =
      nameParts[0]?.toLowerCase().startsWith("dr") && nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[1]}`
        : nameParts[0] || "Participante";

    const hasMeeting = Boolean(registeredParticipation.hasScheduledMeeting);
    const showThankYouOnly = hasMeeting || Boolean(registeredParticipation.declinedMeeting);

    return (
      <div className="flex flex-1 flex-col justify-between px-4 sm:px-6 pt-6 pb-8 overscroll-y-contain animate-fade-in">
        <div className="flex flex-col gap-4">
          {hasMeeting ? (
            // CASO 1: Já cadastrou E já marcou a agenda -> Agradecimento completo!
            <div className="flex flex-col gap-4 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900/95 to-slate-950 p-5 sm:p-6 text-white shadow-2xl">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider text-emerald-400 block">
                    CADASTRO & REUNIÃO CONFIRMADOS
                  </span>
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                    Muito obrigado, {firstName}!
                  </h1>
                </div>
              </div>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                Seu cadastro e sua <strong>reunião estratégica</strong> já estão registrados com sucesso!
              </p>

              <div className="rounded-2xl border-2 border-[#FFD700]/70 bg-gradient-to-r from-[#FFD700]/20 via-[#FF9900]/15 to-[#FFD700]/20 p-4 space-y-1.5 shadow-[0_0_25px_rgba(255,215,0,0.2)]">
                <div className="flex items-center gap-2 text-[#FFD700] font-black text-sm uppercase tracking-wider">
                  <Crown size={18} className="text-[#FFD700]" />
                  <span>Dupla Roleta VIP Liberada no Estande!</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Dirija-se ao balcão da <strong>Finora</strong> e informe seu <strong>Nome ou CPF</strong> para girar a <strong>Roleta de Brindes</strong> e a <strong>Roleta VIP</strong>!
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3 text-xs sm:text-sm text-slate-300">
                <Trophy size={20} className="text-amber-400 flex-none" />
                <span>
                  Sua participação no <strong>Sorteio Geral</strong> também está 100% garantida!
                </span>
              </div>
            </div>
          ) : showThankYouOnly ? (
            // CASO 2: Já cadastrou e optou por não agendar agora -> Agradecimento de cadastro + opção caso mude de ideia
            <div className="flex flex-col gap-4 rounded-3xl border border-accent/40 bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-900 p-5 sm:p-6 text-white shadow-2xl">
              <div className="flex items-center gap-2.5">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-accent/20 border border-accent/40 text-accent">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider text-accent block">
                    INSCRIÇÃO CONFIRMADA
                  </span>
                  <h1 className="font-display text-2xl sm:text-3xl font-black text-white leading-tight">
                    Obrigado pelo cadastro, {firstName}!
                  </h1>
                </div>
              </div>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                Seu giro na roleta de brindes e sua participação no <strong>Sorteio Geral</strong> já estão liberados. Basta informar seu <strong>Nome ou CPF</strong> no balcão da Finora!
              </p>

              {/* Card caso queira agendar a reunião para destravar a Roleta VIP */}
              <div className="rounded-2xl border-2 border-[#FFD700]/70 bg-gradient-to-br from-[#2A1B05] via-[#1B1203] to-[#2A1B05] p-4 text-white shadow-[0_0_25px_rgba(255,215,0,0.2)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
                    <Crown size={14} className="text-[#FFD700]" />
                    <span>QUER LIBERAR A ROLETA VIP?</span>
                  </span>
                  <span className="rounded-full bg-[#FFD700]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#FFE57F]">
                    45 MIN
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Agende agora um bate-papo de <strong>Diagnóstico Empresarial</strong> com nosso sócio e ganhe o prêmio sorteado na <strong>Roleta VIP</strong>!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    scrollToTop();
                    setSchedulerModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-3 px-4 font-display text-xs sm:text-sm font-black text-[#3E2723] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer shadow-md"
                >
                  <CalendarCheck size={17} />
                  <span>Agendar Reunião & Liberar Roleta VIP ➔</span>
                </button>
              </div>
            </div>
          ) : (
            // CASO 3: Já fez o cadastro no dispositivo mas ainda não agendou -> Pergunta diretamente se deseja agendar!
            <div className="flex flex-col gap-4 rounded-3xl border-2 border-[#FFD700] bg-gradient-to-br from-[#1A1204] via-[#090E1C] to-[#1A1204] p-5 sm:p-6 text-white shadow-[0_15px_50px_rgba(255,215,0,0.25)]">
              <div className="flex items-center gap-3">
                <div className="flex h-13 w-13 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] shadow-lg">
                  <Crown size={28} />
                </div>
                <div>
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider text-[#FFD700] block">
                    ✅ CADASTRO JÁ REALIZADO
                  </span>
                  <h1 className="font-display text-xl sm:text-2xl font-black text-white leading-tight">
                    Olá, {firstName}! Deseja agendar uma reunião estratégica?
                  </h1>
                </div>
              </div>

              <div className="rounded-2xl border border-[#FFD700]/60 bg-[#FFD700]/15 p-4 space-y-1.5">
                <p className="font-display text-sm sm:text-base font-black text-[#FFF9B8] leading-snug">
                  🎁 Marcando e participando da reunião de Diagnóstico Empresarial, você ganha o prêmio sorteado da Roleta VIP!
                </p>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Reunião online de <strong>45 minutos</strong> via Microsoft Teams com nossos sócios para diagnóstico financeiro e tributário.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    scrollToTop();
                    setCeoModalOpen(false);
                    setSchedulerModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-4 px-5 font-display text-sm sm:text-base font-black text-[#3E2723] shadow-[0_10px_25px_rgba(255,215,0,0.45)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <CalendarCheck size={19} />
                  <span>Sim, Quero Agendar Minha Reunião 🌟</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeclineMeeting}
                  className="w-full py-2.5 text-center text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Agora não, ver confirmação do meu cadastro ➔
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Opção discreta para cadastrar outra pessoa no mesmo aparelho */}
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>Cadastrar outra pessoa neste aparelho</span>
          </button>
        </div>

        {/* POPUP MODAL 1: Convite de Reunião (renderizado via Portal direto no body para ficar 100% centralizado na tela do celular) */}
        {mounted &&
          ceoModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
              <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl border-2 border-[#FFD700] bg-[#090E1C] p-5 sm:p-7 text-white shadow-[0_25px_80px_rgba(255,215,0,0.5)] animate-pop-burst">
                <button
                  type="button"
                  onClick={handleDeclineMeeting}
                  aria-label="Fechar"
                  className="absolute top-3.5 right-3.5 flex size-8 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer z-10"
                >
                  <X size={18} />
                </button>

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFE57F] via-[#FFD700] to-[#FF9900] shadow-[0_0_25px_rgba(255,215,0,0.6)]">
                  <Crown size={28} className="text-[#3E2723]" />
                </div>

                <div className="text-center mt-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 px-3 py-1 font-mono text-[10.5px] font-black uppercase tracking-wider text-[#FFDF73]">
                    ✨ CADASTRO CONCLUÍDO · ROLETA VIP
                  </span>
                  <h3 className="mt-2 font-display text-xl sm:text-2xl font-black text-white leading-tight">
                    Deseja agendar uma reunião de Diagnóstico Empresarial?
                  </h3>
                </div>

                <div className="my-4 rounded-2xl border-2 border-[#FFD700] bg-gradient-to-r from-[#FFD700]/25 via-[#FF9900]/20 to-[#FFD700]/25 p-3.5 text-center shadow-[0_0_20px_rgba(255,215,0,0.25)]">
                  <p className="font-display text-xs sm:text-sm font-black text-[#FFF9B8] uppercase leading-snug">
                    🎁 Marcando e participando da reunião, você ganha o prêmio sorteado da Roleta VIP!
                  </p>
                  <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                    Bate-papo estratégico de <strong>45 minutos</strong> com nosso sócio para diagnóstico financeiro e tributário.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCeoModalOpen(false);
                      setSchedulerModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] py-3.5 px-5 font-display text-sm sm:text-base font-black text-[#3E2723] shadow-[0_10px_25px_rgba(255,215,0,0.45)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <CalendarCheck size={18} />
                    <span>Sim, Escolher Dia e Horário 🌟</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeclineMeeting}
                    className="w-full py-2 text-center text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Prefiro não agendar agora, concluir cadastro ➔
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* POPUP MODAL 2: Calendário de Agendamento (renderizado via Portal direto no body, sem dia pré-selecionado) */}
        {mounted &&
          schedulerModalOpen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in">
              <div className="relative w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-3xl border-2 border-[#FFD700] bg-[#090E1C] p-3.5 sm:p-5 text-white shadow-[0_25px_80px_rgba(255,215,0,0.5)] animate-pop-burst">
                <button
                  type="button"
                  onClick={() => setSchedulerModalOpen(false)}
                  aria-label="Fechar"
                  className="sticky top-2 float-right flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer z-20"
                >
                  <X size={18} />
                </button>

                <VipScheduler
                  participantId={registeredParticipation.participantId || registeredParticipation.id}
                  eventId={eventId}
                  meetingEmail={registeredParticipation.email || email.trim()}
                  onBooked={handleMeetingBooked}
                />
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  // ============================================================================
  // PASSO 1: FORMULÁRIO DE CADASTRO RÁPIDO, LIMPO E 100% RESPONSIVO PARA CELULAR
  // ============================================================================
  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col overscroll-y-contain">
      <PaperHeading
        eyebrow={
          <>
            <StepBar step={1} total={2} />
            <span className="mt-2 block font-mono text-[11px]">Cadastro Rápido · Leva 30 segundos</span>
          </>
        }
        title="Cadastro · Roleta de Prêmios & Sorteio Geral"
      />

      <div className="flex flex-1 flex-col gap-4 px-4 sm:px-5 pt-1 pb-28 sm:pb-24">
        {error && <Alert>{error}</Alert>}

        {/* Atalho VIP: Já fez o cadastro? Agende com nosso sócio */}
        <Link
          href={`/${route}/agendamento`}
          className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 border-[#FFD700] bg-gradient-to-r from-[#2A1B05] via-[#1B1203] to-[#2A1B05] p-3.5 sm:p-4 text-white shadow-[0_0_25px_rgba(255,215,0,0.22)] hover:border-[#FFE57F] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] shadow-md">
              <CalendarCheck size={20} className="text-[#3E2723]" />
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="font-mono text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5 flex-wrap">
                <span>✦ JÁ FEZ O CADASTRO?</span>
                <span className="rounded-full bg-[#FFD700]/20 px-2 py-0.5 text-[9.5px] text-[#FFE57F]">
                  ROLETA VIP
                </span>
              </span>
              <strong className="text-[13.5px] sm:text-[15px] font-extrabold text-white leading-tight mt-0.5">
                Agende uma reunião aqui com nosso sócio
              </strong>
              <span className="text-[11.5px] text-slate-300 mt-0.5 truncate">
                Libere seu giro na Roleta VIP · Clique para agendar ➔
              </span>
            </div>
          </div>
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 flex-none items-center justify-center rounded-full bg-[#FFD700]/20 text-[#FFD700] group-hover:bg-[#FFD700] group-hover:text-[#3E2723] transition-colors">
            <ArrowRight size={17} />
          </div>
        </Link>

        {/* Banner Compacto & Elegante */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-900/95 via-slate-950 to-amber-950/20 p-3.5 sm:p-4 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-accent border border-accent/30">
              ✦ FINORA EXPERIENCE · INVICTUS ✦
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-300 border border-amber-400/40">
              <Sparkles size={11} /> Roleta & Sorteio Geral
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Preencha seus dados abaixo para liberar seu giro na <strong>Roleta de Prêmios</strong> no estande e concorrer ao <strong>Grande Sorteio Geral</strong>!
          </p>
        </div>

        {/* Nome Completo */}
        <Field
          id="c-nome"
          label="Nome completo *"
          autoComplete="name"
          placeholder="Digite seu nome completo"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        {/* Seletor de Nacionalidade */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300">Nacionalidade / Documento</label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setIsForeigner(false);
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
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
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                isForeigner
                  ? "bg-amber-400 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🌐 Estrangeiro</span>
            </button>
          </div>
        </div>

        {!isForeigner ? (
          <Field
            id="c-cpf"
            label="CPF *"
            inputMode="numeric"
            required
            maxLength={14}
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            error={cpf.length === 14 && !isCpfValid ? "CPF inválido. Confira os 11 dígitos." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-3.5 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Globe size={15} />
              <span>Visitante Internacional</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="c-country" className="text-xs font-semibold text-slate-300">
                País de Origem *
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
                <option value="OUTRO">🌐 Outro País</option>
              </select>
            </div>

            <Field
              id="c-passport"
              label="Passaporte ou Documento (DNI / ID) *"
              required
              maxLength={30}
              placeholder="Número do documento"
              value={foreignDoc}
              onChange={(e) => setForeignDoc(e.target.value.toUpperCase())}
            />
          </div>
        )}

        {/* WhatsApp */}
        <Field
          id="c-wpp"
          label={isForeigner ? "WhatsApp / Telefone Internacional *" : "WhatsApp com DDD *"}
          type="tel"
          inputMode="tel"
          required
          maxLength={isForeigner ? 25 : 15}
          placeholder={isForeigner ? "+351 912 345 678" : "(11) 99999-9999"}
          value={phone}
          onChange={(e) => {
            if (isForeigner) {
              setPhone(e.target.value);
            } else {
              setPhone(formatPhone(e.target.value));
            }
          }}
        />

        {/* E-mail */}
        <Field
          id="c-mail"
          label="E-mail *"
          type="email"
          inputMode="email"
          required
          placeholder="seuemail@exemplo.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Termos */}
        <div className="flex flex-col gap-2.5 pt-1">
          <Check checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}>
            Aceito o regulamento e o uso dos meus dados para participação na roleta e sorteio do evento.
          </Check>
          <Check checked={acceptMarketing} onChange={(e) => setAcceptMarketing(e.target.checked)}>
            Quero receber conteúdos e novidades da Finora.
          </Check>
        </div>
      </div>

      <StickyActions>
        <button
          type="submit"
          disabled={
            loading ||
            (!isForeigner && cpf.length === 14 && !isCpfValid) ||
            (isForeigner && foreignDoc.trim().length < 2)
          }
          className={primaryButton}
        >
          {loading ? (
            <>
              <LoaderCircle size={20} className="animate-spin" /> Concluindo cadastro…
            </>
          ) : (
            "Concluir Cadastro & Liberar Roleta 🎯"
          )}
        </button>
        <span className="text-center text-xs text-slate-400">
          Giro liberado na hora · Informe apenas seu Nome ou CPF no estande
        </span>
      </StickyActions>
    </form>
  );
}
