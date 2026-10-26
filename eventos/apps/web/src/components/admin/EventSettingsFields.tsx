"use client";

// Aparência e integrações do evento (criação e edição). Espelha EventSettingsDto da API.
export type EventSettings = {
  accentColor: string;
  accentInkColor: string;
  experience: "ROLETA" | "COFRE";
  alertPhone: string;
  stockAlertPercent: number;
  crmWebhookUrl: string;
};

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  accentColor: "#22C3DC",
  accentInkColor: "#0E7490",
  experience: "ROLETA",
  alertPhone: "",
  stockAlertPercent: 20,
  crmWebhookUrl: "",
};

type ApiEvent = {
  accent_color?: string | null;
  accent_ink_color?: string | null;
  experience?: "ROLETA" | "COFRE";
  alert_phone?: string | null;
  stock_alert_percent?: number;
  crm_webhook_url?: string | null;
};

export function settingsFromApi(event: ApiEvent): EventSettings {
  return {
    accentColor: event.accent_color || DEFAULT_EVENT_SETTINGS.accentColor,
    accentInkColor: event.accent_ink_color || DEFAULT_EVENT_SETTINGS.accentInkColor,
    experience: event.experience || "ROLETA",
    alertPhone: event.alert_phone || "",
    stockAlertPercent: event.stock_alert_percent ?? 20,
    crmWebhookUrl: event.crm_webhook_url || "",
  };
}

// Corpo do PATCH/POST: string vazia vira null para limpar o campo.
export function settingsToApi(s: EventSettings) {
  return {
    accentColor: s.accentColor,
    accentInkColor: s.accentInkColor,
    experience: s.experience,
    alertPhone: s.alertPhone.replace(/\D/g, "") || null,
    stockAlertPercent: s.stockAlertPercent,
    crmWebhookUrl: s.crmWebhookUrl.trim() || null,
  };
}

const label = "text-xs font-bold text-text-2 uppercase tracking-wider block";
const input =
  "w-full bg-surface border border-line rounded-xl px-4 py-3 text-text focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600";

export default function EventSettingsFields({
  value,
  onChange,
  showIntegrations = true,
}: {
  value: EventSettings;
  onChange: (next: EventSettings) => void;
  showIntegrations?: boolean;
}) {
  const set = <K extends keyof EventSettings>(key: K, v: EventSettings[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      <div className="space-y-2">
        <span className={label}>Experiência</span>
        <div className="grid grid-cols-2 gap-2">
          {(["ROLETA", "COFRE"] as const).map((exp) => (
            <button
              key={exp}
              type="button"
              aria-pressed={value.experience === exp}
              onClick={() => set("experience", exp)}
              className={`rounded-xl border px-4 py-3 text-sm font-bold ${value.experience === exp ? "border-finora-600 bg-[#E6F0FF] text-finora-700" : "border-line text-text-2"}`}
            >
              {exp === "ROLETA" ? "Roleta + agendamento" : "Cofre"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2">
          <span className={label}>Cor de destaque</span>
          <input type="color" className="h-12 w-full cursor-pointer rounded-xl border border-line bg-surface p-1" value={value.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
        </label>
        <label className="space-y-2">
          <span className={label}>Cor do texto destaque</span>
          <input type="color" className="h-12 w-full cursor-pointer rounded-xl border border-line bg-surface p-1" value={value.accentInkColor} onChange={(e) => set("accentInkColor", e.target.value)} />
        </label>
      </div>

      {showIntegrations && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <label className="space-y-2">
              <span className={label}>WhatsApp da equipe (alertas)</span>
              <input type="tel" inputMode="numeric" placeholder="5511999999999" className={input} value={value.alertPhone} onChange={(e) => set("alertPhone", e.target.value)} />
            </label>
            <label className="space-y-2">
              <span className={label}>Alerta em</span>
              <div className="relative">
                <input type="number" min={0} max={100} className={`${input} pr-8`} value={value.stockAlertPercent} onChange={(e) => set("stockAlertPercent", Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
                <span className="absolute top-1/2 right-4 -translate-y-1/2 text-text-2">%</span>
              </div>
            </label>
          </div>
          <small className="-mt-3 block text-xs text-text-2">Recebe alerta de estoque abaixo do % e o resumo quando o evento for encerrado.</small>

          <label className="space-y-2 block">
            <span className={label}>Webhook do CRM (opcional)</span>
            <input type="url" placeholder="https://hooks.zapier.com/..." className={`${input} font-mono text-sm`} value={value.crmWebhookUrl} onChange={(e) => set("crmWebhookUrl", e.target.value)} />
            <small className="block text-xs text-text-2">Cada lead é enviado por POST (JSON) logo após o cadastro.</small>
          </label>
        </>
      )}
    </>
  );
}
