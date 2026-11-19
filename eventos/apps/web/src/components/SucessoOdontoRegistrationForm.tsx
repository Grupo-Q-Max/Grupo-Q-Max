"use client";

import { AlertCircle, ArrowRight, CalendarCheck, Globe, LoaderCircle } from "lucide-react";
import Link from "next/link";
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
  const [isForeigner, setIsForeigner] = useState(false);
  const [countryCode, setCountryCode] = useState("+351");
  const [foreignDoc, setForeignDoc] = useState("");
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
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [acceptMarketing, setAcceptMarketing] = useState(true);

  const [loading, setLoading] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredParticipation, setRegisteredParticipation] = useState<{
    id: number;
    participationId: number;
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
        email: email.trim() || undefined,
        clinicName: clinicName.trim() || undefined,
        croNumber: cro.trim() || undefined,
        croState: isForeigner ? undefined : (croState.trim() || "SP"),
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
    const id = registeredParticipation.id;
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

        {/* Confirmação do Grande Sorteio Geral */}
        <div className="px-5">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-amber-950/30 p-4 text-amber-200 shadow-md">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              <span className="text-lg">🏆</span>
              <span>Inscrição Confirmada no Grande Sorteio Geral (19/11)!</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Seu cupom está registrado e concorrendo oficialmente ao <strong>Fotopolimerizador Odontológico</strong> no sorteio geral do dia 19/11 no telão.
            </p>
            <div className="mt-1 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 font-semibold">
              📍 <strong>Dias 20 e 21/11:</strong> Venha ao estande Finora com seu código PIN para girar a Roleta VIP e retirar brindes exclusivos!
            </div>
          </div>
        </div>

        {!hasDrawn ? (
          <VipScheduler
            eventId={eventId}
            participantId={id}
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
        title="Cadastro · Ativação & Grande Sorteio Geral"
      />

      <div className="flex flex-1 flex-col gap-4.5 px-5 pt-2 pb-6">
        {error && <Alert>{error}</Alert>}

        {/* Atalho VIP: Já fez o cadastro? Agende com o sócio */}
        <Link
          href={`/${route}/agendamento`}
          className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border-2 border-[#FFD700] bg-gradient-to-r from-[#2A1B05] via-[#1B1203] to-[#2A1B05] p-4 text-white shadow-[0_0_25px_rgba(255,215,0,0.25)] hover:border-[#FFE57F] hover:shadow-[0_0_35px_rgba(255,215,0,0.4)] transition-all cursor-pointer animate-pulse-glow"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] shadow-md group-hover:scale-105 transition-transform">
              <CalendarCheck size={22} className="text-[#3E2723]" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono text-[11px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5">
                <span>✦ JÁ FEZ O CADASTRO?</span>
                <span className="rounded-full bg-[#FFD700]/20 px-2 py-0.5 text-[10px] text-[#FFE57F]">AGENDAMENTO VIP</span>
              </span>
              <strong className="text-[14px] sm:text-[15px] font-extrabold text-white leading-tight mt-0.5">
                Agende uma reunião aqui com nosso sócio
              </strong>
              <span className="text-xs text-slate-300 mt-0.5">
                Bate-papo VIP com Hugo Werninghaus · Clique para agendar ➔
              </span>
            </div>
          </div>
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FFD700]/20 text-[#FFD700] group-hover:bg-[#FFD700] group-hover:text-[#3E2723] transition-colors">
            <ArrowRight size={18} />
          </div>
        </Link>

        {/* Banner Oficial Finora Experience - Sem imagem pesada, design luxuoso */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-900/95 via-slate-950 to-amber-950/20 p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 font-mono text-[10.5px] font-extrabold uppercase tracking-wider text-accent border border-accent/30">
              ✦ FINORA EXPERIENCE · INVICTUS 2026 ✦
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/40">
              ✨ Ativação VIP & Sorteio Geral
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
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight ${
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
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center leading-tight ${
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
            <><LoaderCircle size={20} className="animate-spin" /> Liberando…</>
          ) : vipStatus === "valid" ? (
            "👑 Liberar Tentativa VIP no Cofre"
          ) : (
            "Liberar Tentativa no Cofre"
          )}
        </button>
        <span className="text-center text-[13px] text-text-2">Acesso liberado no estande · Participação garantida no Grande Sorteio Geral dia 19/11</span>
      </StickyActions>
    </form>
  );
}
