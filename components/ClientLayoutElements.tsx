"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Rotas do CRM e as telas de acesso dele
const isCrmArea = (pathname: string) =>
  pathname.startsWith("/crm") || pathname.startsWith("/auth/") || pathname === "/login";

// Rotas de aplicações internas ou com layout próprio dedicado (CRM, Admin, Quiz interno)
const isStandaloneApp = (pathname: string) =>
  isCrmArea(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/quiz");

export function ClientLayoutElements({ type }: { type: "navbar" | "footer" }) {
  const pathname = usePathname() ?? "";

  // Esconde o Navbar e Footer nas rotas do CRM, Admin e Quiz (que tem cabeçalho próprio)
  if (isStandaloneApp(pathname)) return null;

  return type === "navbar" ? <Navbar /> : <Footer />;
}

/** Extras só do site institucional (WhatsApp flutuante, voltar ao topo): fora de CRM, Admin e Quiz. */
export function SiteOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (isStandaloneApp(pathname)) return null;
  return children;
}
