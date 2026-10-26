"use client";

import { useEffect, useEffectEvent } from "react";
import { getApiBaseUrl } from "./api-client";

// Telas ao vivo: a API avisa por SSE que o evento mudou e a tela refaz o próprio
// fetch. No máximo 1 refetch a cada 2s no pico; polling lento cobre o SSE caído.
export function useLiveEvent(eventId: number | null | undefined, onChange: () => void, fallbackMs = 60_000) {
  const fire = useEffectEvent(onChange);

  useEffect(() => {
    if (!eventId) return;

    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const trigger = () => {
      const wait = last + 2000 - Date.now();
      if (wait <= 0) {
        last = Date.now();
        fire();
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = undefined;
          last = Date.now();
          fire();
        }, wait);
      }
    };

    let connectedBefore = false;
    const source = new EventSource(`${getApiBaseUrl()}/live/event/${eventId}`);
    source.onopen = () => {
      // Reconectou: pode ter perdido avisos enquanto estava fora.
      if (connectedBefore) trigger();
      connectedBefore = true;
    };
    source.onmessage = (e) => {
      try {
        if (JSON.parse(e.data).type === "changed") trigger();
      } catch {}
    };
    const poll = setInterval(trigger, fallbackMs);

    return () => {
      source.close();
      clearInterval(poll);
      clearTimeout(timer);
    };
  }, [eventId, fallbackMs]);
}
