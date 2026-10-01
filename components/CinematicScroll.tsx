"use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";

const sections = [
  { id: "inicio", label: "Início", short: "Q-MAX", color: "#d90f81" },
  { id: "sobre", label: "Nosso Q", short: "NOSSO Q", color: "#d90f81" },
  { id: "empresas", label: "Empresas", short: "ECOSSISTEMA", color: "#3156ff" },
  { id: "produtos", label: "Produtos", short: "PRODUTOS", color: "#55ff00" },
  { id: "contato", label: "Contato", short: "CONTATO", color: "#d90f81" },
] as const;

export function CinematicScroll() {
  const progressRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [activeSection, setActiveSection] = useState("inicio");
  const [finePointer, setFinePointer] = useState(false);

  const active = useMemo(
    () => sections.find((item) => item.id === activeSection) ?? sections[0],
    [activeSection]
  );

  useEffect(() => {
    const media = window.matchMedia("(pointer: fine) and (hover: hover)");

    const sync = () => setFinePointer(media.matches);
    sync();

    media.addEventListener?.("change", sync);

    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const nodes = sections
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    // Ativa a última seção (na ordem da página) cujo topo já passou de 46%
    // da tela. Calculado no scroll, e não com IntersectionObserver: a
    // intersectionRatio de uma seção alta (Produtos tem ~2400px) nunca
    // passava do threshold e ela não era marcada; e num salto direto
    // (âncora, "Topo") nenhuma seção observada cruzava a faixa.
    let frame = 0;

    const pickActive = () => {
      frame = 0;

      const line = window.innerHeight * 0.46;
      const current = nodes.filter(
        (node) => node.getBoundingClientRect().top < line
      ).at(-1);

      setActiveSection(current?.id ?? sections[0].id);
    };

    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(pickActive);
      }
    };

    pickActive();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

      const progress =
        maxScroll > 0
          ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1)
          : 0;

      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${progress})`;
      }
    };

    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update);
      }
    };

    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    if (!finePointer) return;

    const cursor = cursorRef.current;

    if (!cursor) return;

    let frame = 0;

    let targetX = -600;
    let targetY = -600;
    let currentX = -600;
    let currentY = -600;

    const animate = () => {
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;

      cursor.style.transform =
        `translate3d(${currentX}px, ${currentY}px, 0)`;

      const moving =
        Math.abs(targetX - currentX) > 0.1 ||
        Math.abs(targetY - currentY) > 0.1;

      if (moving) {
        frame = window.requestAnimationFrame(animate);
      } else {
        frame = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;

      if (!frame) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    window.addEventListener("pointermove", onPointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [finePointer]);

  useEffect(() => {
    document.documentElement.dataset.qmaxSection = active.id;
    document.documentElement.style.setProperty(
      "--active-section-color",
      active.color
    );
  }, [active]);

  return (
    <>
      <div
        ref={progressRef}
        className="qmax-progress"
        style={{
          transform: "scaleX(0)",
          transformOrigin: "0 50%",
        }}
      />

      <div className="qmax-atmosphere" aria-hidden="true" />

      {finePointer && (
        <div
          ref={cursorRef}
          className="qmax-cursor-aura"
          style={{
            transform: "translate3d(-600px, -600px, 0)",
            willChange: "transform",
          }}
          aria-hidden="true"
        />
      )}

      <nav
        className="qmax-signature-rail"
        aria-label="Seções da página"
      >
        <span
          className="qmax-signature-rail__label"
          aria-hidden="true"
        >
          {active.short}
        </span>

        <div className="qmax-signature-rail__items">
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={
                activeSection === section.id ? "active" : ""
              }
              aria-label={`Ir para ${section.label}`}
              aria-current={
                activeSection === section.id
                  ? "location"
                  : undefined
              }
            >
              <span>0{index + 1}</span>
              <i />
              <strong>{section.label}</strong>
            </a>
          ))}
        </div>
      </nav>

      <a
        href="#contato"
        className="qmax-floating-contact"
        aria-label="Falar com a Q-Max"
      >
        <MessageCircle size={18} />
        <span>Fale com a <QmaxInline>Q-Max</QmaxInline></span>
      </a>
    </>
  );
}
