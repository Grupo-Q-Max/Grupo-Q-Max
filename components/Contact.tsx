import { QmaxInline } from "@/components/QmaxBrandText";
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
              começam com um
              <br />
              <em>bom relacionamento.</em>
            </h2>

            <p>
              O Grupo <QmaxInline>Q-Max</QmaxInline> conecta diferentes especialidades para apoiar
              negócios com mais estrutura, clareza e capacidade de execução.
            </p>

            <a
              className="finish-contact__primary"
              href="mailto:contato@grupoqmax.com.br"
            >
              Fale com a <QmaxInline>Q-Max</QmaxInline>
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
              Venha conhecer a <em><QmaxInline>Q-Max</QmaxInline><span className="qmax-punctuation">.</span></em>
            </h3>

            <p>
              R. Frei Gaspar, 941 · Conjunto 103-105 · Centro, São Bernardo do Campo/SP
            </p>
            <small style={{ color: "#71717a", fontSize: "0.8rem", display: "block", marginTop: 4 }}>
              🕒 Horário de Atendimento: Segunda a Sexta das 08h às 18h
            </small>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <a
              href="https://www.google.com/maps/search/?api=1&query=R.+Frei+Gaspar,+941,+Sao+Bernardo+do+Campo,+SP"
              target="_blank"
              rel="noopener noreferrer"
              className="contact42__mapButton"
            >
              Google Maps
              <ArrowUpRight size={15} />
            </a>
            <a
              href="https://waze.com/ul?q=Rua+Frei+Gaspar+941+Sao+Bernardo+do+Campo"
              target="_blank"
              rel="noopener noreferrer"
              className="contact42__mapButton"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            >
              Waze
              <ArrowUpRight size={15} />
            </a>
          </div>
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
              <small>GRUPO <QmaxInline>Q-MAX</QmaxInline></small>
              <strong>São Bernardo do Campo</strong>
            </div>
          </div>
        </div>
      </div>
</section>
  );
}
