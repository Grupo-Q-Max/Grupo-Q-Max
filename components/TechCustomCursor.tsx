"use client";

import { useEffect, useRef, useState } from "react";

export function TechCustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Desativa em celulares, tablets e dispositivos com toque (evita cursor congelado)
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    setIsMounted(true);

    let requestRef: number;
    let isHovering = false;

    const setVisible = (visible: boolean) => {
      const opacity = visible ? "1" : "0";
      if (dotRef.current) dotRef.current.style.opacity = opacity;
      if (glowRef.current) glowRef.current.style.opacity = opacity;
    };

    const updateMousePosition = (e: MouseEvent) => {
      cancelAnimationFrame(requestRef);
      requestRef = requestAnimationFrame(() => {
        if (dotRef.current) {
          dotRef.current.style.transform = `translate3d(${e.clientX - 4}px, ${e.clientY - 4}px, 0)`;
        }
        if (glowRef.current) {
          glowRef.current.style.transform = `translate3d(${e.clientX - 20}px, ${e.clientY - 20}px, 0) scale(${isHovering ? 2.5 : 1})`;
        }
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive =
        target.tagName.toLowerCase() === "a" ||
        target.tagName.toLowerCase() === "button" ||
        target.tagName.toLowerCase() === "input" ||
        target.tagName.toLowerCase() === "textarea" ||
        target.tagName.toLowerCase() === "select" ||
        target.getAttribute("role") === "button" ||
        target.closest("a") ||
        target.closest("button") ||
        target.closest(".tech-card") ||
        target.closest(".tech-product-card") ||
        target.closest(".cursor-pointer");

      if (interactive) {
        isHovering = true;
        if (glowRef.current) {
          glowRef.current.style.backgroundColor = "rgba(0, 255, 255, 0.4)";
        }
      } else {
        isHovering = false;
        if (glowRef.current) {
          glowRef.current.style.backgroundColor = "rgba(11, 21, 217, 0.3)";
        }
      }
    };

    const handleMouseEnter = () => setVisible(true);
    const handleMouseLeave = () => setVisible(false);

    window.addEventListener("mousemove", updateMousePosition, { passive: true });
    window.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(requestRef);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="tech-cursor-dot"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          pointerEvents: "none",
          transform: "translate3d(-100px, -100px, 0)",
          transition: "opacity 0.2s ease",
          zIndex: 100000,
          opacity: 0,
        }}
      />
      <div
        ref={glowRef}
        className="tech-cursor-glow"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          pointerEvents: "none",
          transform: "translate3d(-100px, -100px, 0) scale(1)",
          backgroundColor: "rgba(11, 21, 217, 0.3)",
          transition: "transform 0.15s ease-out, background-color 0.2s ease, opacity 0.2s ease",
          zIndex: 99999,
          opacity: 0,
        }}
      />
    </>
  );
}
