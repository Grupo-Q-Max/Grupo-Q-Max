"use client";

import { useEffect } from "react";

export default function CRMError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CRM Error]", error);
  }, [error]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: "24px",
      padding: "40px",
      fontFamily: "sans-serif",
    }}>
      <div style={{ fontSize: "48px" }}>⚠️</div>
      <h2 style={{ color: "#c62828", margin: 0, fontSize: "22px" }}>
        Erro ao carregar o CRM
      </h2>
      <p style={{ color: "#666", maxWidth: "500px", textAlign: "center", lineHeight: "1.6" }}>
        Houve um problema ao conectar com o banco de dados. 
        Isso pode ser temporário — tente novamente em instantes.
      </p>
      {error?.digest && (
        <code style={{ background: "#f5f5f5", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", color: "#333" }}>
          Código: {error.digest}
        </code>
      )}
      <button
        onClick={reset}
        style={{
          padding: "12px 28px",
          background: "#14d0c1",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "15px",
          fontWeight: 600,
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
