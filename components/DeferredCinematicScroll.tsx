"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CinematicScroll = dynamic(
  () =>
    import("./CinematicScroll").then(
      (module) => module.CinematicScroll
    ),
  {
    ssr: false,
  }
);

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: {
      timeout?: number;
    }
  ) => number;

  cancelIdleCallback?: (
    handle: number
  ) => void;
};

export function DeferredCinematicScroll() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const enable = () => {
      if (!cancelled) {
        setReady(true);
      }
    };

    const idleWindow =
      window as IdleWindow;

    if (
      typeof idleWindow.requestIdleCallback ===
      "function"
    ) {
      const idleId =
        idleWindow.requestIdleCallback(
          enable,
          {
            timeout: 1500,
          }
        );

      return () => {
        cancelled = true;

        if (
          typeof idleWindow.cancelIdleCallback ===
          "function"
        ) {
          idleWindow.cancelIdleCallback(
            idleId
          );
        }
      };
    }

    const timer =
      globalThis.setTimeout(
        enable,
        900
      );

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <CinematicScroll />;
}