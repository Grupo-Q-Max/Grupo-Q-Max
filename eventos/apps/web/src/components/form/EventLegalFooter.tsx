"use client";

import { usePathname } from "next/navigation";
import { LegalFooter } from "@/components/form/Legal";

// Telas de palco (roleta, telão, sorteio) ocupam a tela inteira: sem rodapé.
const STAGE_SCREENS = /\/(roleta|telao|sorteio-geral)\/?$/;

export default function EventLegalFooter() {
  const pathname = usePathname() || "";
  if (STAGE_SCREENS.test(pathname)) return null;
  return (
    <div className="bg-ink-950">
      <LegalFooter />
    </div>
  );
}
