"use client";

import { useEffect, useRef, useState } from "react";
import { Handshake } from "lucide-react";
import type { IPublicClientApplication } from "@azure/msal-browser";

/**
 * Limpa flags de interação pendente do MSAL no sessionStorage para evitar
 * que o erro "interaction_in_progress" trave o botão em caso de fechamento ou erro na popup.
 */
function clearMsalInteractionStatus() {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (
        key &&
        (key.includes("interaction_status") ||
          key.includes("interaction.status") ||
          key.includes("interaction_in_progress") ||
          key.includes("request.state"))
      ) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

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
    clearMsalInteractionStatus();
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
      await app.handleRedirectPromise().catch(() => null);
      return app;
    });
  }, [tenantId, clientId]);

  async function signIn() {
    setLoading(true);
    setError("");
    clearMsalInteractionStatus();

    try {
      const app = await msal.current!;
      await app.handleRedirectPromise().catch(() => null);

      // User.Read: Graph token used by the server only to copy the profile photo
      const result = await app.loginPopup({
        scopes: ["openid", "profile", "email", "User.Read"],
        prompt: "select_account",
      });

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
      clearMsalInteractionStatus();
      const code = (err as { errorCode?: string }).errorCode;
      const errMsg = err instanceof Error ? err.message : String(err);

      // Closing the popup is not an error worth showing
      if (code !== "user_cancelled") {
        console.error("[MicrosoftLogin]", err);

        if (code === "interaction_in_progress") {
          setError("Uma tentativa anterior foi interrompida. O estado de login foi redefinido — por favor, clique novamente para entrar.");
        } else if (errMsg.includes("AADSTS50011") || errMsg.includes("redirect URI") || errMsg.includes("redirect_uri")) {
          setError(
            `A URI de redirecionamento (${typeof location !== "undefined" ? location.origin : "https://grupoqmax.com.br"}/auth/microsoft/callback) precisa ser adicionada nas configurações do aplicativo no Portal do Azure (Entra ID > Registros de Aplicativo > Autenticação > SPA).`
          );
        } else if (code === "popup_window_error") {
          setError("O navegador bloqueou a janela de login. Permita pop-ups para este site e tente de novo.");
        } else if (err instanceof Error && !code) {
          setError(err.message);
        } else {
          setError("Não foi possível entrar com a Microsoft. Tente novamente.");
        }
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
