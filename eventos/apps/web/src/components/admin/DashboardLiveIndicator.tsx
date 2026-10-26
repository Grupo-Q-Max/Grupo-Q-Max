"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useLiveEvent } from "@/lib/use-live-event";

export default function DashboardLiveIndicator({ eventId }: { eventId: number }) {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function refresh() {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  }

  // Ao vivo: atualiza a cada cadastro/giro (SSE), com polling de segurança de 60s.
  useLiveEvent(live ? eventId : null, refresh);

  return (
    <div className="flex items-center gap-2 text-[13px]">
      <button
        type="button"
        onClick={() => setLive((v) => !v)}
        aria-pressed={live}
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-bold transition-all ${
          live
            ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
            : "border border-amber-500/30 bg-amber-500/15 text-amber-300"
        }`}
      >
        <span
          className={`size-2 rounded-full ${
            live ? "animate-pulse bg-emerald-400 shadow-[0_0_8px_#34D399]" : "bg-amber-400"
          }`}
        />
        {live ? "Ao vivo" : "Pausado"}
      </button>
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        aria-label="Atualizar agora"
        className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <RefreshCw size={14} className={isRefreshing ? "animate-spin text-[#00E5FF]" : ""} />
      </button>
    </div>
  );
}
