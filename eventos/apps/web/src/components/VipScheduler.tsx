"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, Clock, Crown, LoaderCircle, Sparkles } from "lucide-react";
import { addMinutes, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchApi } from "@/lib/api-client";
import { Alert, StickyActions, primaryButton } from "@/components/form/Paper";

type Props = {
  eventId: number;
  participantId: number;
  // Sem onBooked, mostra confirmação na própria tela.
  onBooked?: () => void;
  skipHref?: string;
  inviteText?: string;
  meetingEmail?: string;
};

export default function VipScheduler({ eventId, participantId, onBooked, skipHref, inviteText, meetingEmail }: Props) {
  // Gera os dias úteis disponíveis até 11 de dezembro de 2026
  const dates = useMemo(() => {
    const list: Date[] = [];
    const now = new Date();
    const current = new Date(now);
    current.setHours(0, 0, 0, 0);

    // Se já passou das 17h, começa a partir do próximo dia
    if (now.getHours() >= 17) {
      current.setDate(current.getDate() + 1);
    }

    // Limite oficial solicitado: até dia 11 de dezembro de 2026
    const limitDate = new Date(2026, 11, 11, 23, 59, 59);

    while (current <= limitDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Pula Sábado e Domingo
        list.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return list;
  }, []);

  const [date, setDate] = useState(dates[0]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlots([]);
    setSlot(null);
    fetchApi<string[]>(`/meetings/event/${eventId}/available-slots?date=${format(date, "yyyy-MM-dd")}`)
      .then((data) => {
        if (cancelled) return;
        const available = Array.isArray(data) ? data : [];
        setSlots(available);
        if (available.length > 0) {
          setSlot(available[0]);
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, eventId]);

  const startTimeFormatted = slot ? format(parseISO(slot), "HH:mm") : "";
  const endTimeFormatted = slot ? format(addMinutes(parseISO(slot), durationMinutes), "HH:mm") : "";

  // Opções de término a partir do horário de início
  const endOptions = useMemo(() => {
    if (!slot) return [];
    return [
      { minutes: 30, label: `${format(addMinutes(parseISO(slot), 30), "HH:mm")} (30 min - Padrão)` },
      { minutes: 45, label: `${format(addMinutes(parseISO(slot), 45), "HH:mm")} (45 min)` },
      { minutes: 60, label: `${format(addMinutes(parseISO(slot), 60), "HH:mm")} (1 hora - Completo)` },
    ];
  }, [slot]);

  async function book() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/meetings/event/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({ participantId, scheduledAt: slot, meetingEmail }),
      });
      if (onBooked) onBooked();
      else setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao agendar. Tente novamente.");
      setSubmitting(false);
    }
  }

  if (done && slot) {
    return (
      <div className="flex flex-1 flex-col items-start gap-4 px-5 pt-8 animate-pop-burst">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
          <CircleCheck size={16} /> Reunião Confirmada com Sucesso!
        </span>
        <h1 className="font-display text-[30px] sm:text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Reunião VIP Agendada com Hugo Werninghaus
        </h1>
        <p className="text-[16px] leading-relaxed text-slate-300">
          📅 <strong>{format(parseISO(slot), "EEEE, dd/MM", { locale: ptBR })}</strong> das{" "}
          <strong className="text-white">{startTimeFormatted} às {endTimeFormatted}</strong> via <strong>Microsoft Teams</strong>.
        </p>

        {/* Destaque da Roleta VIP Liberada */}
        <div className="w-full rounded-2xl border-2 border-[#FFD700] bg-gradient-to-r from-[#FFD700]/20 via-[#FF9900]/15 to-[#FFD700]/20 p-5 shadow-[0_0_25px_rgba(255,215,0,0.3)] space-y-2 mt-2">
          <div className="flex items-center gap-2 text-[#FFD700] font-black text-base uppercase tracking-wider">
            <Crown size={20} className="text-[#FFD700] animate-bounce" />
            <span>Sua Roleta VIP foi liberada no telão!</span>
          </div>
          <p className="text-white text-sm font-semibold">
            Você agora tem acesso à <strong>Roleta 2 (Prêmios VIP)</strong>.
          </p>
          <p className="text-xs text-slate-300">
            Apresente-se ao tablet do balcão ou atualize a tela da roleta para girar a <strong>Roleta VIP 👑</strong> e concorrer aos prêmios executivos!
          </p>
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300 space-y-1.5 mt-2">
          <p className="text-white font-semibold">Detalhes do Convite:</p>
          <p>O convite oficial do Microsoft Teams foi enviado para o seu e-mail e adicionado à agenda do Hugo Werninghaus (CEO Grupo Q-Max).</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-6">
      {/* Cabeçalho */}
      <div className="m-5 flex flex-col gap-2 rounded-2xl border border-white/10 bg-ink-950/90 p-5.5 text-ink-text shadow-xl">
        <span className="font-mono text-xs font-bold tracking-[0.1em] text-accent uppercase flex items-center gap-1.5">
          <Sparkles size={14} className="text-accent" /> CONSULTORIA EXECUTIVA VIP · MICROSOFT TEAMS
        </span>
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Bate-papo VIP com Hugo Werninghaus
        </h1>
        <p className="text-[14px] leading-relaxed text-slate-300">
          {inviteText || "Reunião executiva de diagnóstico financeiro e planejamento tributário para sua clínica. Ao confirmar, você destrava automaticamente a Roleta VIP!"}
        </p>

        {/* Aviso de Validade Estendida do Prêmio VIP */}
        <div className="mt-1 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-3 text-xs text-amber-200">
          ⭐ <strong>Validade Estendida:</strong> O prêmio conquistado na <strong>Roleta VIP</strong> (descontos de 50% ou 100% no 1º honorário, mentorias e diagnósticos) <strong>valerá até depois da realização da sua reunião estratégica</strong>!
        </div>
      </div>

      {/* 1. Seleção de Data */}
      <div className="flex flex-col gap-2.5 px-5 pt-1">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <span>1. Escolha a Data da Reunião</span>
        </span>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {dates.map((d) => {
            const on = format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={on}
                onClick={() => setDate(d)}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer ${
                  on
                    ? "border-2 border-accent bg-accent/20 text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.35)]"
                    : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <strong className="text-[13px] capitalize font-bold">{format(d, "EEE", { locale: ptBR })}</strong>
                <span className="text-[11px] font-mono text-slate-400">{format(d, "dd/MM")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Seleção de Horário Início e Horário Final */}
      <div className="flex flex-col gap-4 px-5 pt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <span className="flex items-center gap-2 py-6 text-slate-400">
            <LoaderCircle size={18} className="animate-spin text-accent" /> Buscando horários disponíveis…
          </span>
        ) : slots.length === 0 ? (
          <span className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center text-slate-400">
            Nenhum horário livre neste dia. Por favor, escolha outro dia acima.
          </span>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Horário de Início */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-accent" />
                <span>2. Selecione o Horário de Início</span>
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
                {slots.map((s) => {
                  const on = s === slot;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSlot(s)}
                      className={`h-11 rounded-xl border text-sm font-mono font-bold transition-all cursor-pointer ${
                        on
                          ? "border-accent bg-accent text-ink-950 shadow-[0_0_12px_rgba(var(--accent-rgb),0.4)]"
                          : "border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      {format(parseISO(s), "HH:mm")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horário Final */}
            {slot && (
              <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-[#FFD700]" />
                  <span>3. Selecione o Horário Final (Término)</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {endOptions.map((opt) => {
                    const on = durationMinutes === opt.minutes;
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDurationMinutes(opt.minutes)}
                        className={`h-12 px-3 rounded-xl border text-xs sm:text-sm font-mono font-bold transition-all cursor-pointer flex items-center justify-center text-center ${
                          on
                            ? "border-[#FFD700] bg-[#FFD700]/25 text-[#FFF9B8] shadow-[0_0_15px_rgba(255,215,0,0.35)]"
                            : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resumo Nobre do Agendamento Selecionado */}
            {slot && (
              <div className="rounded-2xl border-2 border-[#FFD700]/60 bg-gradient-to-r from-[#2B1B04]/80 via-ink-950/90 to-ink-900/90 p-4 shadow-[0_0_20px_rgba(255,215,0,0.2)] flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-black text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
                  <Crown size={14} className="text-[#FFD700]" /> RESUMO DA REUNIÃO SELECIONADA
                </span>
                <span className="text-base font-extrabold text-white capitalize">
                  📅 {format(parseISO(slot), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <div className="flex items-center gap-2 text-sm font-bold text-[#FFE57F]">
                  <span>⏰ Horário:</span>
                  <span className="underline">{startTimeFormatted} às {endTimeFormatted}</span>
                  <span className="text-xs font-mono text-slate-400">({durationMinutes} min)</span>
                </div>
                <span className="text-xs text-slate-300 mt-0.5">
                  💻 Plataforma: <strong>Microsoft Teams</strong> · com <strong>Hugo Werninghaus (CEO)</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-6" />
      <StickyActions>
        {slot && (
          <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300 pb-1">
            <span className="capitalize font-semibold text-white">
              {format(parseISO(slot), "dd/MM")} das {startTimeFormatted} às {endTimeFormatted}
            </span>
            <span className="font-mono text-accent">Teams · CEO Hugo</span>
          </div>
        )}
        <button type="button" onClick={book} disabled={!slot || submitting} className={primaryButton}>
          {submitting ? (
            <>
              <LoaderCircle size={20} className="animate-spin" /> Confirmando agendamento…
            </>
          ) : (
            `Confirmar Reunião das ${startTimeFormatted} às ${endTimeFormatted} 📅`
          )}
        </button>
        {skipHref && (
          <Link href={skipHref} className="py-1 text-center text-sm font-semibold text-slate-400 hover:text-white transition-colors">
            Agora não, quero só girar a roleta
          </Link>
        )}
      </StickyActions>
    </div>
  );
}
