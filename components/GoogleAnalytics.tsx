"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";

const GA_ID = "G-L5CSV2XQL3";

/**
 * Loads GA4 only after the visitor allows statistics in the cookie banner, so no request reaches
 * Google before consent. The bootstrap in app/layout.tsx defines gtag with every signal denied.
 */
export function GoogleAnalytics() {
  const allowed = useConsent("analytics");
  if (!allowed) return null;

  return (
    <>
      <Script id="qmax-ga4-config" strategy="afterInteractive">
        {`
          gtag('consent', 'update', { analytics_storage: 'granted' });
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
        `}
      </Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
    </>
  );
}
