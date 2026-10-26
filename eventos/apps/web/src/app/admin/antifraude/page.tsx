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

function actionColor(action: string) {
  switch (action) {
    case "BLOCK": return "text-[#A3112F] bg-[#FDE8EC] border-[#F5C2CD]";
    case "REVIEW": return "text-[#8A4B00] bg-[#FFF3DC] border-[#F2D19B]";
    case "ALLOW_WITH_ALERT": return "text-finora-600 bg-[#E6F0FF] border-[#B9D4F7]";
    default: return "text-text-2 bg-[#EEF1F5] border-line-strong";
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F0FF] border border-[#B9D4F7] text-finora-600 text-xs font-bold uppercase tracking-widest mb-3">
                <ShieldCheck size={14} />
                Segurança
              </div>
              <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mb-2">
                Sistema Antifraude
              </h1>
              <p className="text-text-2 text-sm">
                Proteja o evento <strong className="text-text">{selectedEvent.name}</strong> contra participações duplicadas e ataques em massa.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <EventSelector events={events} currentEventId={eventId} />
            </div>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#E3F6EA] border border-[#B7E4C7] flex items-center justify-center text-[#0F7A3D] shrink-0">
                <ShieldCheck size={20} />
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

            <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FDE8EC] border border-[#F5C2CD] flex items-center justify-center text-[#A3112F] shrink-0">
                <Ban size={20} />
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

            <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FFF3DC] border border-[#F2D19B] flex items-center justify-center text-[#8A4B00] shrink-0">
                <AlertTriangle size={20} />
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

            <div className="bg-surface border border-line rounded-2xl p-4 sm:p-5 flex items-start gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600 shrink-0">
                <CheckCircle2 size={20} />
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
                  className={`bg-surface border rounded-2xl p-5 sm:p-6 transition-all group ${
                    rule.enabled 
                      ? "border-line hover:border-[#B9D4F7]" 
                      : "border-line opacity-60 grayscale-[50%]"
                  }`}
                >
                  <header className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        rule.enabled ? "bg-[#E6F0FF] text-finora-600 border border-[#B9D4F7]" : "bg-[#EEF1F5] text-text-2 border border-line-strong"
                      }`}>
                        <Icon size={24} strokeWidth={2} />
                      </div>
                      <div>
                        <strong className="text-lg font-black text-text block">
                          {info.label}
                        </strong>
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                          rule.enabled ? "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]" : "bg-[#EEF1F5] text-text-2 border-line-strong"
                        }`}>
                          {rule.enabled ? "Regra Ativa" : "Desativada"}
                        </span>
                      </div>
                    </div>
                  </header>

                  <p className="text-sm text-text-2 mb-6 min-h-[40px]">
                    {info.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-6 bg-paper p-3 rounded-xl border border-line">
                    <div className="text-center px-2">
                      <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                        Limite
                      </span>
                      <strong className={`text-lg font-black ${rule.enabled ? "text-text" : "text-text-2"}`}>
                        {rule.max_allowed} <span className="text-[10px] text-text-2 font-bold uppercase">vezes</span>
                      </strong>
                    </div>
                    
                    <div className="w-px h-full bg-[#EEF1F5] mx-auto hidden sm:block absolute left-1/2 -translate-x-1/2"></div>

                    <div className="text-center px-2 relative sm:border-l border-line">
                      <span className="text-[10px] font-bold text-text-2 uppercase tracking-widest block mb-1">
                        Ação
                      </span>
                      <strong className={`text-xs font-black uppercase px-2 py-1 rounded border ${
                        rule.enabled ? actionColor(rule.action) : "text-text-2 bg-[#EEF1F5] border-line-strong"
                      }`}>
                        {actionLabel(rule.action)}
                      </strong>
                    </div>
                  </div>

                  <footer className="pt-4 border-t border-line flex justify-end">
                    <FraudRuleEditControl rule={rule} />
                  </footer>
                </article>
              );
            })}
          </div>

          <FraudWhitelistControl eventId={eventId} />

          <div className="bg-surface border border-[#B9D4F7] rounded-2xl p-6 flex flex-col sm:flex-row gap-5 items-start relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <ShieldCheck size={160} />
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] flex items-center justify-center text-finora-600 shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div className="relative z-10">
              <strong className="text-lg font-black text-text block mb-2">
                Configuração Recomendada
              </strong>
              <p className="text-text-2 text-sm leading-relaxed max-w-3xl">
                Para o Finora Experience, <strong className="text-finora-600">CPF</strong>, <strong className="text-finora-600">telefone</strong> e <strong className="text-finora-600">e-mail</strong> podem ser mais restritivos (ex: Limite de 1). Já o <strong className="text-finora-600">Dispositivo</strong> e <strong className="text-finora-600">IP</strong> precisam tolerar múltiplas participações caso os usuários utilizem iPads compartilhados no estande (ex: Limite de 1000).
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
