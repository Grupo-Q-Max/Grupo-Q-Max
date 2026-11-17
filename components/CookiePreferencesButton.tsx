"use client";

import { Sliders } from "lucide-react";

/** Reopens the cookie preferences of components/CookieConsent.tsx. */
export function CookiePreferencesButton({ label = "Alterar minhas escolhas de cookies" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}
      className="qmax-legal-btn"
    >
      <Sliders size={16} />
      <span>{label}</span>
    </button>
  );
}
