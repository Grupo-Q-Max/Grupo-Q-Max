"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function ClientLayoutElements({ type }: { type: "navbar" | "footer" }) {
  const pathname = usePathname();
  
  // Esconde o Navbar e Footer nas rotas do CRM (e nas telas de acesso dele)
  if (pathname?.startsWith("/crm") || ["/login", "/register", "/verify"].includes(pathname ?? "")) {
    return null;
  }

  return type === "navbar" ? <Navbar /> : <Footer />;
}
