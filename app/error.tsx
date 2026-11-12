"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Q-Max Runtime Error]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "#050506",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Glow de fundo */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(217, 15, 129, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 540,
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 24,
            background: "rgba(217, 15, 129, 0.12)",
            border: "1px solid rgba(217, 15, 129, 0.3)",
            display: "grid",
            placeItems: "center",
            color: "#ff2f91",
            boxShadow: "0 0 30px rgba(217, 15, 129, 0.25)",
          }}
        >
          <AlertTriangle size={34} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{
              fontSize: "0.78rem",
              fontFamily: "monospace",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: "#ff2f91",
            }}
          >
            Erro Inesperado
          </span>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Algo interrompeu a conexão.
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.98rem", lineHeight: 1.6, margin: 0 }}>
            Ocorreu uma instabilidade pontual ao carregar este módulo. Tente recarregar a tela ou retorne à página inicial.
          </p>
        </div>

        {error?.digest && (
          <code
            style={{
              fontSize: "0.78rem",
              fontFamily: "monospace",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "6px 14px",
              borderRadius: 8,
              color: "#71717a",
            }}
          >
            Digest: {error.digest}
          </code>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", width: "100%", marginTop: 8 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              borderRadius: 9999,
              background: "#d90f81",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.92rem",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 0 25px rgba(217, 15, 129, 0.4)",
              transition: "transform 0.15s ease",
            }}
          >
            <RefreshCw size={17} /> Tentar Novamente
          </button>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 26px",
              borderRadius: 9999,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#e4e4e7",
              fontWeight: 600,
              fontSize: "0.92rem",
              textDecoration: "none",
              transition: "background 0.2s ease",
            }}
          >
            <ArrowLeft size={17} /> Voltar ao Início
          </Link>
        </div>
      </div>
    </main>
  );
}

