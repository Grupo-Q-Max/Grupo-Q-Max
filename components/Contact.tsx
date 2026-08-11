"use client";

import { motion } from "framer-motion";
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
        <motion.div
          className="finish-contact__panel"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{
            duration: 0.72,
            ease: [0.22, 1, 0.36, 1],
          }}
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
        </motion.div>
      </div>
    </section>
  );
}