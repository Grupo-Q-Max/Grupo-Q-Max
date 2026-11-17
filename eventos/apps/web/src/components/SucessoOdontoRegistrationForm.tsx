"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-client";
import { StepBar } from "@/components/brand/Brand";
import { Alert, Check, Field, PaperHeading, StickyActions, primaryButton } from "@/components/form/Paper";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { postRegistration } from "@/lib/offline-queue";
import OfflineSaved from "@/components/form/OfflineSaved";
import VipScheduler from "./VipScheduler";
import GoldenTicket from "@/components/brand/GoldenTicket";
import { PrivacyConsentText } from "@/components/form/Legal";

type Props = {
  eventId: number;
  eventName: string;
  route: string;
  initialVipCode?: string;
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

// "Novo cadastro" depois de salvar offline: remonta o formulário zerado (sem navegar, a rede pode estar fora).
export default function SucessoOdontoRegistrationForm(props: Props) {
  const [round, setRound] = useState(0);
  return <RegistrationForm key={round} {...props} onReset={() => setRound((r) => r + 1)} />;
}

function RegistrationForm({
  onReset,
  eventId,
  eventName: _eventName,
  route,
  initialVipCode = "",
}: Props & { onReset: () => void }) {
  const router = useRouter();

  const [deviceId, setDeviceId] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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
  const [clinicName, setClinicName] = useState("");
  const [cro, setCro] = useState("");
  const [croState, setCroState] = useState("SP");
  // LGPD: consentimento nunca vem pré-marcado.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredParticipation, setRegisteredParticipation] = useState<{
    id: number;
    participationId: number;
    token: string | null;
    name: string;
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
      setError("É necessário aceitar a Política de Privacidade e o Regulamento para participar.");
      return;
    }

    setLoading(true);

    try {
      const res = await postRegistration({
        eventId,
        fullName: fullName.trim(),
        cpf: cleanCpf,
        phone: cleanPhone,
        email: email.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        croNumber: cro.trim() || undefined,
        croState: croState.trim() || "SP",
        deviceId,
        vipCode: vipCode.trim() || undefined,
        marketingConsent: acceptMarketing,
        privacyConsent: acceptTerms,
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
        setRegisteredParticipation({
          id: result.participant?.id || participation.id,
          participationId: participation.id,
          token: participation.whatsappToken || null,
          name: fullName.trim() || result.participant?.fullName || "Participante",
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

  // Passo 2: confirmação e agendamento VIP
  if (registeredParticipation) {
    const isVip = registeredParticipation.isVip;
    const isAlready = registeredParticipation.alreadyRegistered;
    const hasDrawn = registeredParticipation.hasDrawn;
    const drawnPrize = registeredParticipation.drawnPrize;

    return (
      <div className="flex flex-col gap-6">
        {isAlready && (
          <div className="px-5 pt-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-[15px] text-text">
              <strong className="block text-emerald-600 font-semibold mb-1">
                {hasDrawn ? "CPF já participou deste evento" : "CPF Já Cadastrado"}
              </strong>
              {hasDrawn ? (
                <span>Você já realizou sua tentativa neste evento e foi contemplado com: <strong>{drawnPrize || "Brinde Especial"}</strong>.</span>
              ) : (
                <span>Seu cadastro já foi localizado. Seu acesso ao cofre está 100% liberado!</span>
              )}
            </div>
          </div>
        )}

        {isVip && (
          <div className="px-5 pt-2">
            <GoldenTicket
              code={registeredParticipation.vipCode || `#${String(registeredParticipation.participationId).padStart(4, "0")}`}
              eventName={_eventName}
              eventSlug={route}
              participantName={registeredParticipation.name}
              ticketNumber={registeredParticipation.participationId}
              showPrintButton={false}
              className="my-2"
            />
          </div>
        )}

        {!hasDrawn && registeredParticipation.token ? (
          <VipScheduler
            eventId={eventId}
            token={registeredParticipation.token}
            inviteText="Quem agenda libera uma tentativa no Cofre VIP do estande."
            onBooked={() => router.push(`/${route}/cofre?participation_id=${registeredParticipation.participationId}`)}
            skipHref={`/${route}/cofre?participation_id=${registeredParticipation.participationId}`}
          />
        ) : (
          <div className="px-5 pb-6">
            <button
              type="button"
              onClick={onReset}
              className={primaryButton}
            >
              Fazer Novo Cadastro
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
      <PaperHeading
        eyebrow={<><StepBar step={1} total={2} /><span className="mt-2.5 block">Passo 1 de 2 · leva 1 minuto</span></>}
        title="Seus dados para abrir o cofre"
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
        />
        <Field id="c-mail" label="E-mail (opcional)" type="email" inputMode="email" placeholder="voce@clinica.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />

        <Field
          id="c-vip"
          label="Código do cartão VIP / Mentorado (opcional)"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={16}
          hint="Recebeu um cartão VIP ou é mentorado? Digite o código para liberar prêmios VIP exclusivos."
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
            <span className="text-lg">👑</span>
            <div>
              <p className="font-extrabold text-amber-900">Código VIP Validado!</p>
              <p className="text-[11px] text-amber-800 font-medium">Seu cadastro terá acesso liberado aos Prêmios VIP exclusivos do Cofre.</p>
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

        <div className="flex flex-col gap-3 pt-1">
          <Check required checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}>
            <PrivacyConsentText />
          </Check>
          <Check checked={acceptMarketing} onChange={(e) => setAcceptMarketing(e.target.checked)}>
            Quero receber novidades e ofertas da Finora e do Grupo Q-Max por WhatsApp e e-mail. (opcional, posso cancelar quando quiser)
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
            <><LoaderCircle size={20} className="animate-spin" /> Liberando…</>
          ) : vipStatus === "valid" ? (
            "👑 Liberar Tentativa VIP no Cofre"
          ) : (
            "Liberar Tentativa no Cofre"
          )}
        </button>
        <span className="text-center text-[13px] text-text-2">Acesso liberado imediatamente no estande.</span>
      </StickyActions>
    </form>
  );
}
