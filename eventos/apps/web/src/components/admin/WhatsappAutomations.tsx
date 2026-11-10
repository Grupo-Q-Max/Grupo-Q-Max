"use client";

import { useState, useEffect } from "react";
import { Save, LoaderCircle, Info } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminProxy } from "@/lib/api-client";
import ExcelUploader from "./ExcelUploader";

type Props = {
  eventId: number;
};

type AutomationsData = {
  whatsapp_message: string | null;
  whatsapp_prize_message: string | null;
  whatsapp_resend_message: string | null;
  whatsapp_vip_message: string | null;
};

export default function WhatsappAutomations({ eventId }: Props) {
  const toast = useToast();
  const [data, setData] = useState<AutomationsData>({
    whatsapp_message: "",
    whatsapp_prize_message: "",
    whatsapp_resend_message: "",
    whatsapp_vip_message: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetchAdminProxy(`/events/${eventId}`);
        if (res.ok) {
          const event = await res.json();
          setData({
            whatsapp_message: event.whatsapp_message || "",
            whatsapp_prize_message: event.whatsapp_prize_message || "",
            whatsapp_resend_message: event.whatsapp_resend_message || "",
            whatsapp_vip_message: event.whatsapp_vip_message || "",
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [eventId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetchAdminProxy(`/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Falha ao salvar as configurações");
      toast.success("Automações atualizadas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoaderCircle size={32} className="animate-spin text-finora-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      <ExcelUploader eventId={eventId} messageTemplate={data.whatsapp_message || ""} />

      <div className="bg-surface border border-line rounded-3xl p-6 flex flex-col">
        <div className="flex items-start gap-3 mb-6 pb-6 border-b border-line">
          <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] flex items-center justify-center border border-[#B9D4F7] shrink-0">
            <Info size={18} className="text-finora-600" />
          </div>
          <div>
            <h2 className="text-text font-black text-lg">Templates Automáticos</h2>
            <p className="text-text-2 text-xs mt-0.5">
              Configure as mensagens que o sistema enviará automaticamente nos gatilhos. 
              <br/>Variáveis disponíveis: <code className="bg-[#EEF1F5] px-1 py-0.5 rounded text-finora-600">{'{nome}'}</code>, <code className="bg-[#EEF1F5] px-1 py-0.5 rounded text-finora-600">{'{premio}'}</code>. Deixe em branco para desativar a automação correspondente.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-text">Mensagem de Cadastro (Boas-vindas)</span>
            <p className="text-xs text-text-2 mb-1">Enviada logo após o usuário preencher os dados no iPad.</p>
            <textarea
              value={data.whatsapp_message || ""}
              onChange={(e) => setData({ ...data, whatsapp_message: e.target.value })}
              className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 resize-none min-h-[100px]"
              placeholder="Ex: Olá {nome}! Bem-vindo ao estande Invictus!"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-text">Mensagem de Prêmio (Roleta)</span>
            <p className="text-xs text-text-2 mb-1">Enviada após a roleta parar. Use {'{premio}'} para exibir o que ele ganhou.</p>
            <textarea
              value={data.whatsapp_prize_message || ""}
              onChange={(e) => setData({ ...data, whatsapp_prize_message: e.target.value })}
              className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 resize-none min-h-[100px]"
              placeholder="Ex: Parabéns {nome}! Você acabou de ganhar: {premio}!"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-text">Mensagem de VIP (Roleta Agendamento)</span>
            <p className="text-xs text-text-2 mb-1">Enviada após a roleta VIP parar, exclusiva para quem agendou horário.</p>
            <textarea
              value={data.whatsapp_vip_message || ""}
              onChange={(e) => setData({ ...data, whatsapp_vip_message: e.target.value })}
              className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 resize-none min-h-[100px]"
              placeholder="Ex: Como nosso convidado VIP, você faturou: {premio}!"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="mt-4 py-3.5 px-4 rounded-full flex items-center justify-center gap-2 font-black transition-all bg-finora-600 hover:bg-finora-700 text-white disabled:bg-[#EEF1F5] disabled:text-text-2"
          >
            {saving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </form>
      </div>
    </div>
  );
}
