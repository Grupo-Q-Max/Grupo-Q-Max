"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useConsent } from "@/lib/consent";

/**
 * Google Maps embed. Google may set its own cookies when the iframe loads, so it only loads after the
 * visitor allows "Conteúdo de terceiros" in the cookie banner or clicks the placeholder.
 */
export function DeferredGoogleMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const allowed = useConsent("embeds");
  const [clicked, setClicked] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const load = clicked || (allowed && visible);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
      {load ? (
        <iframe
          src="https://www.google.com/maps?q=R.+Frei+Gaspar,+941,+Sao+Bernardo+do+Campo,+SP&output=embed"
          title="Localização do Grupo Q-Max em São Bernardo do Campo"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <button
          type="button"
          onClick={() => setClicked(true)}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 24,
            border: 0,
            background: "var(--qmax-surface, #070708)",
            color: "var(--qmax-white, #f7f6f8)",
            font: "inherit",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <MapPin size={28} aria-hidden />
          <strong>Carregar mapa</strong>
          <small style={{ color: "var(--qmax-muted, #98939d)", maxWidth: 320 }}>
            O mapa é fornecido pelo Google, que pode gravar cookies ao carregar.
          </small>
        </button>
      )}
    </div>
  );
}
