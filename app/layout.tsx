import Script from "next/script";
import { QmaxAnalytics } from "@/components/QmaxAnalytics";
import { OrganizationJsonLd } from "@/components/OrganizationJsonLd";
import type { Metadata, Viewport } from "next";
import "./qmax-base.css";
import "./qmax-overrides.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.grupoqmax.com.br"),
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <Script
          id="qmax-ga4-bootstrap"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer = window.dataLayer || [];

            window.gtag = window.gtag || function(){
              window.dataLayer.push(arguments);
            };

            window.gtag('js', new Date());

            window.gtag('config', 'G-L5CSV2XQL3', {
              send_page_view: true
            });
          `}
        </Script>

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-L5CSV2XQL3"
          strategy="lazyOnload"
        />
<QmaxAnalytics /><OrganizationJsonLd />{children}</body>
    </html>
  );
}