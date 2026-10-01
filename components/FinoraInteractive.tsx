"use client";

import { useEffect, useId, useRef, useState } from "react";

/*
 * Interações do protótipo da FINORA (Figma → página Protótipo, frame Home).
 * Todas usam a transição do Figma: Smart Animate de 300ms.
 */

// "crescimento da sua clínica_": troca de variante a cada 1s (After delay 1s),
// em loop, com Smart Animate 300ms ease-out.
const HEADLINE_WORDS = [
  "crescimento da sua clínica_",
  "sucesso da sua clínica_",
  "próximo nível da sua gestão_",
  "futuro da sua clínica_",
];
const HEADLINE_HOLD_MS = 1000;
// Smart Animate de 300ms: metade saindo, metade entrando.
const HEADLINE_FADE_MS = 150;

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let fadeTimer: number;
    const cycle = window.setInterval(() => {
      setVisible(false);
      fadeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % HEADLINE_WORDS.length);
        setVisible(true);
      }, HEADLINE_FADE_MS);
    }, HEADLINE_HOLD_MS + HEADLINE_FADE_MS * 2);

    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <span className="fnr-hero__rotating" data-visible={visible} aria-live="off">
      {HEADLINE_WORDS[index]}
    </span>
  );
}

type FaqItem = { question: string; answer: string };

// Perguntas: clique alterna entre fechado (84px) e aberto, Smart Animate 300ms ease-in.
// Como no protótipo, cada pergunta abre e fecha de forma independente.
export function FinoraFaq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  const baseId = useId();

  return (
    <div className="fnr-faq__list">
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const panelId = `${baseId}-${index}`;
        return (
          <div key={item.question} className="fnr-faq__item" data-open={isOpen}>
            <button
              type="button"
              className="fnr-faq__question"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(index)}
            >
              <span>{item.question}</span>
              <img src="/finora/chevron.svg" alt="" width={27} height={18} className="fnr-faq__chevron" />
            </button>
            <FaqPanel id={panelId} open={isOpen} answer={item.answer} />
          </div>
        );
      })}
    </div>
  );
}

// A altura anima entre 0 e a altura medida do conteúdo. (Animar grid-template-rows
// de 0fr a 1fr deixava o fundo crescer antes do texto, que piscava ao aparecer.)
function FaqPanel({ id, open, answer }: { id: string; open: boolean; answer: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setHeight(content.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={id}
      className="fnr-faq__panel"
      role="region"
      aria-hidden={!open}
      style={{ height: open ? height : 0 }}
    >
      <div ref={contentRef}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

// Fundo do card de depoimento (Group 125). No hover (Smart Animate 300ms ease-in)
// o brilho roxo cresce de r67 para r98 e as estrelas vão de 70% para 100%.
// O crescimento usa scale(98/67) a partir do ponto (465.66, 337) para levar o
// centro de (398.65, 270) até (367.65, 239), como na variante 2.
export function TestimonialCardArt() {
  const id = useId().replace(/:/g, "");
  const star =
    "l-8.026 4.22 1.533-8.938-6.501-6.329 8.972-1.3 4.013-8.131 4.012 8.131 8.973 1.3-6.502 6.329 1.533 8.937z";

  return (
    <svg
      className="fnr-testimonial__bg"
      viewBox="0 0 459.653 300"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <defs>
        <mask id={`${id}-m`} style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="0" y="0" width="460" height="300">
          <rect width="459.653" height="300" rx="14" fill="#E8F5E8" />
        </mask>
        <filter id={`${id}-f`} x="-300" y="-300" width="1100" height="900" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="96" />
        </filter>
      </defs>
      <g mask={`url(#${id}-m)`}>
        <rect width="459.653" height="300" rx="14" fill="#E8F5E8" />
        <g filter={`url(#${id}-f)`}>
          <circle className="fnr-testimonial__glow" cx="398.653" cy="270" r="67" fill="#663399" />
        </g>
        <g className="fnr-testimonial__stars" fill="#2D0059">
          <path d={`M182.586 62.479${star}`} />
          <path d={`M135.336 77.677${star}`} />
          <path d={`M324.336 77.677${star}`} />
          <path d={`M277.086 62.479${star}`} />
        </g>
        <path
          d={`M229.836 52.979${star}`}
          fill="#2D0059"
          stroke="#2D0059"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
