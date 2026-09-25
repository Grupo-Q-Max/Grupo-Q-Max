"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Menu,
  Package,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  qmaxCompanies,
  qmaxGroup,
  qmaxProducts,
} from "@/lib/qmax-navigation";

import "./qmax-ecosystem-header.css";

type QmaxHeaderProps = {
  brand:
    | "group"
    | "auditoria"
    | "contabil"
    | "talents"
    | "technology"
    | "lagerhaus";

  logo?: string;
  accent?: string;
};

export function QmaxEcosystemHeader({
  brand,
  logo,
  accent = "#d90f81",
}: QmaxHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isGroup = brand === "group";

  const brandLogo =
    logo ??
    (isGroup
      ? "/brands/grupo-qmax-white.png"
      : "/brands/auditoria-branco.png");

  return (
    <header
      className="qeh"
      style={
        {
          "--qeh-accent": accent,
        } as React.CSSProperties
      }
    >
      <div className="qeh__inner">
        <Link
          href={isGroup ? "/" : `/${brand}`}
          className="qeh__brand"
          aria-label={isGroup ? "Grupo Q-Max" : "Q-Max"}
        >
          <Image
            src={brandLogo}
            alt=""
            width={180}
            height={58}
            priority
          />
        </Link>

        <nav className="qeh__desktop" aria-label="Navegação principal">
          <Link href="/">
            <span className="qeh__qmaxText">
              Grupo Q-Max
            </span>
          </Link>

          <div className="qeh__item">
            <button type="button">
              Empresas
              <ChevronDown size={14} />
            </button>

            <div className="qeh__dropdown qeh__dropdown--companies">
              <div className="qeh__dropdownHead">
                <div>
                  <small>ECOSSISTEMA</small>
                  <strong>
                    Empresas conectadas.
                    <br />
                    Especialidades complementares.
                  </strong>
                </div>

                <Building2 size={26} />
              </div>

              <div className="qeh__companyGrid">
                {qmaxCompanies.map((company) => (
                  <Link
                    href={company.href}
                    key={company.id}
                    className={
                      brand === company.id
                        ? "qeh__company active"
                        : "qeh__company"
                    }
                    style={
                      {
                        "--company-accent": company.accent,
                      } as React.CSSProperties
                    }
                  >
                    <span className="qeh__companyDot" />

                    <span>
                      <small>{company.label}</small>
                      <strong>{company.name}</strong>
                    </span>

                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="qeh__item">
            <button type="button">
              Produtos
              <ChevronDown size={14} />
            </button>

            <div className="qeh__dropdown qeh__dropdown--products">
              <div className="qeh__dropdownHead">
                <div>
                  <small>SOLUÇÕES Q-MAX</small>

                  <strong>
                    Tecnologia para ampliar
                    <br />
                    possibilidades.
                  </strong>
                </div>

                <Package size={25} />
              </div>

              <div className="qeh__productGrid">
                {qmaxProducts.map((product) => (
                  <Link
                    href={product.href}
                    key={product.id}
                    className="qeh__product"
                  >
                    <span>
                      <small>{product.label}</small>
                      <strong>{product.name}</strong>
                    </span>

                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <a href="#sobre">Sobre</a>
          <a href="#contato">Contato</a>
        </nav>

        <div className="qeh__actions">
          <a className="qeh__cta" href="#contato">
            Fale conosco
            <ArrowRight size={16} />
          </a>

          <button
            type="button"
            className="qeh__mobileButton"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div
        className={
          mobileOpen
            ? "qeh__mobile active"
            : "qeh__mobile"
        }
      >
        <div className="qeh__mobileInner">
          <Link href="/" onClick={() => setMobileOpen(false)}>
            <span className="qeh__qmaxText">
              Grupo Q-Max
            </span>
          </Link>

          <div className="qeh__mobileSection">
            <small>EMPRESAS</small>

            {qmaxCompanies.map((company) => (
              <Link
                href={company.href}
                key={company.id}
                onClick={() => setMobileOpen(false)}
              >
                {company.name}
              </Link>
            ))}
          </div>

          <div className="qeh__mobileSection">
            <small>PRODUTOS</small>

            {qmaxProducts.map((product) => (
              <Link
                href={product.href}
                key={product.id}
                onClick={() => setMobileOpen(false)}
              >
                {product.name}
              </Link>
            ))}
          </div>

          <a
            href="#contato"
            className="qeh__mobileCta"
            onClick={() => setMobileOpen(false)}
          >
            Fale conosco
            <ArrowRight size={17} />
          </a>
        </div>
      </div>
    </header>
  );
}
