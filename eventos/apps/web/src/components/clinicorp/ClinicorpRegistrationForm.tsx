"use client";

import { AlertCircle, CalendarCheck, CheckCircle2, LoaderCircle, Users } from "lucide-react";
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
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#22C3DC", "#FFD700", "#0077FF", "#4ADE80", "#FFFFFF"],
          disableForReducedMotion: true,
        });
        setRegisteredParticipation({
          // PIN de retirada = id da participação (o que o balcão busca).
          id: participation.id,
          name: fullName.trim() || result.participant?.fullName || "Participante",
          autoBookedSlot: result.autoBookedSlot || null,
          isVip: Boolean(result.vip || participation.vip || participation.vip_codes || result.participation?.vipCode || (vipStatus === "valid" && !result.error)),
          vipCode: result.participation?.vipCode || participation.vipCode || (vipStatus === "valid" ? vipCode.trim() : undefined),
          alreadyRegistered: Boolean(result.alreadyRegistered),
          hasDrawn: Boolean(result.participation?.hasDrawn),
          drawnPrize: result.participation?.drawnPrize || null,
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

          {!hasDrawn && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-[14px]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>Giro Liberado no Estande</span>
              </div>
              <ol className="flex flex-col gap-2.5 text-text">
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-bold text-accent">1</span>
                  <span>Dirija-se ao estande da Finora.</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-bold text-accent">2</span>
                  <span>Apresente seu código ou nome para o operador.</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent/20 text-xs font-mono font-bold text-accent">3</span>
                  <span>Gire a roleta e retire seu prêmio imediatamente!</span>
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
        title="Seus dados para girar a roleta"
      />

      <div className="flex flex-1 flex-col gap-4.5 px-5 pt-2 pb-6">
        {error && <Alert>{error}</Alert>}

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
        <span className="text-center text-[13px] text-slate-400">Giro liberado imediatamente no estande · Sem fila e sem espera</span>
      </StickyActions>
    </form>
  );
}
