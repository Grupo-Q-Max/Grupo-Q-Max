"use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import type { MouseEvent } from "react";

import { useSettings } from "@/components/SettingsProvider";
import { legal } from "@/data/site";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function Footer() {
  function goToFooterItem(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: "empresas" | "produtos",
    itemName: string
  ) {
    event.preventDefault();

    const section =
      document.getElementById(sectionId);

    if (!section) {
      window.location.href = `/#${sectionId}`;
      return;
    }

    section.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    window.setTimeout(() => {
      const buttons = Array.from(
        section.querySelectorAll("button")
      ) as HTMLButtonElement[];

      const normalize = (value: string) =>
        value
          .toLocaleLowerCase("pt-BR")
          .replace("q-max ", "")
          .replace(/\s+/g, " ")
          .trim();

      const targetName =
        normalize(itemName);

      const target = buttons.find(
        (button) => {
          const buttonName = normalize(
            button.textContent || ""
          );

          return (
            buttonName.includes(targetName) ||
            targetName.includes(buttonName)
          );
        }
      );

      target?.click();
    }, 500);
  }

  const settings = useSettings();
  const mainCompany = legal.companies[legal.mainCompanyIndex];
  const phoneOnly = settings.whatsapp.replace(/\D/g, "");
  const pathname = usePathname();

  // A FINORA tem rodapé próprio (components/FinoraFooter).
  if (pathname === "/finora") return null;

  return (
    <footer className="finish-footer">
      <div className="container finish-footer__top">
        <div className="finish-footer__brand">
          <Image
            src="/brands/grupo-qmax-white.png"
            alt={settings.siteName}
            width={150}
            height={76}
            sizes="150px"
            style={{
              width: "auto",
              height: "auto",
            }}
          />

          <p>
            {settings.tagline}
          </p>

          <div className="finish-footer__quickContact">
            <a
              href={`https://wa.me/${phoneOnly}`}
              target="_blank"
              rel="noopener noreferrer"
              className="finish-footer__quickBtn"
              aria-label="WhatsApp Grupo Q-Max"
            >
              <span>● WhatsApp: {settings.whatsapp}</span>
            </a>
            <a
              href={`mailto:${settings.email}`}
              className="finish-footer__quickBtn"
              aria-label="E-mail Grupo Q-Max"
            >
              <span>{settings.email}</span>
            </a>
          </div>
        </div>

        <div className="finish-footer__nav">
          <div>
            <strong>NAVEGAÇÃO</strong>

            <a href="/#inicio">Início</a>
            <a href="/#sobre">Sobre</a>
            <a href="/#socios">Nosso Time</a>
            <a href="/#empresas">Empresas</a>
            <a href="/#produtos">Produtos</a>
            <a href="/#contato">Contato</a>
          </div>

          <div>
            <strong>EMPRESAS</strong>

            <a
              href="/#empresas"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "empresas",
                  "Q-Max Auditoria"
                )
              }
            >
              Q-Max Auditoria
            </a>
            <a
              href="/#empresas"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "empresas",
                  "Q-Max Contábil"
                )
              }
            >
              Q-Max Contábil
            </a>
            <a
              href="/#empresas"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "empresas",
                  "Q-Max Talents"
                )
              }
            >
              Q-Max Talents
            </a>
            <a
              href="/#empresas"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "empresas",
                  "Q-Max Technology"
                )
              }
            >
              Q-Max Technology
            </a>
            <a
              href="https://lagerhaus.work"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lagerhaus
            </a>
          </div>

          <div>
            <strong>PRODUTOS</strong>

            <a
              href="https://qxback.com.br"
              target="_blank"
              rel="noopener noreferrer"
            >
              QXBACK
            </a>
            <a
              href="https://qxsign.com.br"
              target="_blank"
              rel="noopener noreferrer"
            >
              QXSIGN
            </a>
            <a
              href="/#produtos"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "produtos",
                  "FINORA"
                )
              }
            >
              FINORA
            </a>
            <a href="/#diagnostico">
              Simulador Tributário
            </a>
          </div>

          <div>
            <strong>CONFORMIDADE &amp; LGPD</strong>
            <a href="/politica-de-privacidade">Política de Privacidade</a>
            <a href="/termos-de-uso">Termos de Uso</a>
            <a href="/politica-de-cookies">Política de Cookies</a>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-cookie-preferences"));
                }
              }}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                color: "inherit",
                fontSize: "inherit",
                fontFamily: "inherit",
                textAlign: "left",
                cursor: "pointer",
                display: "block",
                transition: "color 0.2s ease"
              }}
            >
              Preferências de Cookies
            </button>
            <a href={`mailto:${legal.dpoEmail}`}>Encarregado (DPO)</a>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "16px 0", borderTop: "1px solid rgba(255, 255, 255, 0.05)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: "0.78rem", color: "#a1a1aa" }}>
          <span>
            {mainCompany.legalName} · CNPJ {mainCompany.cnpj} · {legal.address}
          </span>
          <span>
            Dados pessoais tratados conforme a Lei nº 13.709/2018 (LGPD). Dúvidas ou pedidos:{" "}
            <a href={`mailto:${legal.dpoEmail}`} style={{ color: "inherit" }}>{legal.dpoEmail}</a>
          </span>
        </div>
      </div>

      <div className="container finish-footer__bottom">
        <span>© {new Date().getFullYear()} {settings.siteName} <QmaxInline>Q-Max</QmaxInline><span className="qmax-punctuation">.</span> Todos os direitos reservados.</span>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a href="/termos-de-uso" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "0.82rem" }}>Termos</a>
          <i />
          <a href="/politica-de-privacidade" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "0.82rem" }}>Privacidade</a>
          <i />
          <a href="/politica-de-cookies" style={{ color: "#a1a1aa", textDecoration: "none", fontSize: "0.82rem" }}>Cookies</a>
          <i />
          <span>{settings.address.split("-")[1] || settings.address}</span>
        </div>
      </div>
    </footer>
  );
}
