"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Save,
  RotateCcw,
  Smartphone,
  Info,
  ExternalLink,
  Copy,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminProxy } from "@/lib/api-client";

type Props = {
  eventId: number;
  eventName: string;
};

const DEFAULT_REGISTRATION_TEMPLATE = `🔥 *SEJA MUITO BEM-VINDO(A), {nome}!* 👑✨

Seu cadastro no evento *{evento}* foi concluído com sucesso! 🚀

🎟️ *SEU PIN EXCLUSIVO DE ACESSO:*
👉 *{pin}*

📲 *PASSO OBRIGATÓRIO PARA ATIVAR:*
Clique no link abaixo para validar seu WhatsApp e ativar sua participação:
👇
👉 {link_validacao}

🎰 *NO ESTANDE DA FINORA:*
Apresente a tela confirmada para nossa equipe e *GIRE A ROLETA OFICIAL* para ganhar brindes exclusivos na hora! 🎁⚡

🏆 *MEGA SORTEIO GERAL:*
Você já está concorrendo ao Grande Prêmio de Encerramento! 🌟

✨ _Finora Experience • Transformando Eventos em Experiências de Alto Impacto_`;

const DEFAULT_PRIZE_TEMPLATE = `🎈 *UAAAU, {nome}! VOCÊ GANHOU!* 🥳🎉

Que alegria ter você conosco no estande da *Finora Experience* no evento *{evento}*! 💫✨

🎁 *SEU PRÊMIO EXCLUSIVO:*
🏆 *{premio}*

Aproveite muito o seu presente! Foi um prazer enorme receber você no nosso estande! 🎁🔥

✨ _Finora Experience • Transformando Eventos em Experiências_`;

const DEFAULT_RESEND_TEMPLATE = `🎈 *PARABÉNS PELO SEU PRÊMIO, {nome}!* 🥳🎉

Foi um prazer ter você conosco no estande da *Finora* no evento *{evento}*! 💫✨

🎁 *SEU PRÊMIO:*
🏆 *{premio}*

Aproveite muito o seu presente! Obrigado por participar dessa experiência incrível com a gente! 🎁🔥

✨ _Finora Experience • Transformando Eventos em Experiências_`;

const DEFAULT_VIP_TEMPLATE = `{Oieee|Oii|Oi|Olá|Fala} {nome}! {Tudo bem?|Tudo joia?|Como você tá?} {Aqui é da Finora!|Aqui é a equipe da Finora!|Passando pra avisar que} seu *Cofre VIP* foi destravado e sua consultoria {VIP |}está confirmada para {data_hora}! {🎉|🚀|✨|😁}

{Lembre-se de|Não esquece de|A gente te espera lá pra} comparecer no horário para {garantir|resgatar|pegar} seu bônus especial. {Aguardamos você!|Te esperamos!|Um abraço!}`;

const OLD_DEFAULT_TEMPLATE = "Olá! Confirme sua participação no evento [LINK_VALIDACAO] e junte-se a nós: [LINK_CANAL]";

const SPINTAX_TEMPLATES = [
  {
    title: "Agradecimento & Convite (CEO)",
    description: "Ideal para envio em massa pós-evento (Texto do Hugo).",
    content: `{Oieee|Oii|Oi|Olá|Fala}, {nome}! {Aqui quem fala é o|Sou o|Meu nome é} *HUGO, CEO da FINORA*. {👋|😁|🚀|✌️}\n{Quero te agradecer|Passando para agradecer|Queria deixar meu agradecimento|Muito obrigado} por ter visitado nosso espaço no *{evento}*!\n{Sabemos que|Entendemos que|A gente sabe que} {contabilidade, impostos e finanças|a parte financeira e contábil|lidar com impostos e finanças} sempre {são um grande desafio|dão dor de cabeça|são uma parte difícil}, e nós {queremos te ajudar com isso|estamos aqui pra resolver isso|podemos cuidar disso} para você focar no que de verdade importa: a odontologia.\nVocê {tem|teria|consegue} 30 minutinhos para uma conversa pra {entendermos melhor como podemos transformar|a gente te mostrar como ajudar|nós avaliarmos como alavancar} a sua clínica?\n{A propósito|Aliás|Aproveitando o contato}, você sabia que no evento nós brindamos você com {duas cortesias|dois presentes}? {🎁|🎉|✨} É isso mesmo! Pra quem {participou|esteve com a gente|marcou presença} no {evento} e fechar conosco este mês, estamos dando um *Diagnóstico de Obrigações Tributárias* e um *Certificado Digital (PF ou PJ)*.\n👉 {Para agendar e pegar suas cortesias, é só chamar o comercial|Chama nosso time comercial aqui|Manda uma mensagem pro nosso time agora|Para garantir seus presentes, chama o time} em um desses números:\n📱 (11) 91295-7356 (Edvaldo)\n📱 (11) 95352-9736 (Vitória)\n{Um abraço|Forte abraço|Grande abraço} e te {vejo|espero|encontro} entre os maiores na próxima edição!`
  },
  {
    title: "Cadastro no Estande",
    description: "Mensagem imediata ao cadastrar no estande com Spintax forte.",
    content: `🔥 *{SEJA MUITO BEM-VINDO|QUE BOM TER VOCÊ AQUI|BEM-VINDO(A)}*, {nome}! 👑✨\n\n{Seu cadastro|Sua inscrição|Seu registro} no evento *{evento}* foi {concluído|finalizado|confirmado} com sucesso! 🚀\n\n🎟️ *SEU PIN EXCLUSIVO DE ACESSO:*\n👉 *{pin}*\n\n📲 *PASSO OBRIGATÓRIO PARA ATIVAR:*\n{Clique no link abaixo|Acesse o link a seguir|Entre no link abaixo} para {validar|confirmar} seu WhatsApp e ativar sua participação:\n👇\n👉 {link_validacao}\n\n🎰 *NO ESTANDE DA FINORA:*\nApresente a tela confirmada para nossa equipe e *GIRE A ROLETA OFICIAL* para ganhar brindes exclusivos na hora! 🎁⚡\n\n🏆 *MEGA SORTEIO GERAL:*\nVocê já está concorrendo ao Grande Prêmio de Encerramento! 🌟`
  },
  {
    title: "Lembrete de Prêmio Ganho",
    description: "Reenvio manual de prêmio para visitantes.",
    content: `{Opa|Oi|Olá}, {nome}! {Tudo bem?|Como você está?|Beleza?} 👋\n\n{Passando pra avisar|Vim te lembrar|Passando pra te lembrar} que você {ganhou|faturou|tirou} um prêmio incrível na roleta da *Finora* no *{evento}*! 🎁✨\n\n🏆 *SEU PRÊMIO: {premio}*\n\n{Aproveite muito|Curta bastante|Faça bom proveito} do seu presente! {Obrigado por|Foi top ter você} participando dessa experiência incrível com a gente! 🚀🔥`
  },
  {
    title: "Sorteio Final - Última Chamada",
    description: "Aviso de que o grande sorteio vai começar em breve.",
    content: `🚨 *{ATENÇÃO|ALERTA|ÚLTIMA CHAMADA}*, {nome}! 🚨\n\nO {grande sorteio|sorteio final|mega sorteio} do *{evento}* {vai começar em breve|está prestes a começar|começa daqui a pouco}! 🤩\n\n{Corre|Vem correndo|Chega mais} pro nosso estande para acompanhar ao vivo! Quem sabe você não leva o {prêmio principal|grande prêmio|prêmio máximo} pra casa? 🏆🎁\n\nTe {esperamos lá|aguardamos|vejo lá}! 🏃‍♂️💨`
  },
  {
    title: "Agendamento VIP (Cofre)",
    description: "Mensagem para quando um visitante agenda e destrava o cofre.",
    content: `{Oieee|Oii|Oi|Olá|Fala} {nome}! {Tudo bem?|Tudo joia?|Como você tá?} {Aqui é da Finora!|Aqui é a equipe da Finora!|Passando pra avisar que} seu *Cofre VIP* foi destravado e sua consultoria {VIP |}está confirmada para {data_hora}! {🎉|🚀|✨|😁}\n\n{Lembre-se de|Não esquece de|A gente te espera lá pra} comparecer no horário para {garantir|resgatar|pegar} seu bônus especial. {Aguardamos você!|Te esperamos!|Um abraço!}`
  }
];

export default function WhatsappTemplateManager({ eventId, eventName }: Props) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"REGISTRATION" | "PRIZE" | "RESEND" | "VIP">("REGISTRATION");
  
  const [registrationTemplate, setRegistrationTemplate] = useState(DEFAULT_REGISTRATION_TEMPLATE);
  const [prizeTemplate, setPrizeTemplate] = useState(DEFAULT_PRIZE_TEMPLATE);
  const [resendTemplate, setResendTemplate] = useState(DEFAULT_RESEND_TEMPLATE);
  const [vipTemplate, setVipTemplate] = useState(DEFAULT_VIP_TEMPLATE);
  const [channelLink, setChannelLink] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    async function loadEventTemplates() {
      setLoading(true);
      try {
        const res = await fetchAdminProxy(`/events/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.whatsapp_message) {
            const trimmed = data.whatsapp_message.trim();
            if (trimmed && trimmed !== OLD_DEFAULT_TEMPLATE) {
              setRegistrationTemplate(trimmed);
            } else {
              setRegistrationTemplate(DEFAULT_REGISTRATION_TEMPLATE);
            }
          } else {
            setRegistrationTemplate(DEFAULT_REGISTRATION_TEMPLATE);
          }
          if (data.whatsapp_prize_message) {
            setPrizeTemplate(data.whatsapp_prize_message.trim());
          } else {
            setPrizeTemplate(DEFAULT_PRIZE_TEMPLATE);
          }
          if (data.whatsapp_resend_message) {
            setResendTemplate(data.whatsapp_resend_message.trim());
          } else {
            setResendTemplate(DEFAULT_RESEND_TEMPLATE);
          }
          if (data.whatsapp_vip_message) {
            setVipTemplate(data.whatsapp_vip_message.trim());
          } else {
            setVipTemplate(DEFAULT_VIP_TEMPLATE);
          }
          if (data.whatsapp_channel_link) {
            setChannelLink(data.whatsapp_channel_link);
          }
        }
      } catch {
        // Usa valores padrão
      } finally {
        setLoading(false);
      }
    }
    loadEventTemplates();
  }, [eventId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetchAdminProxy(`/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappMessage: registrationTemplate,
          whatsappPrizeMessage: prizeTemplate,
          whatsappResendMessage: resendTemplate,
          whatsappVipMessage: vipTemplate,
          whatsappChannelLink: channelLink.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar modelos de mensagens.");
      }

      toast.success("Modelos de mensagens atualizados com sucesso!", "Mensagens Salvas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.", "Falha ao Salvar");
    } finally {
      setSaving(false);
    }
  }

  function handleResetCurrent() {
    if (activeTab === "REGISTRATION") {
      setRegistrationTemplate(DEFAULT_REGISTRATION_TEMPLATE);
    } else if (activeTab === "PRIZE") {
      setPrizeTemplate(DEFAULT_PRIZE_TEMPLATE);
    } else if (activeTab === "VIP") {
      setVipTemplate(DEFAULT_VIP_TEMPLATE);
    } else {
      setResendTemplate(DEFAULT_RESEND_TEMPLATE);
    }
    toast.info("Modelo restaurado para o padrão recomendado.", "Modelo Restaurado");
  }

  function insertTag(tag: string) {
    if (activeTab === "REGISTRATION") {
      setRegistrationTemplate((prev) => `${prev} ${tag}`);
    } else if (activeTab === "PRIZE") {
      setPrizeTemplate((prev) => `${prev} ${tag}`);
    } else if (activeTab === "VIP") {
      setVipTemplate((prev) => `${prev} ${tag}`);
    } else {
      setResendTemplate((prev) => `${prev} ${tag}`);
    }
  }

  function handleUseTemplate(content: string) {
    if (activeTab === "REGISTRATION") {
      setRegistrationTemplate(content);
    } else if (activeTab === "PRIZE") {
      setPrizeTemplate(content);
    } else if (activeTab === "VIP") {
      setVipTemplate(content);
    } else {
      setResendTemplate(content);
    }
    setShowCatalog(false);
    toast.success("Modelo aplicado com sucesso. Não esqueça de Salvar as Alterações!", "Modelo Aplicado");
  }

  const currentTemplateText =
    activeTab === "REGISTRATION"
      ? registrationTemplate
      : activeTab === "PRIZE"
      ? prizeTemplate
      : activeTab === "VIP"
      ? vipTemplate
      : resendTemplate;

  // Substituição para visualização da prévia ao vivo
  const livePreview = currentTemplateText
    .replace(/\{nome\}|\[NOME\]/g, "Rodrigo")
    .replace(/\{pin\}|\[PIN\]|\{id_participante\}|\[ID_PARTICIPANTE\]/g, "#0042")
    .replace(/\{evento\}|\[EVENTO\]/g, eventName || "Finora Experience")
    .replace(/\{premio\}|\[PREMIO\]/g, "Garrafa Finora")
    .replace(/\{data_hora\}|\[DATA_HORA\]/g, "25/10/2026 14:00")
    .replace(/\{link_validacao\}|\[LINK_VALIDACAO\]/g, "https://grupoqmax.com.br/finora-experience/v/42")
    .replace(/\{link_canal\}|\[LINK_CANAL\]/g, channelLink ? `👉 *Canal VIP:* ${channelLink}` : "");

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-line p-6 rounded-3xl">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E3F6EA] border border-[#B7E4C7] text-[#0F7A3D] text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles size={14} className="text-[#0F7A3D]" />
            <span>CONFIGURAÇÃO DE MENSAGENS AUTOMÁTICAS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-text flex items-center gap-2">
            <MessageSquare size={24} className="text-[#0F7A3D]" />
            <span>Gerenciador de Notificações por WhatsApp</span>
          </h2>
          <p className="text-xs sm:text-sm text-text font-medium mt-1">
            Personalize os textos automáticos enviados aos participantes durante o evento <strong className="text-[#0F7A3D]">{eventName}</strong>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-finora-600 text-white font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer disabled:opacity-50 hover:bg-finora-700"
        >
          {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Salvar Alterações</span>
        </button>
      </div>

      {/* Navegação entre Abas de Mensagens */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("PRIZE")}
          className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
            activeTab === "PRIZE"
              ? "bg-[#E3F6EA] border-[#B7E4C7] text-text"
              : "bg-surface border-line text-text hover:border-line-strong"
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activeTab === "PRIZE" ? "bg-finora-600 text-white" : "bg-[#EEF1F5] text-text"}`}>
            <Gift size={20} />
          </div>
          <div>
            <h4 className="font-black text-sm text-text">1. Giro de Roleta (Prêmio)</h4>
            <p className="text-xs text-text">Enviada ao ganhar na roleta</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REGISTRATION")}
          className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
            activeTab === "REGISTRATION"
              ? "bg-[#E3F6EA] border-[#B7E4C7] text-text"
              : "bg-surface border-line text-text hover:border-line-strong"
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activeTab === "REGISTRATION" ? "bg-finora-600 text-white" : "bg-[#EEF1F5] text-text"}`}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="font-black text-sm text-text">2. Cadastro de Visitante</h4>
            <p className="text-xs text-text">Enviada após se cadastrar no estande</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESEND")}
          className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
            activeTab === "RESEND"
              ? "bg-[#E3F6EA] border-[#B7E4C7] text-text"
              : "bg-surface border-line text-text hover:border-line-strong"
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activeTab === "RESEND" ? "bg-finora-600 text-white" : "bg-[#EEF1F5] text-text"}`}>
            <RotateCcw size={20} />
          </div>
          <div>
            <h4 className="font-black text-sm text-text">3. Lembrete de Prêmio</h4>
            <p className="text-xs text-text">Enviada no reenvio manual</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("VIP")}
          className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
            activeTab === "VIP"
              ? "bg-[#E3F6EA] border-[#B7E4C7] text-text"
              : "bg-surface border-line text-text hover:border-line-strong"
          }`}
        >
          <div className={`p-2.5 rounded-xl ${activeTab === "VIP" ? "bg-finora-600 text-white" : "bg-[#EEF1F5] text-text"}`}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h4 className="font-black text-sm text-text">4. Agendamento VIP</h4>
            <p className="text-xs text-text">Enviada ao agendar consultoria</p>
          </div>
        </button>
      </div>

      {/* Editor Principal e Prévia do Celular */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Esquerdo - Editor do Modelo */}
        <div className="lg:col-span-7 bg-surface border border-line p-6 rounded-3xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-black text-text flex items-center gap-2">
              <span>Modelo da Mensagem</span>
              <span className="text-xs font-mono text-[#0F7A3D] bg-[#E3F6EA] px-2.5 py-0.5 rounded-full border border-[#B7E4C7]">
                {activeTab === "PRIZE" ? "Roleta" : activeTab === "REGISTRATION" ? "Cadastro" : activeTab === "VIP" ? "Cofre VIP" : "Lembrete"}
              </span>
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCatalog(true)}
                className="text-xs px-3 py-1.5 rounded-full bg-[#E3F6EA] text-[#0F7A3D] border border-[#B7E4C7] hover:bg-[#D2EFDC] font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Sparkles size={14} />
                <span>Modelos Prontos</span>
              </button>
              
              <button
                type="button"
                onClick={handleResetCurrent}
                className="text-xs px-3 py-1.5 rounded-full text-text-2 hover:text-text hover:bg-[#EEF1F5] font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Padrão</span>
              </button>
            </div>
          </div>

          {/* Tags Dinâmicas Rápidas */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-text-2 mb-2">
              Clique para Inserir Variáveis Dinâmicas
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => insertTag("{nome}")}
                className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-[#D2EFDC] text-[#0F7A3D] border border-line-strong font-mono text-xs font-bold transition cursor-pointer"
              >
                + &#123;nome&#125;
              </button>
              <button
                type="button"
                onClick={() => insertTag("{evento}")}
                className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-[#D2EFDC] text-[#0F7A3D] border border-line-strong font-mono text-xs font-bold transition cursor-pointer"
              >
                + &#123;evento&#125;
              </button>
              {activeTab !== "REGISTRATION" && (
                <button
                  type="button"
                  onClick={() => insertTag("{premio}")}
                  className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-[#D2EFDC] text-[#0F7A3D] border border-line-strong font-mono text-xs font-bold transition cursor-pointer"
                >
                  + &#123;premio&#125;
                </button>
              )}
              {activeTab === "REGISTRATION" && (
                <button
                  type="button"
                  onClick={() => insertTag("{link_validacao}")}
                  className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-[#D2EFDC] text-[#0F7A3D] border border-line-strong font-mono text-xs font-bold transition cursor-pointer"
                >
                  + &#123;link_validacao&#125;
                </button>
              )}
              {activeTab === "VIP" && (
                <button
                  type="button"
                  onClick={() => insertTag("{data_hora}")}
                  className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-[#D2EFDC] text-[#0F7A3D] border border-line-strong font-mono text-xs font-bold transition cursor-pointer"
                >
                  + &#123;data_hora&#125;
                </button>
              )}
            </div>
          </div>

          {/* Textarea do Modelo */}
          <div>
            <textarea
              rows={10}
              value={
                activeTab === "REGISTRATION"
                  ? registrationTemplate
                  : activeTab === "PRIZE"
                  ? prizeTemplate
                  : activeTab === "VIP"
                  ? vipTemplate
                  : resendTemplate
              }
              onChange={(e) => {
                if (activeTab === "REGISTRATION") {
                  setRegistrationTemplate(e.target.value);
                } else if (activeTab === "PRIZE") {
                  setPrizeTemplate(e.target.value);
                } else if (activeTab === "VIP") {
                  setVipTemplate(e.target.value);
                } else {
                  setResendTemplate(e.target.value);
                }
              }}
              className="w-full rounded-2xl border border-line-strong bg-surface p-4 text-sm !text-text font-mono leading-relaxed placeholder:text-[#8792A3] focus:border-finora-600 focus:outline-none transition"
            />
          </div>

          {/* Configuração do Link do Canal VIP (opcional) */}
          <div className="pt-4 border-t border-line">
            <label className="block text-xs font-bold !text-text mb-1.5">
              Link do Canal ou Grupo do WhatsApp do Evento (Opcional)
            </label>
            <input
              type="text"
              value={channelLink}
              onChange={(e) => setChannelLink(e.target.value)}
              placeholder="Ex: https://chat.whatsapp.com/..."
              className="w-full px-4 py-3 rounded-xl bg-surface border border-line-strong !text-text placeholder:text-[#8792A3] text-sm font-medium focus:outline-none focus:border-finora-600 transition"
            />
            <p className="text-[11px] text-text-2 mt-1 font-medium">
              Se informado, o link do seu grupo/canal será adicionado automaticamente ao final das mensagens.
            </p>
          </div>
        </div>

        {/* Lado Direito - Simulador de WhatsApp em Tempo Real */}
        <div className="lg:col-span-5 bg-surface border border-line p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Smartphone size={20} className="text-[#0F7A3D]" />
              <h3 className="text-base font-black text-text">Visualização em Tempo Real no WhatsApp</h3>
            </div>

            <div className="rounded-[24px] bg-[#0b141a] p-4 border border-line space-y-3">
              {/* Balão de Mensagem Estilo WhatsApp */}
              <div className="rounded-2xl rounded-tl-md bg-[#005c4b] p-4 text-xs sm:text-sm leading-relaxed text-white font-medium whitespace-pre-wrap border border-[#006e5a]">
                {livePreview}
              </div>
              <div className="text-[10px] text-white/60 text-right font-mono pr-2">
                14:30 • Entregue via Z-API
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="p-4 rounded-2xl bg-paper border border-line text-xs text-text space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#0F7A3D]">
                <Info size={16} />
                <span>Dica Anti-Spam (Spintax)</span>
              </div>
              <p className="leading-relaxed">
                Use chaves com opções separadas por barra vertical <strong className="text-text">&#123;Opção1|Opção2&#125;</strong> para variar as palavras. 
                <br/>Exemplo: <strong className="text-text">&#123;Olá|Oi|Opa&#125; &#123;nome&#125;, tudo bem?</strong>
                <br/>Isso garante que cada mensagem seja única, evitando bloqueios do WhatsApp.
              </p>
            </div>
            
            <div className="p-4 rounded-2xl bg-paper border border-line text-xs text-text space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#0F7A3D]">
                <Info size={16} />
                <span>Formatação sem detalhes extras de produto</span>
              </div>
              <p className="leading-relaxed">
                As mensagens automáticas mostram apenas o nome exato do prêmio (ex: <strong className="text-text">Garrafa Finora</strong>) de forma limpa, animada e direta, sem sub-descrições compridas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Catálogo de Ideias */}
      {showCatalog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper backdrop-blur-sm">
          <div className="bg-surface border border-line-strong rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
              <div>
                <h3 className="text-xl font-black text-text flex items-center gap-2">
                  <Sparkles size={20} className="text-[#0F7A3D]" />
                  Modelos de Mensagem (Ideias)
                </h3>
                <p className="text-sm text-text-2 mt-1">Copie modelos prontos de Spintax para evitar bloqueios.</p>
              </div>
              <button 
                onClick={() => setShowCatalog(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#EEF1F5] text-text-2 hover:text-text hover:bg-line-strong transition"
              >
                <AlertCircle size={20} className="rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto pr-2 space-y-4">
              {SPINTAX_TEMPLATES.map((tpl, i) => (
                <div key={i} className="p-5 rounded-2xl border border-line bg-paper hover:border-[#B7E4C7] transition">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-text font-bold text-base">{tpl.title}</h4>
                      <p className="text-[#0F7A3D] text-xs">{tpl.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(tpl.content);
                          toast.success("Modelo copiado para a área de transferência!");
                        }}
                        className="px-3 py-1.5 rounded-full bg-[#EEF1F5] hover:bg-line-strong text-text text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <Copy size={14} />
                        Copiar
                      </button>
                      <button
                        onClick={() => handleUseTemplate(tpl.content)}
                        className="px-3 py-1.5 rounded-full bg-finora-600 text-white hover:bg-finora-700 text-xs font-black flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 size={14} />
                        Usar
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-[#0b141a] rounded-xl border border-line font-mono text-[11px] sm:text-xs text-white whitespace-pre-wrap">
                    {tpl.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
