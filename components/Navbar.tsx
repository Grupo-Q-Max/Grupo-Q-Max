 "use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

export const companies = [
  {
    name: "Q-Max Auditoria",
    label: "Auditoria",
    href: "/auditoria",
    logo: "/brands/brand-auditoria.png",
  },
  {
    name: "Q-Max Contábil",
    label: "Contabilidade",
    href: "/contabil",
    logo: "/brands/brand-contabil.png",
  },
  {
    name: "Q-Max Talents",
    label: "Pessoas",
    href: "/talents",
    logo: "/brands/brand-talents.png",
  },
  {
    name: "Q-Max Technology",
    label: "Tecnologia",
    href: "/technology",
    logo: "/brands/brand-technology.png",
  },
  {
    name: "Lagerhaus",
    label: "Estrutura",
    href: "https://lagerhaus.work",
    logo: "/brands/lagerhaus-v2.png",
  },
];

export const products = [
  {
    name: "QXBACK",
    label: "Indicações e bonificação",
    href: "https://qxback.com.br",
    logo: "/brands/qxback.png",
  },
  {
    name: "FINORA",
    label: "Inteligência financeira",
    href: "/finora",
    logo: "/brands/finora-logo-horizontal.png",
  },
  {
    name: "QXSIGN",
    label: "Documentação digital",
    href: "https://qxsign.com.br",
    logo: null,
  },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [activeSection, setActiveSection] = useState<
    "inicio" | "sobre" | "socios" | "empresas" | "produtos" | "contato"
  >("inicio");
  const [mobileSection, setMobileSection] = useState<
    "empresas" | "produtos" | null
  >(null);

  const pathname = usePathname();

  const brandLogos: Record<string, string> = {
    "/auditoria": "/brands/auditoria-branco.png",
    "/contabil": "/brands/qx-contabil-branco.png",
    "/talents": "/brands/talents-branco.png",
    "/technology": "/brands/qmax-technology-white.png",
    "/lagerhaus": "/brands/lagerhaus-v2.png",
  };

  const currentLogo = brandLogos[pathname || ""] || "/brands/grupo-qmax-white.png";


  function goToItem(
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: "empresas" | "produtos",
    itemName: string
  ) {
    const href = event.currentTarget.getAttribute('href');
    // Links externos e páginas internas (ex.: /finora) navegam normalmente;
    // só âncoras da home (/#...) rolam até a seção.
    if (href && !href.startsWith('/#')) {
      setMobileOpen(false);
      return;
    }
    
    event.preventDefault();

    setMobileOpen(false);
    setMobileSection(null);

    const section = document.getElementById(sectionId);

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

      const targetName = normalize(itemName);

      const target = buttons.find((button) => {
        const buttonName = normalize(
          button.textContent || ""
        );

        return (
          buttonName.includes(targetName) ||
          targetName.includes(buttonName)
        );
      });

      target?.click();
    }, 500);
  }

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

  
  return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);


  useEffect(() => {
    // Os links do menu apontam para seções da home (/#sobre, /#contato…).
    // Nas páginas internas há seções com os mesmos ids (ex.: /auditoria
    // tem #sobre e #contato), e o menu destacava itens que não são dali.
    if (pathname !== "/") {
      setActiveSection("inicio");
      return;
    }

    const ids = [
      "inicio",
      "sobre",
      "socios",
      "empresas",
      "produtos",
      "contato",
    ] as const;

    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio
          );

        if (!visible.length) return;

        const id = visible[0].target.id as (typeof ids)[number];

        setActiveSection(id);
      },
      {
        root: null,
        rootMargin: "-22% 0px -55% 0px",
        threshold: [0.05, 0.15, 0.3, 0.5],
      }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);
  function closeMenu() {
    setMobileOpen(false);
    setMobileSection(null);
  }

  // A FINORA tem cabeçalho próprio (components/FinoraHeader).
  if (pathname === "/finora") return null;

  return (
    <header
      className={`nav15 ${
        scrolled ? "nav15--scrolled" : ""
      } nav15--${pathname?.replace("/", "") || "home"}`}
    >
      <div className="container nav15__inner">
        <a
          href="/#inicio"
          className="nav15__brand"
          aria-label="Grupo Q-Max"
          onClick={closeMenu}
        >
          <Image
            src={currentLogo}
            alt="Grupo Q-Max"
            width={150}
            height={82}
            priority
            style={{
              width: "auto",
              height: "auto",
              maxHeight: "44px",
            }}
          />
        </a>

        <nav
          className="nav15__desktop"
          aria-label="Navegação principal"
        >
          <a
            href="/#sobre"
            className={
              activeSection === "sobre"
                ? "is-active"
                : undefined
            }
          >
            Sobre
          </a>

          <a
            href="/#socios"
            className={
              activeSection === "socios"
                ? "is-active"
                : undefined
            }
          >
            Nosso Time
          </a>

          <div className="nav15__item">
            <button
              type="button"
              className={
                activeSection === "empresas"
                  ? "is-active"
                  : undefined
              }
            >
              Empresas
              <ChevronDown size={14} />
            </button>

            <div className="nav15__dropdown">
              <div className="nav15__dropdownHead">
                <span>ECOSSISTEMA</span>
                <strong>
                  Empresas que se conectam.
                </strong>
              </div>

              <div className="nav15__dropdownList">
                {companies.map((company, index) => (
                  <a
                    key={company.name}
                    href={company.href}
                    target={company.href.startsWith("http") ? "_blank" : undefined}
                    rel={company.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    onClick={closeMenu}
                  >
                    <span>
                      0{index + 1}
                    </span>

                    <div className="nav15__brandThumb">
                      <Image
                        src={company.logo}
                        alt=""
                        width={84}
                        height={42}
                      />
                    </div>

                    <div>
                      <strong>
                        {company.name}
                      </strong>

                      <small>
                        {company.label}
                      </small>
                    </div>

                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="nav15__item">
            <button
              type="button"
              className={
                activeSection === "produtos"
                  ? "is-active"
                  : undefined
              }
            >
              Produtos
              <ChevronDown size={14} />
            </button>

            <div className="nav15__dropdown nav15__dropdown--products">
              <div className="nav15__dropdownHead">
                <span>SOLUÇÕES DIGITAIS</span>
                <strong>
                  Produtos do ecossistema.
                </strong>
              </div>

              <div className="nav15__dropdownList">
                {products.map((product, index) => (
                  <a
                    key={product.name}
                    href={product.href}
                    target={product.href.startsWith("http") ? "_blank" : undefined}
                    rel={product.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    onClick={(event) =>
                      goToItem(
                        event,
                        "produtos",
                        product.name
                      )
                    }
                  >
                    <span>
                      0{index + 1}
                    </span>

                    <div
                      className={`nav15__brandThumb nav15__brandThumb--${product.name.toLowerCase()}`}
                    >
                      {product.logo ? (
                        <Image
                          src={product.logo}
                          alt={product.name}
                          width={100}
                          height={52}
                        />
                      ) : (
                        <strong className="nav15__qxsignMark">
                          QX<span>SIGN</span>
                        </strong>
                      )}
                    </div>

                    <div>
                      <strong>
                        <QmaxInline>{product.name}</QmaxInline>
                      </strong>

                      <small>
                        {product.label}
                      </small>
                    </div>

                    <ArrowUpRight size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <a
            href="/#contato"
            className={
              activeSection === "contato"
                ? "is-active"
                : undefined
            }
          >
            Contato
          </a>
        </nav>

        <a
          href="/#contato"
          className="nav15__cta"
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("open-qmax-modal"));
          }}
        >
          <span>Fale com a Q-Max</span>
          <ArrowUpRight size={16} />
        </a>

        <button
          type="button"
          className="nav15__mobileTrigger"
          aria-label={
            mobileOpen
              ? "Fechar menu"
              : "Abrir menu"
          }
          aria-expanded={mobileOpen}
          onClick={() =>
            setMobileOpen((value) => !value)
          }
        >
          {mobileOpen ? (
            <X size={22} />
          ) : (
            <Menu size={22} />
          )}
        </button>
      </div>

      <div
        className={`nav15__mobile ${
          mobileOpen ? "is-open" : ""
        }`}
      >
        <div className="nav15__mobileInner">
          <div className="nav15__mobileTop">
            <span>MENU</span>
            <small>GRUPO <QmaxInline>Q-MAX</QmaxInline></small>
          </div>

          <a
            href="/#sobre"
            onClick={closeMenu}
          >
            <span>01</span>
            <strong>Sobre</strong>
          </a>

          <a
            href="/#socios"
            onClick={closeMenu}
          >
            <span>02</span>
            <strong>Nosso Time</strong>
          </a>

          <button
            type="button"
            onClick={() =>
              setMobileSection(
                mobileSection === "empresas"
                  ? null
                  : "empresas"
              )
            }
          >
            <span>03</span>
            <strong>Empresas</strong>

            <ChevronDown
              size={17}
              className={
                mobileSection === "empresas"
                  ? "rotate"
                  : ""
              }
            />
          </button>

          <div
            className={`nav15__mobileSub ${
              mobileSection === "empresas"
                ? "open"
                : ""
            }`}
          >
            {companies.map((company) => (
              <a
                key={company.name}
                href={company.href}
                target={company.href.startsWith("http") ? "_blank" : undefined}
                rel={company.href.startsWith("http") ? "noopener noreferrer" : undefined}
                onClick={closeMenu}
              >
                {company.name}
              </a>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setMobileSection(
                mobileSection === "produtos"
                  ? null
                  : "produtos"
              )
            }
          >
            <span>04</span>
            <strong>Produtos</strong>

            <ChevronDown
              size={17}
              className={
                mobileSection === "produtos"
                  ? "rotate"
                  : ""
              }
            />
          </button>

          <div
            className={`nav15__mobileSub ${
              mobileSection === "produtos"
                ? "open"
                : ""
            }`}
          >
            {products.map((product) => (
              <a
                key={product.name}
                href={product.href}
                target={product.href.startsWith("http") ? "_blank" : undefined}
                rel={product.href.startsWith("http") ? "noopener noreferrer" : undefined}
                onClick={(event) =>
                  goToItem(
                    event,
                    "produtos",
                    product.name
                  )
                }
              >
                <QmaxInline>{product.name}</QmaxInline>
              </a>
            ))}
          </div>

          <a
            href="/#contato"
            onClick={closeMenu}
          >
            <span>05</span>
            <strong>Contato</strong>
          </a>

          <a
            href="/#contato"
            onClick={closeMenu}
            className="nav15__mobileCta"
          >
            Fale com a Q-Max
            <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
    </header>
  );
}
