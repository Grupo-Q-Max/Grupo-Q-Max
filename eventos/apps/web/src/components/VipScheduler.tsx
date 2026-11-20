"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, CircleCheck, Clock, Crown, LoaderCircle, Sparkles, UserCheck, Users } from "lucide-react";
import { addMinutes, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchApi } from "@/lib/api-client";
import { Alert, StickyActions, primaryButton } from "@/components/form/Paper";

export type HostOption = {
  key: "hugo" | "ale";
  name: string;
  shortName: string;
  role: string;
  email: string;
  avatar: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
};

export const HOSTS: Record<"hugo" | "ale", HostOption> = {
  hugo: {
    key: "hugo",
    name: "Hugo Werninghaus",
    shortName: "Hugo",
    role: "CEO Grupo Q-Max · Sócio",
    email: "hugo@grupoqmax.com.br",
    avatar: "🤵",
    accentBorder: "border-[#FFD700]",
    accentBg: "bg-[#FFD700]/20",
    accentText: "text-[#FFD700]",
  },
  ale: {
    key: "ale",
    name: "Alessandra (Ale)",
    shortName: "Ale",
    role: "Sócia · Diretoria Grupo Q-Max",
    email: "alessandra@grupoqmax.com.br",
    avatar: "👩‍💼",
    accentBorder: "border-fuchsia-400",
    accentBg: "bg-fuchsia-500/20",
    accentText: "text-fuchsia-300",
  },
};

type Props = {
  eventId: number;
  participantId: number;
  // Sem onBooked, mostra confirmação na própria tela.
  onBooked?: () => void;
  skipHref?: string;
  inviteText?: string;
  meetingEmail?: string;
  initialHost?: "hugo" | "ale";
};

export default function VipScheduler({
  eventId,
  participantId,
  onBooked,
  skipHref,
  inviteText,
  meetingEmail,
  initialHost = "hugo",
}: Props) {
  const [selectedHostKey, setSelectedHostKey] = useState<"hugo" | "ale">(initialHost);
  const currentHost = HOSTS[selectedHostKey];

  // Gera todos os dias disponíveis de 22/11/2026 até 28/02/2027 (incluindo fins de semana)
  const allDates = useMemo(() => {
    const list: Date[] = [];
    // Data inicial obrigatória: a partir de 22/11/2026 (dias 19, 20 e 21 bloqueados)
    const minDate = new Date(2026, 10, 22, 0, 0, 0, 0);
    // Data final obrigatória: até final de Fevereiro de 2027
    const limitDate = new Date(2027, 1, 28, 23, 59, 59);

    const now = new Date();
    const current = new Date(now.getTime() < minDate.getTime() ? minDate : now);
    current.setHours(0, 0, 0, 0);

    // Se já passou das 19h no mesmo dia, avança para o dia seguinte
    if (now >= minDate && now.getHours() >= 19) {
      current.setDate(current.getDate() + 1);
    }

    while (current <= limitDate) {
      // Aberto todos os dias, incluindo sábados e domingos
      list.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    if (list.length === 0) {
      list.push(minDate);
    }

    return list;
  }, []);

  // Meses disponíveis para navegação ágil
  const months = useMemo(() => {
    const mSet = new Map<string, { key: string; label: string; count: number }>();
    for (const d of allDates) {
      const key = format(d, "yyyy-MM");
      if (!mSet.has(key)) {
        const label = format(d, "MMM 'de' yyyy", { locale: ptBR });
        mSet.set(key, { key, label, count: 0 });
      }
      mSet.get(key)!.count += 1;
    }
    return Array.from(mSet.values());
  }, [allDates]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return allDates[0] ? format(allDates[0], "yyyy-MM") : "2026-11";
  });

  const datesForMonth = useMemo(() => {
    return allDates.filter((d) => format(d, "yyyy-MM") === selectedMonth);
  }, [allDates, selectedMonth]);

  // Nenhum dia e nenhum horário vêm pré-selecionados: o usuário escolhe explicitamente!
  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const durationMinutes = 45; // Duração fixa oficial de 45 minutos
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setSlot(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlots([]);
    setSlot(null);

    let dateStr = "";
    try {
      dateStr = format(date, "yyyy-MM-dd");
    } catch {
      dateStr = format(new Date(), "yyyy-MM-dd");
    }

    fetchApi<string[]>(`/meetings/event/${eventId}/available-slots?date=${dateStr}&host=${selectedHostKey}`)
      .then((data) => {
        if (cancelled) return;
        const available = Array.isArray(data) ? data : [];
        setSlots(available);
        // Não pré-seleciona o primeiro horário automaticamente; aguarda o clique do usuário
        setSlot(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, eventId, selectedHostKey]);

  const startTimeFormatted = useMemo(() => {
    if (!slot) return "";
    try {
      return format(parseISO(slot), "HH:mm");
    } catch {
      return "";
    }
  }, [slot]);

  const endTimeFormatted = useMemo(() => {
    if (!slot) return "";
    try {
      return format(addMinutes(parseISO(slot), durationMinutes), "HH:mm");
    } catch {
      return "";
    }
  }, [slot, durationMinutes]);

  async function book() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchApi(`/meetings/event/${eventId}/book`, {
        method: "POST",
        body: JSON.stringify({
          participantId,
          scheduledAt: slot,
          meetingEmail,
          host: selectedHostKey,
        }),
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
          Reunião VIP Agendada com {currentHost.name}
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
          <p>
            O convite oficial do Microsoft Teams foi enviado para o seu e-mail e adicionado à agenda de{" "}
            <strong>{currentHost.name}</strong> ({currentHost.email}).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-6">
      {/* Cabeçalho */}
      <div className="m-5 flex flex-col gap-3 rounded-2xl border border-white/10 bg-ink-950/90 p-5.5 text-ink-text shadow-xl">
        <span className="font-mono text-xs font-bold tracking-[0.1em] text-accent uppercase flex items-center gap-1.5">
          <Sparkles size={14} className="text-accent" /> CONSULTORIA EXECUTIVA VIP · MICROSOFT TEAMS
        </span>
        <h1 className="font-display text-[25px] sm:text-[29px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Bate-papo VIP com {currentHost.name}
        </h1>
        <p className="text-[13.5px] leading-relaxed text-slate-300">
          {inviteText || "Reunião executiva de diagnóstico financeiro e planejamento tributário para sua clínica. Ao confirmar, você destrava automaticamente a Roleta VIP!"}
        </p>

        {selectedHostKey === "ale" && (
          <div className="mt-1 flex items-center justify-between flex-wrap gap-2 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/15 px-3.5 py-2.5 text-xs text-fuchsia-200">
            <div className="flex items-center gap-2">
              <span className="text-base">👩‍💼</span>
              <div>
                <strong className="text-white block">Agenda Extra · Alessandra (Ale)</strong>
                <span>Exibindo os horários extras em que o Hugo já está em reunião e a Ale está livre.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedHostKey("hugo")}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 font-bold text-white transition-colors cursor-pointer"
            >
              ← Voltar para agenda do Hugo
            </button>
          </div>
        )}

        {/* Aviso de Validade Estendida do Prêmio VIP */}
        <div className="mt-0.5 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 p-3 text-xs text-amber-200">
          ⭐ <strong>Validade Estendida:</strong> O prêmio conquistado na <strong>Roleta VIP</strong> (isenção de 100% no 1º honorário, mentorias e diagnósticos) <strong>valerá até depois da realização da sua reunião estratégica</strong>!
        </div>
      </div>

      {/* 1. Seleção de Data */}
      <div className="flex flex-col gap-3 px-5 pt-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-accent" />
            <span>1. Escolha a Data na Agenda de {currentHost.shortName} (Até Final de Fev)</span>
          </span>
          <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Segunda a Domingo · 08h às 19h
          </span>
        </div>

        {/* Abas de Navegação por Mês */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {months.map((m) => {
            const isSelected = selectedMonth === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMonth(m.key);
                  setDate(null);
                  setSlot(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-accent text-ink-950 shadow-sm"
                    : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/10"
                }`}
              >
                {m.label} ({m.count} dias)
              </button>
            );
          })}
        </div>

        {/* Grade de Dias do Mês Selecionado */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-56 overflow-y-auto pr-1">
          {datesForMonth.map((d) => {
            const on = date ? format(d, "yyyy-MM-dd") === format(date, "yyyy-MM-dd") : false;
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={on}
                onClick={() => setDate(d)}
                className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl transition-all cursor-pointer relative ${
                  on
                    ? "border-2 border-accent bg-accent/20 text-white shadow-[0_0_15px_rgba(var(--accent-rgb),0.35)]"
                    : "border border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-1">
                  <strong className="text-[13px] capitalize font-bold">{format(d, "EEE", { locale: ptBR })}</strong>
                  {isWeekend && (
                    <span className="text-[9px] font-extrabold text-amber-400" title="Fim de Semana Liberado">⭐</span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400">{format(d, "dd/MM")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Seleção de Horário Início e Horário Final */}
      <div className="flex flex-col gap-4 px-5 pt-6">
        {error && <Alert>{error}</Alert>}
        {!date ? (
          <div className="rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-5 text-center text-slate-300">
            <p className="text-sm font-bold text-white">👆 Toque em um dia acima para consultar os horários</p>
            <p className="text-xs text-slate-400 mt-1">
              Selecione primeiro a data desejada para carregar os horários disponíveis na agenda.
            </p>
          </div>
        ) : loading ? (
          <span className="flex items-center gap-2 py-6 text-slate-400">
            <LoaderCircle size={18} className="animate-spin text-accent" /> Sincronizando agenda de {currentHost.name} em tempo real…
          </span>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center text-slate-300 space-y-3">
            {selectedHostKey === "hugo" ? (
              <>
                <p className="text-sm font-semibold text-white">
                  Todos os horários do Hugo neste dia já estão ocupados.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedHostKey("ale")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-fuchsia-400 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 px-5 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(232,121,249,0.3)] transition-all cursor-pointer"
                >
                  <span>👩‍💼 Não achou horário? Ver agenda da Ale (Sócia)</span>
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300">
                  Neste dia o Hugo está com todos os horários livres na agenda dele (ou a Ale também está em reunião nos horários ocupados do Hugo).
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedHostKey("hugo")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/20 hover:bg-amber-400/30 px-4 py-2.5 text-xs font-bold text-amber-200 transition-all cursor-pointer"
                >
                  <span>← Voltar e ver os horários livres do Hugo neste dia</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Horário de Início */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={14} className="text-accent" />
                  <span>
                    {selectedHostKey === "hugo"
                      ? `2. Horários Disponíveis com Hugo (${slots.length} livres)`
                      : `2. Horários Extras Disponíveis com a Ale (${slots.length} horários onde o Hugo está ocupado)`}
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentHost.email}
                </span>
              </div>
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

            {/* Botão "Não achou horário?" para abrir a agenda da Ale nos horários em que o Hugo está ocupado */}
            {selectedHostKey === "hugo" ? (
              <div className="rounded-2xl border border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-950/40 via-slate-900/90 to-fuchsia-950/40 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5 text-center sm:text-left">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/40 text-lg">
                    👩‍💼
                  </span>
                  <div className="flex flex-col">
                    <strong className="text-xs sm:text-sm font-extrabold text-white">
                      Não achou horário?
                    </strong>
                    <span className="text-[11.5px] text-slate-300">
                      Veja os horários extras disponíveis na agenda da nossa sócia <strong className="text-fuchsia-300">Alessandra (Ale)</strong>!
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedHostKey("ale")}
                  className="w-full sm:w-auto flex-none rounded-xl border border-fuchsia-400 bg-fuchsia-500/25 hover:bg-fuchsia-500/40 px-4 py-2 text-xs font-black text-white shadow-[0_0_15px_rgba(232,121,249,0.25)] transition-all cursor-pointer whitespace-nowrap"
                >
                  Ver agenda da Ale ➔
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/40 bg-amber-950/20 p-3 flex items-center justify-between gap-3">
                <span className="text-xs text-amber-200">
                   Mostrando apenas os horários em que o Hugo está ocupado e a <strong>Ale</strong> está livre.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedHostKey("hugo")}
                  className="rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  ← Voltar para agenda do Hugo
                </button>
              </div>
            )}

            {/* Resumo Nobre do Agendamento Selecionado */}
            {slot && (
              <div className="rounded-2xl border-2 border-[#FFD700]/60 bg-gradient-to-r from-[#2B1B04]/80 via-ink-950/90 to-ink-900/90 p-4 shadow-[0_0_20px_rgba(255,215,0,0.2)] flex flex-col gap-1.5 animate-pop-burst">
                <span className="font-mono text-[11px] font-black text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5">
                  <Crown size={14} className="text-[#FFD700]" /> RESUMO DA REUNIÃO SELECIONADA
                </span>
                <span className="text-base font-extrabold text-white capitalize">
                  📅 {format(parseISO(slot), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
                <div className="flex items-center gap-2 text-sm font-bold text-[#FFE57F]">
                  <span>⏰ Horário:</span>
                  <span className="underline">{startTimeFormatted} às {endTimeFormatted}</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    45 min (Duração Fixa)
                  </span>
                </div>
                <span className="text-xs text-slate-300 mt-0.5">
                  💻 Plataforma: <strong>Microsoft Teams</strong> · com <strong>{currentHost.name}</strong> ({currentHost.email})
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
            <span className="font-mono text-accent">Teams · {currentHost.shortName}</span>
          </div>
        )}
        <button type="button" onClick={book} disabled={!slot || submitting} className={primaryButton}>
          {submitting ? (
            <>
              <LoaderCircle size={20} className="animate-spin" /> Confirmando agendamento…
            </>
          ) : !date ? (
            "Selecione um Dia Acima para Começar 📅"
          ) : !slot ? (
            `Selecione um Horário do Dia ${format(date, "dd/MM")} ⏰`
          ) : (
            `Agendar Reunião com ${currentHost.shortName} · Dia ${format(parseISO(slot), "dd/MM")} (${startTimeFormatted} às ${endTimeFormatted}) 📅`
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
