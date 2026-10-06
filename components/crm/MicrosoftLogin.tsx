"use client";

import { useEffect, useRef, useState } from "react";
import { Handshake } from "lucide-react";
import type { IPublicClientApplication } from "@azure/msal-browser";

/**
 * "Entrar com Microsoft": MSAL popup (Authorization Code + PKCE), then POST of the id_token (+ Graph token for the photo) to
 * /api/auth/microsoft, which validates it and sets the HttpOnly session cookie. Nothing of the session
 * is stored by this page; MSAL keeps its own cache in sessionStorage.
 */
export function MicrosoftLogin({ tenantId, clientId }: { tenantId: string; clientId: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const msal = useRef<Promise<IPublicClientApplication> | null>(null);

  // Load and initialize MSAL with the page, so the click opens the popup right away: browsers block
  // popups opened after awaiting other work (the click no longer counts as the user's gesture)
  useEffect(() => {
    msal.current = import("@azure/msal-browser").then(async ({ PublicClientApplication }) => {
      const app = new PublicClientApplication({
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`,
          redirectUri: `${location.origin}/auth/microsoft/callback`,
        },
        cache: { cacheLocation: "sessionStorage" },
      });
      await app.initialize();
      return app;
    });
  }, [tenantId, clientId]);

  async function signIn() {
    setLoading(true);
    setError("");
    try {
      const app = await msal.current!;
      // User.Read: Graph token used by the server only to copy the profile photo
      const result = await app.loginPopup({ scopes: ["openid", "profile", "email", "User.Read"], prompt: "select_account" });

      const res = await fetch("/api/auth/microsoft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: result.idToken, accessToken: result.accessToken }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível entrar.");

      const next = new URLSearchParams(location.search).get("next");
      // only same-site paths: never redirect to another origin
      location.href = next?.startsWith("/") && !next.startsWith("//") ? next : "/crm";
    } catch (err) {
      const code = (err as { errorCode?: string }).errorCode;
      // Closing the popup is not an error worth showing
      if (code !== "user_cancelled") {
        console.error("[MicrosoftLogin]", err);
        setError(
          code === "popup_window_error"
            ? "O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo."
            : err instanceof Error && !code
              ? err.message
              : "Não foi possível entrar com a Microsoft. Tente novamente."
        );
      }
      setLoading(false);
    }
  }

  return (
    <main className="crm-login">
      <div className="crm-login__card">
        <div className="crm-login__brand">
          <Handshake size={28} />
          <span>Q-Max CRM</span>
        </div>
        <p className="crm-login__notice">Entre com a sua conta Microsoft corporativa.</p>
        {error && (
          <p className="crm-login__error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="crm-login__microsoft" onClick={signIn} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {loading ? "Entrando..." : "Entrar com Microsoft"}
        </button>
      </div>
    </main>
  );
}
