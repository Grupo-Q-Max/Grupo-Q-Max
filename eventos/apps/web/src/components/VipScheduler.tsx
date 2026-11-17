"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchApi } from "@/lib/api-client";
import { Alert, StickyActions, primaryButton } from "@/components/form/Paper";

type Props = {
  eventId: number;
  // Token (não sequencial) da participação: a API recusa agendar sem ele.
  token: string;
  // Sem onBooked, mostra confirmação na própria tela.
  onBooked?: () => void;
  skipHref?: string;
  inviteText?: string;
};

export default function VipScheduler({ eventId, token, onBooked, skipHref, inviteText }: Props) {
  // Gera 10 dias úteis pós-evento Invictus (a partir de 23/11/2026)
  const dates = useMemo(() => {
    const list: Date[] = [];
    // Data base: Segunda-feira pós-evento (23 de Novembro de 2026)
    const base = new Date(2026, 10, 23);
    const now = new Date();
    let current = now > base ? new Date(now) : new Date(base);

    while (list.length < 10) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Dias úteis: Segunda a Sexta
        list.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return list;
  }, []);

  const [date, setDate] = useState(dates[0]);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
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
      .then((data) => !cancelled && setSlots(Array.isArray(data) ? data : []))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, eventId]);

  async function book() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/meetings/event/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({ token, scheduledAt: slot }),
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
      <div className="flex flex-1 flex-col items-start gap-4 px-5 pt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
          <CircleCheck size={16} /> Reunião Confirmada
        </span>
        <h1 className="font-display text-[32px] sm:text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Reunião agendada com Hugo Werninghaus
        </h1>
        <p className="text-[16px] leading-relaxed text-slate-300">
          📅 <strong>{format(parseISO(slot), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}</strong> via <strong>Microsoft Teams</strong>.
        </p>
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 space-y-2 mt-2">
          <p className="text-white font-semibold">O que acontece agora?</p>
          <p>O convite oficial foi enviado para o seu e-mail e adicionado à agenda do Hugo Werninghaus (CEO Grupo Q-Max). O link do Microsoft Teams já está reservado no convite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="m-5 flex flex-col gap-2 rounded-card border border-white/10 bg-ink-950/90 p-5.5 text-ink-text shadow-xl">
        <span className="font-mono text-xs font-bold tracking-[0.1em] text-accent uppercase">CONSULTORIA ONLINE · MICROSOFT TEAMS</span>
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Bate-papo VIP com Hugo Werninghaus
        </h1>
        <p className="text-[14px] leading-relaxed text-slate-300">
          {inviteText || "Reunião executiva de 30 minutos pós-evento para análise tributária, diagnóstico financeiro e planejamento de crescimento da sua clínica."}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-1">
        <span className="text-[15px] font-bold text-white uppercase tracking-wider text-xs">Escolha o dia (Pós-Evento Invictus)</span>
        <div className="grid grid-cols-5 gap-2 max-sm:grid-cols-3">
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
                <strong className="text-[14px] capitalize font-bold">{format(d, "EEE", { locale: ptBR })}</strong>
                <span className="text-[12px] font-mono text-slate-400">{format(d, "dd/MM")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-5">
        <span className="text-[15px] font-bold text-white uppercase tracking-wider text-xs">Horário disponível (Brasília)</span>
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
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((s) => {
              const on = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSlot(s)}
                  className={`h-12 rounded-xl border text-sm font-mono font-bold transition-all cursor-pointer ${
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
        )}
      </div>

      <div className="flex-1 min-h-6" />
      <StickyActions>
        {slot && (
          <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300 pb-1">
            <span className="capitalize font-semibold text-white">{format(parseISO(slot), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}</span>
            <span className="font-mono text-accent">30 min · Teams</span>
          </div>
        )}
        <button type="button" onClick={book} disabled={!slot || submitting} className={primaryButton}>
          {submitting ? <><LoaderCircle size={20} className="animate-spin" /> Confirmando agendamento…</> : "Confirmar Reunião no Teams 📅"}
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
