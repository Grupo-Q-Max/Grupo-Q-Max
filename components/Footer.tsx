"use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import type { MouseEvent } from "react";

import { useSettings } from "@/components/SettingsProvider";
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
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: "16px 0", borderTop: "1px solid rgba(255, 255, 255, 0.05)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: "0.78rem", color: "#a1a1aa" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#14d0c1", fontWeight: 700 }}>🔒 CONFORMIDADE LGPD:</span>
            <span>Ambiente seguro, governança corporativa e sigilo rigoroso de dados protegidos pela Lei 13.709/18.</span>
          </span>
          <span style={{ color: "#71717a" }}>Certificados Digitais & Auditoria Contábil Regular</span>
        </div>
      </div>

      <div className="container finish-footer__bottom">
        <span>© 2026 {settings.siteName} <QmaxInline>Q-Max</QmaxInline><span className="qmax-punctuation">.</span></span>

        <div>
          <span>{settings.address.split("-")[1] || settings.address}</span>
          <i />
          <span>Atendimento Nacional</span>
        </div>
      </div>
    </footer>
  );
}
