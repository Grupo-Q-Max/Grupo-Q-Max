"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, CheckCircle2 } from "lucide-react";

export default function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleOffline() {
      setIsOffline(true);
      setShowRestored(false);
    }

    function handleOnline() {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    }

    // Estado inicial
    if (!navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-rose-600 text-white py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-full duration-300">
        <WifiOff size={16} className="animate-pulse" />
        <span>Atenção: Conexão instável ou desconectada no estande. Aguardando sinal Wi-Fi/4G...</span>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 shadow-lg animate-in slide-in-from-top-full duration-300">
        <Wifi size={16} />
        <span>Conexão restabelecida com sucesso!</span>
      </div>
    );
  }

  return null;
}
