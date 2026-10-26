"use client";

import { useState, useEffect } from "react";
import {
  Send,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  MessageSquare,
  Users,
  Smartphone,
  XCircle
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminProxy } from "@/lib/api-client";

type Props = {
  eventId: number;
  eventName: string;
};

type QueueStats = {
  PENDING: number;
  PROCESSING: number;
  SENT: number;
  FAILED: number;
  total: number;
};

type QueueMessage = {
  id: number;
  phone: string;
  status: string;
  attempts: number;
  error_reason: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_SPINTAX_MESSAGE = `{Oieee|Oii|Oi|Olá|Fala}, {nome}! {Aqui quem fala é o|Sou o|Meu nome é} *HUGO, CEO da FINORA*. {👋|😁|🚀|✌️}
{Quero te agradecer|Passando para agradecer|Queria deixar meu agradecimento|Muito obrigado} por ter visitado nosso espaço no *Clinicorp Summit 2026*!
{Sabemos que|Entendemos que|A gente sabe que} {contabilidade, impostos e finanças|a parte financeira e contábil|lidar com impostos e finanças} sempre {são um grande desafio|dão dor de cabeça|são uma parte difícil}, e nós {queremos te ajudar com isso|estamos aqui pra resolver isso|podemos cuidar disso} para você focar no que de verdade importa: a odontologia.
Você {tem|teria|consegue} 30 minutinhos para uma conversa pra {entendermos melhor como podemos transformar|a gente te mostrar como ajudar|nós avaliarmos como alavancar} a sua clínica?
{A propósito|Aliás|Aproveitando o contato}, você sabia que no evento nós brindamos você com {duas cortesias|dois presentes}? {🎁|🎉|✨} É isso mesmo! Pra quem {participou|esteve com a gente|marcou presença} no Clinicorp Summit e fechar conosco este mês, estamos dando um *Diagnóstico de Obrigações Tributárias* e um *Certificado Digital (PF ou PJ)*.
👉 {Para agendar e pegar suas cortesias, é só chamar o comercial|Chama nosso time comercial aqui|Manda uma mensagem pro nosso time agora|Para garantir seus presentes, chama o time} em um desses números:
📱 (11) 91295-7356 (Edvaldo)
📱 (11) 95352-9736 (Vitória)
{Um abraço|Forte abraço|Grande abraço} e te {vejo|espero|encontro} entre os maiores na próxima edição!`;

export default function WhatsappQueueDashboard({ eventId, eventName }: Props) {
  const toast = useToast();
  
  // Dashboard state
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [history, setHistory] = useState<QueueMessage[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Send state
  const [audience, setAudience] = useState("ALL");
  const [message, setMessage] = useState(DEFAULT_SPINTAX_MESSAGE);
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  async function loadDashboard() {
    setLoadingDashboard(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetchAdminProxy(`/whatsapp/queue-stats?eventId=${eventId}`),
        fetchAdminProxy(`/whatsapp/queue-history?eventId=${eventId}&limit=20`),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (historyRes.ok) {
        setHistory(await historyRes.json());
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard de filas:", err);
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // Auto refresh a cada 10 segundos
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, [eventId]);

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Digite uma mensagem para enviar.");
      return;
    }

    setSending(true);
    try {
      const res = await fetchAdminProxy(`/whatsapp/event/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          messageTemplate: message,
        }),
      });

      if (!res.ok) throw new Error("Erro ao disparar mensagens.");

      const data = await res.json();
      toast.success(
        `${data.sentCount || 0} na fila e ${data.skippedCount || 0} pulados.`,
        "Disparo Iniciado!"
      );
      setMessage("");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSending(false);
    }
  }

  async function handleRetry(id: number) {
    const useNewMessage = window.confirm(
      "Deseja usar o texto que está agora na caixa principal 'Mensagem'?\n\n" +
      "[OK] Sim, usar o texto da caixa principal (com suporte a Spintax {A|B}).\n" +
      "[Cancelar] Não, reenviar exatamente o mesmo texto original que falhou."
    );

    setRetryingId(id);
    try {
      const res = await fetchAdminProxy(`/whatsapp/queue/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useNewMessage ? { message } : {}),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || "Erro ao reenfileirar mensagem.");
      }
      toast.success("Mensagem devolvida para a fila com sucesso!", "Reenviando");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao tentar reenviar.");
    } finally {
      setRetryingId(null);
    }
  }

  async function handleRetryAll() {
    if (!window.confirm("Deseja reenviar TODAS as mensagens que falharam para este evento?")) {
      return;
    }
    
    const useNewMessage = window.confirm(
      "Deseja usar o texto que está agora na caixa principal 'Mensagem' para todas elas?\n\n" +
      "[OK] Sim, usar o texto da caixa principal (com Spintax dinâmico para cada um).\n" +
      "[Cancelar] Não, reenviar as mensagens originais."
    );

    setLoadingDashboard(true);
    try {
      const res = await fetchAdminProxy(`/whatsapp/queue/retry-all?eventId=${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useNewMessage ? { message } : {}),
      });
      if (!res.ok) throw new Error("Erro ao reenfileirar todas as mensagens.");
      
      const data = await res.json();
      toast.success(`${data.count || 0} mensagens foram devolvidas para a fila!`, "Sucesso");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido.");
      setLoadingDashboard(false);
    }
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 h-full">
      
      {/* LADO ESQUERDO: DISPARO */}
      <div className="w-full xl:w-1/3 flex flex-col gap-6">
        
        {/* Card de Disparo */}
        <article className="bg-surface border border-line rounded-3xl p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-line">
            <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] flex items-center justify-center border border-[#B9D4F7]">
              <Send size={18} className="text-finora-600" />
            </div>
            <div>
              <h2 className="text-text font-black text-lg">Novo Disparo</h2>
              <p className="text-text-2 text-xs mt-0.5">Dispare mensagens em massa</p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="flex flex-col gap-5 flex-1">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text">Público-alvo</span>
              <select 
                value={audience} 
                onChange={(e) => setAudience(e.target.value)}
                className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600"
              >
                <option value="ALL">Todos os participantes</option>
                <option value="PENDING_SPIN">Quem ainda não girou a roleta</option>
                <option value="CLAIMED">Quem já retirou o prêmio</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 flex-1">
              <span className="text-sm font-semibold text-text flex justify-between">
                Mensagem
                <span className="text-xs text-text-2 font-normal">Use {'{nome}'} e {'{pin}'}</span>
              </span>
              <textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Olá {nome}! Venha girar a roleta no estande e ganhe prêmios!"
                className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 flex-1 resize-none min-h-[150px]"
              />
            </label>

            <button 
              type="submit" 
              disabled={sending}
              className="mt-2 w-full py-3.5 px-4 rounded-full flex items-center justify-center gap-2 font-black transition-all bg-finora-600 hover:bg-finora-700 text-white disabled:bg-[#EEF1F5] disabled:text-text-2 disabled:cursor-not-allowed"
            >
              {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
              {sending ? "Colocando na Fila..." : "Disparar Agora"}
            </button>
          </form>
        </article>

      </div>

      {/* LADO DIREITO: FILA E HISTÓRICO */}
      <div className="w-full xl:w-2/3 flex flex-col gap-6">
        
        {/* KPI Cards (Status da fila) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center gap-2 text-text-2 mb-4 z-10">
              <MessageSquare size={16} />
              <span className="text-xs font-bold uppercase">Total na Fila</span>
            </div>
            <strong className="text-3xl font-black text-text z-10">
              {stats ? stats.total : <LoaderCircle size={18} className="animate-spin text-[#7A8597]" />}
            </strong>
          </div>

          <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFF3DC] blur-3xl rounded-full" />
            <div className="flex items-center gap-2 text-[#8A4B00] mb-4 z-10">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase">Aguardando</span>
            </div>
            <strong className="text-3xl font-black text-[#8A4B00] z-10">
              {stats ? (stats.PENDING + stats.PROCESSING) : <LoaderCircle size={18} className="animate-spin text-[#7A8597]" />}
            </strong>
          </div>

          <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#E6F0FF] blur-3xl rounded-full" />
            <div className="flex items-center gap-2 text-finora-600 mb-4 z-10">
              <CheckCircle2 size={16} />
              <span className="text-xs font-bold uppercase">Enviados</span>
            </div>
            <strong className="text-3xl font-black text-finora-600 z-10">
              {stats ? stats.SENT : <LoaderCircle size={18} className="animate-spin text-[#7A8597]" />}
            </strong>
          </div>

          <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FDE8EC] blur-3xl rounded-full" />
            <div className="flex items-center gap-2 text-[#A3112F] mb-4 z-10">
              <AlertCircle size={16} />
              <span className="text-xs font-bold uppercase">Falhas</span>
            </div>
            <strong className="text-3xl font-black text-[#A3112F] z-10">
              {stats ? stats.FAILED : <LoaderCircle size={18} className="animate-spin text-[#7A8597]" />}
            </strong>
          </div>
        </div>

        {/* Histórico Table */}
        <article className="bg-surface border border-line rounded-3xl flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-line flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF1F5] flex items-center justify-center border border-line-strong">
                <Users size={18} className="text-text-2" />
              </div>
              <div>
                <h2 className="text-text font-black text-lg">Histórico Recente</h2>
                <p className="text-text-2 text-xs mt-0.5">Últimas 20 mensagens da fila</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {stats && stats.FAILED > 0 && (
                <button 
                  onClick={handleRetryAll} 
                  disabled={loadingDashboard} 
                  className="px-3 py-2 rounded-full bg-[#FDE8EC] hover:bg-[#FAD4DC] text-[#A3112F] border border-[#F5C2CD] text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={loadingDashboard ? "animate-spin" : ""} />
                  Reenviar Falhas ({stats.FAILED})
                </button>
              )}
              <button onClick={loadDashboard} disabled={loadingDashboard} className="p-2 rounded-lg hover:bg-[#EEF1F5] text-text-2 transition-colors">
                <RefreshCw size={18} className={loadingDashboard ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-text-2 text-xs uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold">Destinatário</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-center">Tentativas</th>
                  <th className="px-6 py-4 font-semibold text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((msg) => (
                  <tr key={msg.id} className="hover:bg-paper transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-text font-medium">
                        <Smartphone size={14} className="text-text-2" />
                        {msg.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {msg.status === "SENT" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E6F0FF] text-finora-600 text-xs font-bold border border-[#B9D4F7]"><CheckCircle2 size={12}/> Enviado</span>}
                      {msg.status === "PENDING" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFF3DC] text-[#8A4B00] text-xs font-bold border border-[#F2D19B]"><Clock size={12}/> Pendente</span>}
                      {msg.status === "PROCESSING" && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E6F0FF] text-finora-600 text-xs font-bold border border-[#B9D4F7]"><RefreshCw size={12} className="animate-spin"/> Processando</span>}
                      {msg.status === "FAILED" && (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 w-max rounded-md bg-[#FDE8EC] text-[#A3112F] text-xs font-bold border border-[#F5C2CD]"><XCircle size={12}/> Falhou</span>
                          {msg.error_reason && <span className="text-[10px] text-[#A3112F] truncate max-w-[200px]" title={msg.error_reason}>{msg.error_reason}</span>}
                          <button 
                            onClick={() => handleRetry(msg.id)}
                            disabled={retryingId === msg.id}
                            className="mt-1 flex items-center gap-1 text-[10px] bg-[#FDE8EC] hover:bg-[#FAD4DC] text-[#A3112F] px-2 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={10} className={retryingId === msg.id ? "animate-spin" : ""} />
                            {retryingId === msg.id ? "Reenviando..." : "Tentar Novamente"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-text-2 text-xs font-mono bg-paper px-2 py-1 rounded-md border border-line">{msg.attempts}/5</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col">
                        <span className="text-text text-xs font-medium">
                          {new Date(msg.updated_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-text-2 text-[10px]">
                          {new Date(msg.updated_at).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {history.length === 0 && !loadingDashboard && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-text-2">
                      Nenhuma mensagem na fila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
      
    </div>
  );
}
