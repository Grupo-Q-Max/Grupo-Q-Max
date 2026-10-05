"use client";

import { useEffect, useRef } from "react";

/**
 * Redirect URI of the Microsoft login popup: hands the response back to the /login window
 * (msal-browser v5), which closes this popup.
 */
export default function MicrosoftCallbackPage() {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    import("@azure/msal-browser/redirect-bridge")
      .then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
      .catch((error) => console.error("[auth/microsoft/callback]", error));
  }, []);

  return null;
}
