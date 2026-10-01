"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function ClientLayoutElements({ type }: { type: "navbar" | "footer" }) {
  const pathname = usePathname();
  
  // Esconde o Navbar e Footer nas rotas do CRM
  if (pathname?.startsWith("/crm")) {
    return null;
  }

  return type === "navbar" ? <Navbar /> : <Footer />;
}
