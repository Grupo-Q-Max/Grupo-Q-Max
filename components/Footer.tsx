import Image from "next/image";

export function Footer() {
  return (
    <footer className="finish-footer">
      <div className="container finish-footer__top">
        <div className="finish-footer__brand">
          <Image
            src="/brands/grupo-qmax-white.png"
            alt="Grupo Q-Max"
            width={150}
            height={76}
            style={{
              width: "auto",
              height: "auto",
            }}
          />

          <p>
            Tecnologia, inovação e atitude conectando empresas,
            pessoas e soluções.
          </p>
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

            <a href="#empresas">Q-Max Auditoria</a>
            <a href="#empresas">Q-Max Contábil</a>
            <a href="#empresas">Q-Max Talents</a>
            <a href="#empresas">Q-Max Technology</a>
            <a href="#empresas">Lagerhaus</a>
          </div>

          <div>
            <strong>PRODUTOS</strong>

            <a href="#produtos">QXBACK</a>
            <a href="#produtos">QXSIGN</a>
            <a href="#produtos">FINORA</a>
          </div>
        </div>
      </div>

      <div className="container finish-footer__bottom">
        <span>© 2026 Grupo Q-Max.</span>

        <div>
          <span>São Bernardo do Campo · SP</span>
          <i />
          <span>Tecnologia, Inovação, Atitude.</span>
        </div>
      </div>
    </footer>
  );
}