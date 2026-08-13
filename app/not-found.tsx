import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Package2,
  Sparkles,
} from "lucide-react";

export default function NotFound() {
  return (
    <main className="q404">
      <div className="q404__glow q404__glow--one" />
      <div className="q404__glow q404__glow--two" />

      <div className="q404__grid" aria-hidden="true" />

      <div className="q404__container">
        <Link
          href="/"
          className="q404__brand"
          aria-label="Voltar para o Grupo Q-Max"
        >
          <Image
            src="/brands/grupo-qmax-white.png"
            alt="Grupo Q-Max"
            width={170}
            height={92}
            priority
            sizes="170px"
          />
        </Link>

        <section className="q404__content">
          <div className="q404__eyebrow">
            <Sparkles size={14} />
            ROTA NÃO ENCONTRADA
          </div>

          <div className="q404__number">
            <span>4</span>
            <em>0</em>
            <span>4</span>
          </div>

          <h1>
            Essa página saiu do
            <em> ecossistema.</em>
          </h1>

          <p>
            O endereço que você tentou acessar não existe,
            foi alterado ou não está mais disponível.
            Mas o ecossistema Q-Max continua por aqui.
          </p>

          <div className="q404__actions">
            <Link
              href="/"
              className="q404__primary"
            >
              <ArrowLeft size={17} />
              Voltar ao início
            </Link>

            <Link
              href="/#contato"
              className="q404__secondary"
            >
              Fale com a Q-Max
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>

        <div className="q404__quick">
          <span className="q404__quickLabel">
            OU CONTINUE EXPLORANDO
          </span>

          <div className="q404__quickGrid">
            <Link href="/#empresas">
              <div className="q404__quickIcon">
                <Building2 size={20} />
              </div>

              <div>
                <small>ECOSSISTEMA</small>
                <strong>Conheça nossas empresas</strong>
              </div>

              <ArrowUpRight size={17} />
            </Link>

            <Link href="/#produtos">
              <div className="q404__quickIcon">
                <Package2 size={20} />
              </div>

              <div>
                <small>SOLUÇÕES DIGITAIS</small>
                <strong>Explore nossos produtos</strong>
              </div>

              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>

        <footer className="q404__footer">
          <span>GRUPO Q-MAX</span>
          <span>TECNOLOGIA · INOVAÇÃO · ATITUDE</span>
        </footer>
      </div>
    </main>
  );
}