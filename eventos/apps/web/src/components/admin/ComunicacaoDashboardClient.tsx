"use client";

import { useState } from "react";
import WhatsappQueueDashboard from "@/components/admin/WhatsappQueueDashboard";
import WhatsappAutomations from "@/components/admin/WhatsappAutomations";

type Props = {
  eventId: number;
  eventName: string;
};

export default function ComunicacaoDashboardClient({ eventId, eventName }: Props) {
  const [activeTab, setActiveTab] = useState<"FILA" | "AUTOMATIONS">("FILA");

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab("FILA")}
          className={`px-4 py-2 font-bold transition-all border-b-2 ${
            activeTab === "FILA"
              ? "border-finora-600 text-finora-600"
              : "border-transparent text-text-2 hover:text-text"
          }`}
        >
          Fila de Disparos
        </button>
        <button
          onClick={() => setActiveTab("AUTOMATIONS")}
          className={`px-4 py-2 font-bold transition-all border-b-2 ${
            activeTab === "AUTOMATIONS"
              ? "border-finora-600 text-finora-600"
              : "border-transparent text-text-2 hover:text-text"
          }`}
        >
          Automações e Templates
        </button>
      </div>

      {/* Content */}
      <div className="flex-1">
        {activeTab === "FILA" && (
          <WhatsappQueueDashboard eventId={eventId} eventName={eventName} />
        )}
        {activeTab === "AUTOMATIONS" && (
          <WhatsappAutomations eventId={eventId} />
        )}
      </div>
    </div>
  );
}
