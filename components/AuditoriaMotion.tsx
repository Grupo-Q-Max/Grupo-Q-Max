"use client";

import { useEffect } from "react";

export function AuditoriaMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".audit67");

    if (!root) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    root.classList.add("audit67--motion-ready");

    const revealSelectors = [
      ".audit67__manifesto",
      ".audit67__proof",
      ".audit67__sectionIntro",
      ".audit67__service",
      ".audit67__methodVisual",
      ".audit67__methodCopy",
      ".audit67__principlesGrid article",
      ".audit67__contact",
    ];

    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>(revealSelectors.join(","))
    );

    revealElements.forEach((element) => {
      element.classList.add("audit67__reveal");
    });

    const services = Array.from(
      root.querySelectorAll<HTMLElement>(".audit67__service")
    );

    services.forEach((service, index) => {
      service.style.setProperty(
        "--audit-reveal-delay",
        `${index * 110}ms`
      );
    });

    const proofItems = Array.from(
      root.querySelectorAll<HTMLElement>(".audit67__proofItem")
    );

    proofItems.forEach((item, index) => {
      item.style.setProperty(
        "--audit-proof-delay",
        `${index * 80}ms`
      );
    });

    const principles = Array.from(
      root.querySelectorAll<HTMLElement>(
        ".audit67__principlesGrid article"
      )
    );

    principles.forEach((item, index) => {
      item.style.setProperty(
        "--audit-reveal-delay",
        `${index * 90}ms`
      );
    });

    if (reducedMotion) {
      root.classList.add("audit67--reduced-motion");

      revealElements.forEach((element) => {
        element.classList.add("audit67__reveal--visible");
      });

      return;
    }

    requestAnimationFrame(() => {
      root.classList.add("audit67--entered");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;

          element.classList.add("audit67__reveal--visible");

          observer.unobserve(element);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    revealElements.forEach((element) => {
      observer.observe(element);
    });

    const hero = root.querySelector<HTMLElement>(
      ".audit67__hero"
    );

    const intelligence = root.querySelector<HTMLElement>(
      ".audit67__intelligence"
    );

    const panel = root.querySelector<HTMLElement>(
      ".audit67__panel"
    );

    const floatingCard = root.querySelector<HTMLElement>(
      ".audit67__floatingCard"
    );

    let ticking = false;

    const updateScrollMotion = () => {
      ticking = false;

      const scrollY = window.scrollY;
      const viewport = window.innerHeight || 1;

      const progress = Math.min(
        1,
        Math.max(0, scrollY / (viewport * 0.92))
      );

      root.style.setProperty(
        "--audit-page-scroll",
        progress.toFixed(4)
      );

      if (hero) {
        const rect = hero.getBoundingClientRect();

        const heroProgress = Math.min(
          1,
          Math.max(
            0,
            -rect.top / Math.max(rect.height, 1)
          )
        );

        root.style.setProperty(
          "--audit-hero-scroll",
          heroProgress.toFixed(4)
        );

        if (intelligence && window.innerWidth > 980) {
          intelligence.style.setProperty(
            "--audit-parallax-y",
            `${heroProgress * 28}px`
          );
        }

        if (panel && window.innerWidth > 980) {
          panel.style.setProperty(
            "--audit-panel-scroll-rotate",
            `${heroProgress * -0.55}deg`
          );
        }

        if (floatingCard && window.innerWidth > 980) {
          floatingCard.style.setProperty(
            "--audit-card-scroll-y",
            `${heroProgress * -18}px`
          );
        }
      }
    };

    const onScroll = () => {
      if (ticking) return;

      ticking = true;

      window.requestAnimationFrame(updateScrollMotion);
    };

    updateScrollMotion();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    window.addEventListener("resize", onScroll);

    return () => {
      observer.disconnect();

      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);

      root.classList.remove(
        "audit67--motion-ready",
        "audit67--entered"
      );

      root.style.removeProperty("--audit-page-scroll");
      root.style.removeProperty("--audit-hero-scroll");

      intelligence?.style.removeProperty(
        "--audit-parallax-y"
      );

      panel?.style.removeProperty(
        "--audit-panel-scroll-rotate"
      );

      floatingCard?.style.removeProperty(
        "--audit-card-scroll-y"
      );
    };
  }, []);

  return null;
}