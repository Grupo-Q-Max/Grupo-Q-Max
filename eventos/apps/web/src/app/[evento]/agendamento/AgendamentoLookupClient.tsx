"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Crown, IdCard, LoaderCircle, Mail, Sparkles, UserCheck, X } from "lucide-react";
import VipScheduler from "@/components/VipScheduler";
import { getApiBaseUrl } from "@/lib/api-client";
import { validateCpfAlgorithmic } from "@/components/clinicorp/ClinicorpRegistrationForm";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

type Props = {
  eventId: number;
  eventSlug: string;
};

type FoundParticipant = {
  participantId: number;
  participationId: number;
  fullName: string;
  phone: string;
  email?: string | null;
  clinicName?: string | null;
  isVip?: boolean;
  hasDrawn?: boolean;
  hasScheduledMeeting?: boolean;
  drawnPrize?: string | null;
};

export default function AgendamentoLookupClient({ eventId, eventSlug }: Props) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Participante encontrado
  const [participant, setParticipant] = useState<FoundParticipant | null>(null);

  // E-mail da reunião (mesmo do cadastro ou outro)
  const [emailOption, setEmailOption] = useState<"same" | "custom">("same");
  const [customEmail, setCustomEmail] = useState("");

  // Fluxo de novo cadastro rápido caso CPF não exista
  const [isNewUser, setIsNewUser] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newClinicName, setNewClinicName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [registering, setRegistering] = useState(false);

  // Controle de avanço para a escolha de horário
  const [readyToSchedule, setReadyToSchedule] = useState(false);

  const cleanCpf = cpf.replace(/\D/g, "");
  const isCpfValid = validateCpfAlgorithmic(cleanCpf);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!isCpfValid) {
      setError("Por favor, digite um CPF válido com 11 dígitos.");
      return;
    }

    setLoading(true);
    setError(null);
    setIsNewUser(false);
    setParticipant(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/participants/lookup-by-cpf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, cpf: cleanCpf }),
      });

      const data = await res.json();
      if (res.ok && data.found) {
        setParticipant(data);
        if (data.email && !data.email.includes("@visitante.")) {
          setEmailOption("same");
        } else {
          setEmailOption("custom");
        }
      } else {
        // CPF não encontrado: abre cadastro rápido
        setIsNewUser(true);
      }
    } catch {
      setError("Não foi possível consultar seu CPF neste momento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNewAndProceed(e: React.FormEvent) {
    e.preventDefault();
    if (!newFullName.trim() || !newPhone.trim() || !newEmail.trim()) {
      setError("Por favor, preencha nome completo, WhatsApp e e-mail.");
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/participants/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          fullName: newFullName.trim(),
          cpf: cleanCpf,
          phone: newPhone.trim(),
          email: newEmail.trim(),
          clinicName: newClinicName.trim() || "Clínica não informada",
          privacyConsent: true,
          marketingConsent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.blockedReason || "Falha ao registrar participação.");
      }

      setParticipant({
        participantId: data.participation?.participant_id || data.participant?.id || data.id,
        participationId: data.participation?.id || data.id,
        fullName: newFullName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim(),
        clinicName: newClinicName.trim(),
        isVip: true,
        hasDrawn: false,
      });

      setReadyToSchedule(true);
    } catch (err: any) {
      setError(err.message || "Erro ao registrar participante.");
    } finally {
      setRegistering(false);
    }
  }

  const effectiveEmail =
    isNewUser
      ? newEmail.trim()
      : emailOption === "same"
      ? (participant?.email && !participant.email.includes("@visitante.") ? participant.email : customEmail.trim())
      : customEmail.trim();

  // Se já está pronto para agendar, renderiza o VipScheduler
  if (readyToSchedule && participant) {
    return (
      <VipScheduler
        eventId={eventId}
        participantId={participant.participantId}
        meetingEmail={effectiveEmail || undefined}
        inviteText="Ao confirmar sua reunião com o CEO Hugo Werninghaus, sua Roleta VIP estará liberada no telão/estande Finora!"
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-6 pb-10">
      {/* Banner Dourado Nobre */}
      <div className="flex flex-col gap-2 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-slate-900/95 via-[#080d1a] to-amber-950/30 p-5.5 text-white shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-mono text-xs font-black tracking-widest text-amber-300 uppercase flex items-center gap-1.5">
            <Crown size={15} className="text-amber-400" /> REUNIÃO COM O CEO · ROLETA VIP
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-400/30">
            Até 11 de Dezembro
          </span>
        </div>

        <h1 className="font-display text-[26px] sm:text-[30px] font-black leading-tight text-white mt-1">
          Bate-papo VIP com Nosso CEO
        </h1>

        <p className="text-[13.5px] leading-relaxed text-slate-300">
          Agende sua consultoria de planejamento tributário e financeiro exclusivo. Ao marcar, você garante sua vaga na{" "}
          <strong className="text-amber-300 font-extrabold">Roleta VIP</strong> do estande Finora!
        </p>

        {/* Aviso de Validade Estendida */}
        <div className="mt-1 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-3 text-xs text-amber-200">
          ⭐ <strong>Validade Estendida:</strong> O prêmio conquistado na <strong>Roleta VIP</strong> (descontos no 1º honorário, diagnósticos e mentorias) <strong>valerá até depois da reunião</strong>!
        </div>
      </div>

      {/* Passo 1: Busca pelo CPF */}
      {!participant && !isNewUser && (
        <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-4.5 animate-pop-burst">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpf" className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <IdCard size={15} className="text-amber-400" />
              <span>Digite seu CPF para Começar</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full rounded-xl border border-amber-400/30 bg-slate-900/80 py-3.5 px-4 font-mono text-lg font-bold text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all"
                autoFocus
              />
            </div>
            {cleanCpf.length === 11 && !isCpfValid && (
              <p className="text-xs font-semibold text-rose-400">CPF inválido. Confira os números digitados.</p>
            )}
            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !isCpfValid}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-base font-black text-[#3E2723] shadow-[0_8px_25px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <LoaderCircle size={20} className="animate-spin text-[#3E2723]" />
                <span>Consultando cadastro…</span>
              </>
            ) : (
              <>
                <span>Buscar Cadastro & Continuar</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Passo 2: Participante Encontrado - Confirmação do E-mail da Reunião */}
      {participant && !readyToSchedule && (
        <div className="mt-6 flex flex-col gap-4 animate-pop-burst">
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4.5 text-slate-200 shadow-md">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <UserCheck size={18} />
              <span>Cadastro Localizado com Sucesso!</span>
            </div>
            <h3 className="font-display text-xl font-black text-white mt-1.5">
              {participant.fullName}
            </h3>
            {participant.clinicName && (
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Clínica: <strong className="text-white">{participant.clinicName}</strong>
              </p>
            )}

            {/* Aviso sobre giro normal já feito vs VIP */}
            {participant.hasDrawn && (
              <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-2.5 text-xs text-amber-200">
                🎯 Você já realizou seu giro normal{participant.drawnPrize ? ` e ganhou: "${participant.drawnPrize}"` : ""}!
                Ao concluir este agendamento, <strong>a sua Roleta VIP estará liberada exclusivamente para você girar no estande</strong>!
              </div>
            )}
          </div>

          {/* Pergunta do E-mail da Reunião */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4.5 flex flex-col gap-3 shadow-md">
            <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Mail size={16} />
              <span>Para qual e-mail enviaremos o convite da reunião?</span>
            </label>

            {participant.email && !participant.email.includes("@visitante.") ? (
              <div className="flex flex-col gap-2.5">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="emailOpt"
                    checked={emailOption === "same"}
                    onChange={() => setEmailOption("same")}
                    className="mt-0.5 size-4 text-amber-400 focus:ring-amber-400"
                  />
                  <div className="flex flex-col text-xs sm:text-sm">
                    <span className="font-bold text-white">Usar o mesmo e-mail do cadastro</span>
                    <span className="text-slate-400 font-mono text-xs">{participant.email}</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="emailOpt"
                    checked={emailOption === "custom"}
                    onChange={() => setEmailOption("custom")}
                    className="mt-0.5 size-4 text-amber-400 focus:ring-amber-400"
                  />
                  <div className="flex flex-col text-xs sm:text-sm flex-1">
                    <span className="font-bold text-white">Enviar para outro e-mail</span>
                    {emailOption === "custom" && (
                      <input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="Digite o outro e-mail aqui"
                        className="mt-2 w-full rounded-lg border border-white/20 bg-black/40 py-2 px-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                        autoFocus
                      />
                    )}
                  </div>
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-400">Informe seu e-mail para receber o link do Teams e o convite de calendário:</span>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="seuemail@clinica.com.br"
                  required
                  className="w-full rounded-xl border border-white/20 bg-slate-950 py-3 px-3.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  autoFocus
                />
              </div>
            )}

            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
          </div>

          <button
            type="button"
            onClick={() => {
              if (emailOption === "custom" && (!customEmail || !customEmail.includes("@"))) {
                setError("Por favor, digite um e-mail válido para a reunião.");
                return;
              }
              setReadyToSchedule(true);
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-base font-black text-[#3E2723] shadow-[0_8px_25px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span>Escolher Data e Horário da Reunião 📅</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Passo Alternativo: Novo Cadastro Rápido caso CPF não exista */}
      {isNewUser && (
        <form onSubmit={handleCreateNewAndProceed} className="mt-6 flex flex-col gap-4 animate-pop-burst">
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-xs text-amber-200">
            ℹ️ Seu CPF não possui cadastro prévio no evento. Preencha seus dados abaixo para registrar sua participação e agendar a reunião:
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase">Nome Completo</label>
            <input
              type="text"
              required
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
              placeholder="Dr. Nome Sobrenome"
              className="w-full rounded-xl border border-white/15 bg-slate-900/80 py-3 px-3.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase">WhatsApp</label>
            <input
              type="tel"
              required
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full rounded-xl border border-white/15 bg-slate-900/80 py-3 px-3.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase">E-mail para a Reunião</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="voce@clinica.com.br"
              className="w-full rounded-xl border border-white/15 bg-slate-900/80 py-3 px-3.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase">Nome da Clínica (opcional)</label>
            <input
              type="text"
              value={newClinicName}
              onChange={(e) => setNewClinicName(e.target.value)}
              placeholder="Clínica Exemplo"
              className="w-full rounded-xl border border-white/15 bg-slate-900/80 py-3 px-3.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={registering}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-base font-black text-[#3E2723] shadow-[0_8px_25px_rgba(255,215,0,0.4)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {registering ? (
              <>
                <LoaderCircle size={20} className="animate-spin text-[#3E2723]" />
                <span>Registrando e abrindo agenda…</span>
              </>
            ) : (
              <>
                <span>Salvar e Escolher Horário da Reunião 📅</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
