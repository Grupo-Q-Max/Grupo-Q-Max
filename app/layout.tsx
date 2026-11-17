import { Montserrat } from "next/font/google";
import Script from "next/script";
import { QmaxAnalytics } from "@/components/QmaxAnalytics";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import { ClientLayoutElements, SiteOnly } from "@/components/ClientLayoutElements";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { BackToTop } from "@/components/BackToTop";
import { SettingsProvider } from "@/components/SettingsProvider";
import { readSettings, withoutPassword } from "@/lib/settings";
import { PageTracker } from "@/components/PageTracker";
import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { QuickLeadModal } from "@/components/QuickLeadModal";
import type { Metadata, Viewport } from "next";
import "./qmax-base.css";
import "./qmax-overrides.css";
import "./qmax-brand-system.css";
// Here, not in the CRM/admin layouts: crm.css and admin.css override its rules and must load after it
import "@/components/ui/ui.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grupoqmax.com.br"),
  applicationName: "Grupo Q-Max",
  category: "business",
  creator: "Grupo Q-Max",
  publisher: "Grupo Q-Max",

  title: {
    default: "Grupo Q-Max | Tecnologia, Inovação e Atitude",
    template: "%s | Grupo Q-Max",
  },

  description:
    "Ecossistema empresarial que conecta auditoria, contabilidade, talentos, tecnologia e soluções digitais para transformar conhecimento em resultados.",

  keywords: [
    "Grupo Q-Max",
    "Q-Max",
    "Q-Max Auditoria",
    "Q-Max Contábil",
    "Q-Max Talents",
    "Q-Max Technology",
    "Lagerhaus",
    "QXBACK",
    "QXSIGN",
    "FINORA",
    "auditoria",
    "contabilidade",
    "tecnologia",
    "soluções empresariais",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Grupo Q-Max | Tecnologia, Inovação e Atitude",
    description:
      "Empresas, pessoas e soluções conectadas por uma mesma visão de qualidade, inovação e crescimento.",
    type: "website",
    locale: "pt_BR",
    siteName: "Grupo Q-Max",
    url: "/",
  },

  twitter: {
    card: "summary_large_image",
    title: "Grupo Q-Max | Tecnologia, Inovação e Atitude",
    description:
      "Empresas, pessoas e soluções conectadas por uma mesma visão de qualidade, inovação e crescimento.",
  },

  manifest: "/manifest.webmanifest",

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050506",
  colorScheme: "dark",
};

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-montserrat",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Goes to every visitor (SettingsProvider is a client component): never the admin password
  const settings = withoutPassword(readSettings());

  return (
    // suppressHydrationWarning: extensões do navegador (ex.: réguas/grids) injetam
    // atributos como style="--lineColor:..." no <html> antes do React hidratar.
    <html lang="pt-BR" className={montserrat.variable} suppressHydrationWarning>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white text-sm font-semibold transition-all"
        >
          Pular para o conteúdo principal
        </a>
        <SettingsProvider settings={settings}>
          {/* GA, visit tracking and the floating buttons are for site visitors, not CRM/admin users */}
          <SiteOnly>
            {/* No network request here: defines gtag with every signal denied. GA4 itself loads in
                GoogleAnalytics only after the visitor allows statistics in the cookie banner. */}
            <Script id="qmax-ga4-bootstrap" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('consent', 'default', {
                  analytics_storage: 'denied',
                  ad_storage: 'denied',
                  ad_user_data: 'denied',
                  ad_personalization: 'denied',
                  functionality_storage: 'denied',
                  security_storage: 'granted'
                });
              `}
            </Script>
            <GoogleAnalytics />
            <QmaxAnalytics />
            <CookieConsent />
          </SiteOnly>
          <OrganizationJsonLd />
          <ClientLayoutElements type="navbar" />
          {children}
          <ClientLayoutElements type="footer" />
          <SiteOnly>
            <FloatingWhatsApp whatsapp={settings.whatsapp} />
            <PageTracker />
            <QuickLeadModal />
            <BackToTop />
          </SiteOnly>
        </SettingsProvider>
      </body>
    </html>
  );
}