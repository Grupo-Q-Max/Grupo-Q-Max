"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent";

/** First-party visit counter. Runs only with the "Estatísticas" consent from the cookie banner. */
export function PageTracker() {
  const pathname = usePathname();
  const allowed = useConsent("analytics");
  const hasTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    // Avoid double tracking in development StrictMode
    if (hasTracked.current === pathname) return;
    hasTracked.current = pathname;

    let referrer = "";
    try {
      // Origin only: the full referrer URL may carry query strings with personal data
      referrer = document.referrer ? new URL(document.referrer).origin : "";
    } catch {
      referrer = "";
    }

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer: referrer || "Direto (Sem referrer)" }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, allowed]);

  return null;
}
