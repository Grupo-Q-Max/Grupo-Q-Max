"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Rotas do CRM e as telas de acesso dele
const isCrmArea = (pathname: string) => pathname.startsWith("/crm") || pathname.startsWith("/auth/") || pathname === "/login";

export function ClientLayoutElements({ type }: { type: "navbar" | "footer" }) {
  // Esconde o Navbar e Footer nas rotas do CRM
  if (isCrmArea(usePathname() ?? "")) return null;

  return type === "navbar" ? <Navbar /> : <Footer />;
}

/** Extras só do site (WhatsApp, voltar ao topo, contagem de visitas, GA): fora do CRM e do /admin. */
export function SiteOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (isCrmArea(pathname) || pathname.startsWith("/admin")) return null;
  return children;
}
