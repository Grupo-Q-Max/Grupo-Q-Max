"use client";

import { useEffect } from "react";

// O navegador rola até a âncora (/#sobre) antes da hidratação; depois disso o
// layout acima da seção muda de altura e a rolagem fica deslocada. Reposiciona
// na âncora assim que o layout estabiliza.
export function HashScrollFix() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let cancelled = false;
    const userScrolled = () => {
      cancelled = true;
    };

    const realign = () => {
      if (cancelled) return;
      document.getElementById(id)?.scrollIntoView({
        behavior: "instant",
        block: "start",
      });
    };

    window.addEventListener("wheel", userScrolled, { passive: true, once: true });
    window.addEventListener("touchmove", userScrolled, { passive: true, once: true });
    window.addEventListener("keydown", userScrolled, { once: true });

    const frame = requestAnimationFrame(realign);
    const timers = [300, 1000].map((ms) => window.setTimeout(realign, ms));
    window.addEventListener("load", realign, { once: true });

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(window.clearTimeout);
      window.removeEventListener("load", realign);
      window.removeEventListener("wheel", userScrolled);
      window.removeEventListener("touchmove", userScrolled);
      window.removeEventListener("keydown", userScrolled);
    };
  }, []);

  return null;
}
