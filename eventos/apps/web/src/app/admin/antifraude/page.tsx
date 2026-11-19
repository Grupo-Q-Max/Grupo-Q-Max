import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Mail,
  MonitorSmartphone,
  Network,
  Phone,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import FraudRuleEditControl from "@/components/fraud/FraudRuleEditControl";
import { getEvents, getFraudRules } from "@/lib/api";
import FraudWhitelistControl from "@/components/fraud/FraudWhitelistControl";

type PageProps = {
  searchParams: Promise<{
    event?: string;
  }>;
};

const ruleInfo: Record<string, { label: string; description: string; icon: any }> = {
  CPF: {
    label: "CPF",
    description: "Controla quantas vezes o mesmo CPF pode participar.",
    icon: UserRoundCheck,
  },
  PHONE: {
    label: "Telefone",
    description: "Evita várias participações usando o mesmo telefone.",
    icon: Phone,
  },
  EMAIL: {
    label: "E-mail",
    description: "Controla reutilização do mesmo endereço de e-mail.",
    icon: Mail,
  },
  DEVICE: {
    label: "Dispositivo",
    description: "Identifica várias tentativas feitas pelo mesmo aparelho.",
    icon: MonitorSmartphone,
  },
  IP: {
    label: "Endereço IP",
    description: "Controla volume de participações originadas da mesma rede.",
    icon: Network,
  },
};

function actionLabel(action: string) {
  switch (action) {
    case "BLOCK": return "Bloquear";
    case "REVIEW": return "Analisar";
    case "ALLOW_WITH_ALERT": return "Alerta";
    default: return action;
  }
}

function actionBadgeStyle(action: string) {
  switch (action) {
    case "BLOCK":
      return "text-rose-300 bg-rose-500/15 border-rose-500/30";
    case "REVIEW":
      return "text-amber-300 bg-amber-500/15 border-amber-500/30";
    case "ALLOW_WITH_ALERT":
      return "text-cyan-300 bg-cyan-500/15 border-cyan-500/30";
    default:
      return "text-text-2 bg-paper border-line-strong";
  }
}

export default async function FraudPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await getEvents();

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Nenhum evento cadastrado.");
  }

  const requestedId = Number(params.event);
  const exists = events.some((event: { id: number }) => event.id === requestedId);
  const eventId = exists ? requestedId : events[0].id;
  const selectedEvent = events.find((e: any) => e.id === eventId) || events[0];

  const rules = await getFraudRules(eventId);

  const enabled = rules.filter((rule: any) => rule.enabled).length;
  const blocking = rules.filter((rule: any) => rule.enabled && rule.action === "BLOCK").length;
  const reviewing = rules.filter((rule: any) => rule.enabled && rule.action === "REVIEW").length;
  const alerting = rules.filter((rule: any) => rule.enabled && rule.action === "ALLOW_WITH_ALERT").length;

  return (
    <div className="adminShell">
      <AdminSidebar />
      <main className="adminMain adminPaper bg-paper text-text flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 space-y-8">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-line">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-widest mb-3">
                <ShieldCheck size={14} className="text-cyan-400" />
                Segurança & Integridade
              </div>
              <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mb-2 text-text">
                Sistema Antifraude
              </h1>
              <p className="text-text-2 text-sm">
                Proteja o evento <strong className="text-text font-bold">{selectedEvent.name}</strong> contra participações duplicadas e ataques em massa.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <EventSelector events={events} currentEventId={eventId} />
            </div>
          </header>

          {/* Cards de Métricas com Dark Theme Premium */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-line-strong rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm hover:border-emerald-500/40 transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Regras Ativas
                </span>
                <strong className="text-xl sm:text-2xl font-black text-text block">
                  {enabled} <span className="text-sm font-medium text-text-2">/ {rules.length}</span>
                </strong>
              </div>
            </div>

            <div className="bg-surface border border-line-strong rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm hover:border-rose-500/40 transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Ban size={22} />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Bloqueiam
                </span>
                <strong className="text-xl sm:text-2xl font-black text-text block">
                  {blocking}
                </strong>
              </div>
            </div>

            <div className="bg-surface border border-line-strong rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm hover:border-amber-500/40 transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Em Análise
                </span>
                <strong className="text-xl sm:text-2xl font-black text-text block">
                  {reviewing}
                </strong>
              </div>
            </div>

            <div className="bg-surface border border-line-strong rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold text-text-2 uppercase tracking-wider block mb-1">
                  Com Alerta
                </span>
                <strong className="text-xl sm:text-2xl font-black text-text block">
                  {alerting}
                </strong>
              </div>
            </div>
          </div>

          {/* Grid de Regras Antifraude */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rules.map((rule: any) => {
              const info = ruleInfo[rule.type] || {
                label: rule.type,
                description: "Regra antifraude personalizada.",
                icon: ShieldCheck,
              };
              const Icon = info.icon;

              return (
                <article
                  key={rule.id}
                  className={`bg-surface border rounded-2xl p-5 sm:p-6 transition-all group flex flex-col justify-between ${
                    rule.enabled 
                      ? "border-line-strong hover:border-cyan-500/40 shadow-sm" 
                      : "border-line opacity-60 grayscale-[40%]"
                  }`}
                >
                  <div>
                    <header className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          rule.enabled
                            ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            : "bg-paper text-text-2 border border-line"
                        }`}>
                          <Icon size={24} strokeWidth={2} />
                        </div>
                        <div>
                          <strong className="text-lg font-black text-text block">
                            {info.label}
                          </strong>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border inline-block mt-0.5 ${
                            rule.enabled
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-paper text-text-2 border-line"
                          }`}>
                            {rule.enabled ? "Regra Ativa" : "Desativada"}
                          </span>
                        </div>
                      </div>
                    </header>

                    <p className="text-sm text-text-2 mb-6 min-h-[40px]">
                      {info.description}
                    </p>
                  </div>

                  <div>
                    <div className="grid grid-cols-2 divide-x divide-line-strong mb-5 bg-paper p-3.5 rounded-xl border border-line-strong">
                      <div className="text-center px-3">
                        <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                          Limite
                        </span>
                        <strong className={`text-lg font-black ${rule.enabled ? "text-text" : "text-text-2"}`}>
                          {rule.max_allowed} <span className="text-[10px] text-text-2 font-bold uppercase">vezes</span>
                        </strong>
                      </div>

                      <div className="text-center px-3">
                        <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                          Ação
                        </span>
                        <strong className={`text-xs font-black uppercase px-2.5 py-1 rounded-md border inline-block ${
                          rule.enabled ? actionBadgeStyle(rule.action) : "text-text-2 bg-paper border-line"
                        }`}>
                          {actionLabel(rule.action)}
                        </strong>
                      </div>
                    </div>

                    <footer className="pt-3 border-t border-line flex justify-end">
                      <FraudRuleEditControl rule={rule} />
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>

          <FraudWhitelistControl eventId={eventId} />

          {/* Dica / Configuração Recomendada com Design Dark Glass */}
          <div className="bg-gradient-to-r from-cyan-950/20 via-surface to-surface border border-cyan-500/30 rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-cyan-400">
              <ShieldCheck size={160} />
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div className="relative z-10">
              <strong className="text-lg font-black text-text block mb-2">
                Configuração Recomendada
              </strong>
              <p className="text-text-2 text-sm leading-relaxed max-w-3xl">
                Para o Finora Experience, <strong className="text-cyan-400 font-bold">CPF</strong>, <strong className="text-cyan-400 font-bold">telefone</strong> e <strong className="text-cyan-400 font-bold">e-mail</strong> devem ser mais restritivos (ex: Limite de 1). Já o <strong className="text-cyan-400 font-bold">Dispositivo</strong> e <strong className="text-cyan-400 font-bold">IP</strong> toleram múltiplas participações caso os usuários utilizem iPads compartilhados no estande (ex: Limite de 1000).
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
