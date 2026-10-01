"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { companies, products } from "@/components/Navbar";

type FinoraHeaderProps = {
  contactHref: string;
};

const sectionLinks = [
  { label: "Home", href: "#inicio" },
  { label: "Sobre", href: "#sobre" },
  { label: "Especialidades", href: "#especialidades" },
];

const groups = [
  { label: "Empresas", items: companies },
  { label: "Produtos", items: products },
];

export function FinoraHeader({ contactHref }: FinoraHeaderProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={`fnr-header${open ? " is-open" : ""}`}>
      <a href="#inicio" className="fnr-header__logo" aria-label="FINORA — início" onClick={close}>
        {/* Composição do logo exatamente como no Figma: "F", símbolo e "nora". */}
        <span className="fnr-header__logoF">
          <img src="/finora/logo-sprite.png" alt="" />
        </span>
        <span className="fnr-header__logoSymbol">
          <img src="/finora/logo-symbol.png" alt="" />
        </span>
        <span className="fnr-header__logoNora">
          <img src="/finora/logo-sprite.png" alt="" />
        </span>
      </a>

      <nav className="fnr-header__nav" aria-label="Navegação da FINORA">
        {sectionLinks.map((link) => (
          <a key={link.href} href={link.href} onClick={close}>
            {link.label}
          </a>
        ))}

        {groups.map((group) => (
          <div key={group.label} className="fnr-header__group">
            <button type="button" className="fnr-header__groupToggle">
              {group.label}
              <img src="/finora/nav-chevron.svg" alt="" width={8} height={4} />
            </button>
            <div className="fnr-header__dropdown">
              {group.items.map((item) => {
                const external = item.href.startsWith("http");
                return external ? (
                  <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.name}
                  </a>
                ) : (
                  <Link key={item.name} href={item.href} onClick={close}>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <a href="#duvidas" onClick={close}>
          Dúvidas
        </a>
      </nav>

      <a href={contactHref} target="_blank" rel="noopener noreferrer" className="fnr-header__cta">
        Contato
      </a>

      <button
        type="button"
        className="fnr-header__menu"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </header>
  );
}
