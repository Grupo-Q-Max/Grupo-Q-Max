"use client";

import { useEffect, useRef, useState } from "react";
import { format, isAfter, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QrCode, Sparkles, Clock, Crown, ArrowRight, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { QRCodeSVG } from "qrcode.react";
import { playAirportChime, announceMeetingCall, unlockAudioContext } from "@/lib/audio";

type AgendaMeeting = {
  id: number;
  scheduled_at: string;
  status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  participants: {
    id: number;
    full_name: string;
    chairs_count: number | null;
  };
};

export default function TvDisplayView({ eventId, route }: { eventId: number; route: string }) {
  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastCalledIdRef = useRef<number | null>(null);

  const fetchAgenda = async () => {
    try {
      const date = new Date().toISOString().split("T")[0];
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/agenda?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error("Erro ao buscar agenda para TV:", err);
    }
  };

  useEffect(() => {
    fetchAgenda();
    
    // Atualiza a cada 30 segundos
    const intervalId = setInterval(fetchAgenda, 30000);
    return () => clearInterval(intervalId);
  }, [eventId]);

  useEffect(() => {
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const pendingMeetings = meetings.filter((m) => m.status === "SCHEDULED");
  
  // Aquele que está no horário agora, ou o próximo imediato
  const currentMeeting = pendingMeetings[0];
  const nextMeetings = pendingMeetings.slice(1, 5); // Os próximos 4

  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    setQrCodeUrl(`${window.location.origin}/finora-experience/${route}/cadastro`);
  }, [route]);

  // Carrega preferência de som salva
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("finora-tv-sound");
      if (saved !== null) setSoundEnabled(saved === "true");
    } catch {}
  }, []);

  // Monitora Fullscreen
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleSound = () => {
    unlockAudioContext();
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("finora-tv-sound", String(next));
      } catch {}
      return next;
    });
  };

  // Atalhos de teclado [F] Fullscreen e [M] Mudo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleSound();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Notificação sonora quando um novo participante é chamado
  useEffect(() => {
    if (!currentMeeting) return;
    if (lastCalledIdRef.current !== currentMeeting.id) {
      if (lastCalledIdRef.current !== null && soundEnabled) {
        playAirportChime();
        const isVip = Boolean(currentMeeting.participants.chairs_count && currentMeeting.participants.chairs_count >= 6);
        setTimeout(() => {
          announceMeetingCall(currentMeeting.participants.full_name, isVip);
        }, 900);
      }
      lastCalledIdRef.current = currentMeeting.id;
    }
  }, [currentMeeting, soundEnabled]);

  return (
    <div className="flex-1 flex bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white overflow-hidden relative">
      
      {/* Background Effects */}
      <div className="cyber-grid-overlay pointer-events-none opacity-30" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-500" />
      <div className="absolute top-1/2 left-1/4 w-[800px] h-[800px] bg-[#0077ff]/15 rounded-full blur-[160px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      
      {/* Esquerda: Em Atendimento & Fila */}
      <div className="w-2/3 flex flex-col p-12 lg:p-20 z-10">
        
        <header className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-4xl font-black text-white shadow-[0_0_35px_rgba(255,255,255,0.1)] backdrop-blur-md">
              F
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-md">Finora Experience</h1>
              <p className="text-xl text-slate-400 mt-2 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#34D399]" />
                <span className="font-semibold text-emerald-400">Em andamento</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={toggleSound}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer ${
                  soundEnabled
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-white/5 text-slate-400 hover:text-white"
                }`}
                title="Atalho: Tecla M"
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundEnabled ? "SOM ATIVO" : "MUDO (M)"}</span>
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-mono text-xs font-bold tracking-wider transition-all cursor-pointer border border-white/10"
                title="Atalho: Tecla F"
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                <span>{isFullscreen ? "SAIR (F)" : "FULLSCREEN (F)"}</span>
              </button>
            </div>

            <div className="text-right ml-4">
              <div className="text-5xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {format(currentTime, "HH:mm:ss")}
              </div>
              <div className="text-lg text-slate-400 font-medium uppercase mt-2 tracking-wider">
                {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </div>
            </div>
          </div>
        </header>

        {/* Quadro de Chamada Principal */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-4">
            <Sparkles size={24} className="text-emerald-400 animate-spin" style={{ animationDuration: '6s' }} />
            Agora / Próximo Chamado
          </h2>

          {currentMeeting ? (
            <div className={`p-10 rounded-4xl border-2 backdrop-blur-xl shadow-2xl relative overflow-hidden transition-all ${
              currentMeeting.participants.chairs_count && currentMeeting.participants.chairs_count >= 6
                ? "bg-gradient-to-br from-amber-950/60 to-slate-900/90 border-amber-500/60 shadow-[0_0_60px_rgba(245,158,11,0.25)] animate-pulse-glow"
                : "bg-gradient-to-br from-slate-900/90 to-indigo-950/40 border-cyan-500/40 shadow-[0_0_50px_rgba(34,195,220,0.15)]"
            }`}>
              
              {currentMeeting.participants.chairs_count && currentMeeting.participants.chairs_count >= 6 && (
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 animate-pulse" />
              )}
              
              <div className="flex items-center gap-8 mb-4">
                <span className="text-7xl font-black font-mono tracking-tighter text-white drop-shadow-md">
                  {format(parseISO(currentMeeting.scheduled_at), "HH:mm", { locale: ptBR })}
                </span>
                {currentMeeting.participants.chairs_count && currentMeeting.participants.chairs_count >= 6 && (
                  <span className="px-5 py-2.5 rounded-2xl bg-amber-500/20 text-amber-300 text-lg font-black uppercase border border-amber-500/40 flex items-center gap-2.5 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <Crown size={22} className="text-amber-300 animate-bounce" /> VIP Ouro
                  </span>
                )}
              </div>
              <strong className="block text-6xl font-black text-white tracking-tight leading-tight mt-6 truncate drop-shadow-lg">
                {currentMeeting.participants.full_name}
              </strong>
            </div>
          ) : (
            <div className="p-10 rounded-4xl bg-slate-900/50 border-2 border-slate-800/60 backdrop-blur-xl flex items-center gap-6">
              <Clock size={48} className="text-slate-600" />
              <strong className="text-4xl font-bold text-slate-500">Nenhum atendimento no momento</strong>
            </div>
          )}

          {/* Próximos na Fila */}
          {nextMeetings.length > 0 && (
            <div className="mt-16">
              <h3 className="text-xl font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-3">
                <ArrowRight size={20} className="text-cyan-400" />
                Fila de Espera
              </h3>
              <div className="grid grid-cols-2 gap-6">
                {nextMeetings.map((m) => (
                  <div key={m.id} className="flex items-center gap-6 p-6 rounded-3xl bg-slate-800/40 border border-slate-700/60 backdrop-blur-md hover:border-slate-600 transition-colors">
                    <span className="text-3xl font-black font-mono text-cyan-400">
                      {format(parseISO(m.scheduled_at), "HH:mm")}
                    </span>
                    <span className="text-2xl font-bold text-white truncate flex-1">
                      {m.participants.full_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Direita: Call to Action (Escassez e QR Code) */}
      <div className="w-1/3 bg-slate-900/90 backdrop-blur-xl border-l border-slate-800 relative flex flex-col justify-center items-center p-12 z-10 shadow-[-20px_0_60px_rgba(0,0,0,0.6)]">
        
        {/* Banner Escassez */}
        <div className="w-full">
          <div className="bg-rose-500/15 border border-rose-500/40 rounded-3xl p-6 text-center shadow-[0_0_30px_rgba(244,63,94,0.15)] animate-pulse">
            <span className="block text-rose-400 text-sm font-black uppercase tracking-widest mb-2">Restam poucas vagas</span>
            <strong className="text-3xl font-black text-white">Agende seu horário VIP agora!</strong>
          </div>
        </div>

        <div className="flex flex-col items-center mt-10">
          <div className="w-[min(364px,40vh)] p-8 bg-white rounded-4xl shadow-[0_0_50px_rgba(0,119,255,0.3)] mb-8 border-4 border-cyan-400/40 animate-pulse-glow">
            <QRCodeSVG 
              value={qrCodeUrl} 
              size={300} 
              level="H"
              includeMargin={false}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          
          <div className="text-center space-y-4">
            <h3 className="text-3xl font-black text-white tracking-tight">Aponte a Câmera</h3>
            <p className="text-xl text-slate-300 font-medium">
              Faça seu cadastro, agende seu bate-papo e gire a roleta oficial!
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
