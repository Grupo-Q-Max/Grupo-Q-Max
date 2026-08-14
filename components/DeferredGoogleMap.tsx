"use client";

import { useEffect, useRef, useState } from "react";

export function DeferredGoogleMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "600px 0px",
      }
    );

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      {ready ? (
        <iframe
          src="https://www.google.com/maps?q=R.+Frei+Gaspar,+941,+Sao+Bernardo+do+Campo,+SP&output=embed"
          title="Localização do Grupo Q-Max em São Bernardo do Campo"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
    </div>
  );
}