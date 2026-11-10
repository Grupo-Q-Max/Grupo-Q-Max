"use client";

import {
  Maximize2,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import { flushQueue, OFFLINE_QUEUE_EVENT, readQueue, REGISTRATION_QUEUE } from "@/lib/offline-queue";


// event: segmento da rota do evento (ex. "clinicorp" ou o slug do banco).
export default function ClinicorpKioskGuard({ event }: { event: string }) {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [online, setOnline] =
    useState(true);

  const [fullscreen, setFullscreen] =
    useState(false);

  const [pending, setPending] =
    useState(0);

  // Cadastros salvos sem internet: envia ao voltar a conexão e a cada 30s.
  useEffect(() => {
    const refresh = () => setPending(readQueue(REGISTRATION_QUEUE).length);
    const sync = () => {
      if (navigator.onLine) flushQueue(REGISTRATION_QUEUE).then(setPending);
    };
    refresh();
    sync();
    const timer = setInterval(sync, 30_000);
    window.addEventListener("online", sync);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    setOnline(
      navigator.onLine,
    );

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    function handleFullscreen() {
      setFullscreen(
        Boolean(
          document.fullscreenElement,
        ),
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F11") {
        event.preventDefault();
        enterFullscreen();
      }
    }

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "offline",
      handleOffline,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    document.addEventListener(
      "fullscreenchange",
      handleFullscreen,
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "offline",
        handleOffline,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      document.removeEventListener(
        "fullscreenchange",
        handleFullscreen,
      );
    };
  }, []);

  useEffect(() => {
    const isStageExperience =
      pathname === `/${event}/roleta` || pathname === `/${event}/cofre`;

    if (!isStageExperience) {
      return;
    }

    window.history.pushState(
      null,
      "",
      window.location.href,
    );

    function preventBack() {
      window.history.pushState(
        null,
        "",
        window.location.href,
      );
    }

    window.addEventListener(
      "popstate",
      preventBack,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        preventBack,
      );
    };
  }, [pathname, event]);

  async function enterFullscreen() {
    try {
      if (
        document.fullscreenElement
      ) {
        await document.exitFullscreen();

        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Alguns navegadores/totens podem bloquear fullscreen programatico.
    }
  }

  function resetExperience() {
    try {
      window.sessionStorage.removeItem(
        "finora-clinicorp-participation",
      );
    } catch {}

    router.replace(
      `/${event}`,
    );
  }

  const isRoletaOrTelao = pathname?.includes("/roleta") || pathname?.includes("/telao");

  return (
    <>
      {!isRoletaOrTelao && (
        <div className="clinicorpKioskTools">
        {pending > 0 && (
          <span
            className="flex h-8 items-center rounded-full bg-[#FFF3DC] px-3 text-xs font-bold text-[#8A5D00]"
            title="Cadastros aguardando envio"
          >
            {pending} aguardando envio
          </span>
        )}

        <div
          className={
            online
              ? "clinicorpConnectionStatus online"
              : "clinicorpConnectionStatus offline"
          }
          title={
            online
              ? "Internet conectada"
              : "Sem internet"
          }
        >
          {online ? (
            <Wifi size={14} />
          ) : (
            <WifiOff size={14} />
          )}
        </div>

        <button
          type="button"
          className="clinicorpKioskToolButton"
          onClick={
            enterFullscreen
          }
          title={
            fullscreen
              ? "Sair da tela cheia"
              : "Tela cheia"
          }
          aria-label="Alternar tela cheia"
        >
          <Maximize2
            size={14}
          />
        </button>

        <button
          type="button"
          className="clinicorpKioskToolButton"
          onClick={
            resetExperience
          }
          title="Reiniciar experiência"
          aria-label="Reiniciar experiência"
        >
          <RotateCcw
            size={14}
          />
        </button>
      </div>
      )}
    </>
  );
}

