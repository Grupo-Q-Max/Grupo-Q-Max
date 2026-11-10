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
  participantId: number;
  // Sem onBooked, mostra confirmação na própria tela.
  onBooked?: () => void;
  skipHref?: string;
  inviteText?: string;
};

export default function VipScheduler({ eventId, participantId, onBooked, skipHref, inviteText }: Props) {
  const dates = useMemo(() => [0, 1, 2].map((i) => addDays(new Date(), i)), []);
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
        body: JSON.stringify({ participantId, scheduledAt: slot }),
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F7EE] px-3 py-1.5 text-[13px] font-bold text-[#11632F]">
          <CircleCheck size={14} /> Agendado
        </span>
        <h1 className="font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Te esperamos no estande
        </h1>
        <p className="text-[17px] text-slate-300">
          {format(parseISO(slot), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}. Você recebe um lembrete no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="m-5 flex flex-col gap-2.5 rounded-card bg-ink-950 p-5.5 text-ink-text">
        <span className="font-mono text-xs tracking-[0.08em] text-accent">CONVITE VIP</span>
        <h1 className="font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Uma conversa com um especialista Finora
        </h1>
        {inviteText && <p className="text-[15px] leading-[1.45] text-ink-text-2">{inviteText}</p>}
      </div>

      <div className="flex flex-col gap-3 px-5 pt-1">
        <span className="text-[17px] font-bold">Escolha o dia</span>
        <div className="grid grid-cols-3 gap-2">
          {dates.map((d) => {
            const on = format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={on}
                onClick={() => setDate(d)}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-field bg-surface ${
                  on ? "border-2 border-text" : "border-[1.5px] border-line-strong"
                }`}
              >
                <strong className="text-[17px] capitalize">{format(d, "EEE", { locale: ptBR })}</strong>
                <span className="text-[13px] text-text-2">{format(d, "dd/MM")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-6">
        <span className="text-[17px] font-bold">Horário no estande</span>
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <span className="flex items-center gap-2 py-6 text-text-2">
            <LoaderCircle size={18} className="animate-spin" /> Buscando horários…
          </span>
        ) : slots.length === 0 ? (
          <span className="rounded-field border border-line bg-surface p-5 text-center text-text-2">
            Nenhum horário livre neste dia. Escolha outro.
          </span>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const on = s === slot;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSlot(s)}
                  className={`h-13 rounded-xl border-[1.5px] font-mono text-base font-semibold ${
                    on ? "border-text bg-text text-white" : "border-line-strong bg-surface text-text"
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
          <div className="flex justify-between text-[15px]">
            <span className="text-text-2 capitalize">{format(parseISO(slot), "EEE dd/MM · HH:mm", { locale: ptBR })}</span>
            <span className="font-semibold">Lembrete no WhatsApp</span>
          </div>
        )}
        <button type="button" onClick={book} disabled={!slot || submitting} className={primaryButton}>
          {submitting ? <><LoaderCircle size={20} className="animate-spin" /> Confirmando…</> : "Confirmar agendamento"}
        </button>
        {skipHref && (
          <Link href={skipHref} className="py-1 text-center text-sm font-semibold text-finora-600">
            Agora não, quero só girar a roleta
          </Link>
        )}
      </StickyActions>
    </div>
  );
}
