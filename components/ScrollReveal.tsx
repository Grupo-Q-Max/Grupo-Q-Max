"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: "fade-up" | "fade-in" | "zoom-in" | "slide-left" | "slide-right";
  delay?: number;
  duration?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 1.2,
  className = "",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Antes de revelar, o wrapper fica com translateY(120px) e o navegador
    // calcula a posição da âncora com esse deslocamento: a seção para 120px
    // acima do lugar. Se a âncora clicada está aqui dentro, revela sem
    // transição, direto no DOM, antes de a rolagem nativa começar.
    const revealForAnchor = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!link || link.pathname !== window.location.pathname || link.hash.length < 2) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target || !el.contains(target)) return;
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "none";
      setInstant(true);
      setIsVisible(true);
    };
    document.addEventListener("click", revealForAnchor, true);
    const removeListener = () => document.removeEventListener("click", revealForAnchor, true);

    // Já visível ou acima da viewport ao montar (ex.: link direto /#sobre):
    // revela na hora para a seção não aparecer vazia.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      setIsVisible(true);
      return removeListener;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Optional: stop observing once revealed to keep it visible
          if (ref.current) observer.unobserve(ref.current);
        }
      },
      {
        rootMargin: "0px 0px -10% 0px", // Trigger slightly before it enters the viewport
        threshold: 0.1,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      removeListener();
      observer.disconnect();
    };
  }, []);

  // Set up the CSS variables for the inline style
  const style: React.CSSProperties = {
    transition: instant ? "none" : `opacity ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  };

  if (!isVisible) {
    style.opacity = 0;
    if (animation === "fade-up") style.transform = "translateY(120px)";
    else if (animation === "zoom-in") style.transform = "scale(0.8)";
    else if (animation === "slide-left") style.transform = "translateX(-120px)";
    else if (animation === "slide-right") style.transform = "translateX(120px)";
  } else {
    style.opacity = 1;
    style.transform = "translate(0, 0) scale(1)";
  }

  return (
    <div ref={ref} style={style} className={className}>
      {children}
    </div>
  );
}
