"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, MessageCircle } from "lucide-react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
} from "framer-motion";

const sections = [
  { id: "inicio", label: "Início", short: "Q-MAX", color: "#ef197d" },
  { id: "sobre", label: "Nosso Q", short: "NOSSO Q", color: "#ef197d" },
  { id: "empresas", label: "Empresas", short: "ECOSSISTEMA", color: "#3156ff" },
  { id: "produtos", label: "Produtos", short: "PRODUTOS", color: "#55ff00" },
  { id: "contato", label: "Contato", short: "CONTATO", color: "#ef197d" },
] as const;

export function CinematicScroll() {
  const { scrollYProgress } = useScroll();

  const progress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 30,
    mass: 0.22,
  });

  const pointerX = useMotionValue(-600);
  const pointerY = useMotionValue(-600);
  const smoothX = useSpring(pointerX, { stiffness: 85, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 85, damping: 24 });

  const [activeSection, setActiveSection] = useState("inicio");
  const [showTop, setShowTop] = useState(false);
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

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: "-22% 0px -54% 0px",
        threshold: [0.08, 0.2, 0.4, 0.62],
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > window.innerHeight * 1.25);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!finePointer) return;

    const onPointerMove = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [finePointer, pointerX, pointerY]);

  useEffect(() => {
    document.documentElement.dataset.qmaxSection = active.id;
    document.documentElement.style.setProperty(
      "--active-section-color",
      active.color
    );
  }, [active]);

  return (
    <>
      <motion.div className="qmax-progress" style={{ scaleX: progress }} />

      <div className="qmax-atmosphere" aria-hidden="true" />

      {finePointer && (
        <motion.div
          className="qmax-cursor-aura"
          style={{ x: smoothX, y: smoothY }}
          aria-hidden="true"
        />
      )}

      <nav className="qmax-signature-rail" aria-label="Seções da página">
        <span className="qmax-signature-rail__label" aria-hidden="true">
          {active.short}
        </span>

        <div className="qmax-signature-rail__items">
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={activeSection === section.id ? "active" : ""}
              aria-label={`Ir para ${section.label}`}
              aria-current={activeSection === section.id ? "location" : undefined}
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
        <span>Fale com a Q-Max</span>
      </a>

      <button
        type="button"
        className={`qmax-backtop ${showTop ? "visible" : ""}`}
        aria-label="Voltar ao topo"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
}
