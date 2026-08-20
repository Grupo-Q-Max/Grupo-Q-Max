"use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import type { MouseEvent } from "react";

import Image from "next/image";

export function Footer() {
  function goToFooterItem(
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: "empresas" | "produtos",
    itemName: string
  ) {
    event.preventDefault();

    const section =
      document.getElementById(sectionId);

    if (!section) return;

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

  return (
    <footer className="finish-footer">
      <div className="container finish-footer__top">
        <div className="finish-footer__brand">
          <Image
            src="/brands/grupo-qmax-white.png"
            alt="Grupo Q-Max"
            width={150}
            height={76}
            sizes="150px"
            style={{
              width: "auto",
              height: "auto",
            }}
          />

          <p>
            Tecnologia, inovação e atitude conectando empresas,
            pessoas e soluções.
          </p>

          <div className="finish-footer__quickContact">
            <a
              href="https://wa.me/5511912957356"
              target="_blank"
              rel="noopener noreferrer"
              className="finish-footer__quickBtn"
              aria-label="WhatsApp Grupo Q-Max"
            >
              <span>● WhatsApp: (11) 91295-7356</span>
            </a>
            <a
              href="mailto:contato@grupoqmax.com.br"
              className="finish-footer__quickBtn"
              aria-label="E-mail Grupo Q-Max"
            >
              <span>contato@grupoqmax.com.br</span>
            </a>
          </div>
        </div>

        <div className="finish-footer__nav">
          <div>
            <strong>NAVEGAÇÃO</strong>

            <a href="#inicio">Início</a>
            <a href="#sobre">Sobre</a>
            <a href="#empresas">Empresas</a>
            <a href="#produtos">Produtos</a>
            <a href="#contato">Contato</a>
          </div>

          <div>
            <strong>EMPRESAS</strong>

            <a
              href="#empresas"
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
              href="#empresas"
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
              href="#empresas"
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
              href="#empresas"
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
              href="#empresas"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "empresas",
                  "Lagerhaus"
                )
              }
            >
              Lagerhaus
            </a>
          </div>

          <div>
            <strong>PRODUTOS</strong>

            <a
              href="#produtos"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "produtos",
                  "QXBACK"
                )
              }
            >
              QXBACK
            </a>
            <a
              href="#produtos"
              onClick={(event) =>
                goToFooterItem(
                  event,
                  "produtos",
                  "QXSIGN"
                )
              }
            >
              QXSIGN
            </a>
            <a
              href="#produtos"
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

      <div className="container finish-footer__bottom">
        <span>© 2026 Grupo <QmaxInline>Q-Max</QmaxInline><span className="qmax-punctuation">.</span></span>

        <div>
          <span>São Bernardo do Campo · SP</span>
          <i />
          <span>Tecnologia, Inovação, Atitude.</span>
        </div>
      </div>
    </footer>
  );
}
