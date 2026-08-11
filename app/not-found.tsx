import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <main className="notfound24">
      <div className="notfound24__glow" aria-hidden="true" />

      <div className="container notfound24__inner">
        <span className="eyebrow">
          <Sparkles size={13} />
          GRUPO Q-MAX
        </span>

        <strong className="notfound24__number">404</strong>

        <h1>
          Esta rota não faz
          <br />
          parte do <em>ecossistema.</em>
        </h1>

        <p>
          A página que você tentou acessar não existe ou foi movida.
        </p>

        <Link href="/">
          <ArrowLeft size={17} />
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}