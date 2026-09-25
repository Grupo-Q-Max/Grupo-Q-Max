"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function PageTracker() {
  const pathname = usePathname();
  const hasTracked = useRef<string | null>(null);

  useEffect(() => {
    // Avoid double tracking in development StrictMode
    if (hasTracked.current === pathname) return;
    hasTracked.current = pathname;

    try {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          referrer: document.referrer || "Direto (Sem referrer)",
          userAgent: window.navigator.userAgent,
        }),
      });
    } catch (e) {
      console.error("Tracker failed", e);
    }
  }, [pathname]);

  return null;
}
