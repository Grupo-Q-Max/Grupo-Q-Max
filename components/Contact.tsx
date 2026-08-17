import { DeferredGoogleMap } from "./DeferredGoogleMap";
import {
  ArrowUpRight,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";

export function Contact() {
  return (
    <section id="contato" className="finish-contact">
      <div className="finish-contact__ambient finish-contact__ambient--a" />
      <div className="finish-contact__ambient finish-contact__ambient--b" />

      <div className="container">
        <div
          className="finish-contact__panel"
        >
          <div className="finish-contact__copy">
            <span className="eyebrow">
              <Sparkles size={13} />
              PRÓXIMO PASSO
            </span>

            <h2>
              Grandes movimentos
              <br />
              começam com uma
              <br />
              <em>boa conversa.</em>
            </h2>

            <p>
              O Grupo Q-Max conecta diferentes especialidades para apoiar
              negócios com mais estrutura, clareza e capacidade de execução.
            </p>

            <a
              className="finish-contact__primary"
              href="mailto:contato@grupoqmax.com.br"
            >
              Fale com a Q-Max
              <ArrowUpRight size={18} />
            </a>
          </div>

          <div className="finish-contact__details">
            <a href="mailto:contato@grupoqmax.com.br">
              <div className="finish-contact__icon">
                <Mail size={18} />
              </div>

              <span>
                <small>E-MAIL</small>
                <strong>contato@grupoqmax.com.br</strong>
              </span>

              <ArrowUpRight size={16} />
            </a>

            <a href="tel:+551128976514">
              <div className="finish-contact__icon">
                <Phone size={18} />
              </div>

              <span>
                <small>TELEFONE</small>
                <strong>(11) 2897-6514</strong>
              </span>

              <ArrowUpRight size={16} />
            </a>

            <div>
              <div className="finish-contact__icon">
                <MapPin size={18} />
              </div>

              <span>
                <small>ENDEREÇO</small>
                <strong>
                  R. Frei Gaspar, 941 · São Bernardo do Campo/SP
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    
      <div
        className="contact42__mapSection"
        data-qmax-map="v42"
      >
        <div className="contact42__mapHead">
          <div>
            <span className="contact42__eyebrow">
              NOSSA LOCALIZAÇÃO
            </span>

            <h3>
              Venha conhecer a <em>Q-Max.</em>
            </h3>

            <p>
              R. Frei Gaspar, 941 · São Bernardo do Campo/SP
            </p>
          </div>

          <a
            href="https://www.google.com/maps/search/?api=1&query=R.+Frei+Gaspar,+941,+Sao+Bernardo+do+Campo,+SP"
            target="_blank"
            rel="noopener noreferrer"
            className="contact42__mapButton"
          >
            Abrir no Google Maps
            <span aria-hidden="true">—</span>
          </a>
        </div>

        <div className="contact42__mapFrame">
          <DeferredGoogleMap />

          <div
            className="contact42__mapShade"
            aria-hidden="true"
          />

          <div className="contact42__mapBadge">
            <span className="contact42__mapDot" />

            <div>
              <small>GRUPO Q-MAX</small>
              <strong>São Bernardo do Campo</strong>
            </div>
          </div>
        </div>
      </div>
</section>
  );
}
