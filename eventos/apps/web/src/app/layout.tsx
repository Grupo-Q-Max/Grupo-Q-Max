import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import NetworkStatusBanner from "@/components/ui/NetworkStatusBanner";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finora Experience | Invictus",
  description: "Experiência Finora no Invictus.",
  manifest: "/finora-experience/manifest.json",
  icons: {
    icon: "/finora-experience/icon.svg",
    apple: "/finora-experience/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finora Experience",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans bg-[#050811] text-[#F8FAFC] min-h-dvh antialiased" style={{ background: "#050811", color: "#F8FAFC" }} suppressHydrationWarning>
        <ToastProvider>
          <NetworkStatusBanner />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
