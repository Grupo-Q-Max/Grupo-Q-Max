"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, Shield, Check, Settings2, X, Lock, MapPin, BarChart3 } from "lucide-react";
import { saveConsent, useConsentState, type ConsentState } from "@/lib/consent";
import "./cookie-consent.css";

type Choice = { analytics: boolean; embeds: boolean };

/** Pushes the visitor's choice to Google Consent Mode. Ads signals stay denied: the site runs no ads. */
function applyGtagConsent(state: Choice) {
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  gtag("consent", "update", {
    analytics_storage: state.analytics ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function CookieConsent() {
  const consent = useConsentState();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<Choice>({ analytics: false, embeds: false });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (consent) applyGtagConsent(consent);
  }, [consent]);

  // Footer links and policy pages reopen the preferences with this event
  useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener("open-cookie-preferences", handleOpen);
    return () => window.removeEventListener("open-cookie-preferences", handleOpen);
  }, []);

  useEffect(() => {
    if (showModal) setDraft({ analytics: consent?.analytics ?? false, embeds: consent?.embeds ?? false });
  }, [showModal, consent]);

  const decide = (choice: Choice) => {
    const saved: ConsentState = saveConsent(choice);
    applyGtagConsent(saved);
    setShowModal(false);
  };

  if (!mounted) return null;
  const showBanner = consent === null;

  return (
    <>
      {showBanner && !showModal && (
        <section className="qmax-cookie-banner" role="region" aria-label="Aviso de cookies">
          <div className="qmax-cookie-content">
            <div className="qmax-cookie-text-area">
              <div className="qmax-cookie-header">
                <span className="qmax-cookie-badge">
                  <Shield size={13} /> Privacidade
                </span>
                <h3 className="qmax-cookie-title">Você escolhe o que fica ativo</h3>
              </div>
              <p className="qmax-cookie-desc">
                Usamos apenas o armazenamento necessário para o site funcionar. Com sua autorização, também usamos
                estatísticas de visita (Google Analytics e contador próprio) e o mapa do Google. Nada opcional é
                ativado antes da sua escolha, e você pode mudar de ideia a qualquer momento. Saiba mais na{" "}
                <Link href="/politica-de-privacidade">Política de Privacidade</Link> e na{" "}
                <Link href="/politica-de-cookies">Política de Cookies</Link>.
              </p>
            </div>

            <div className="qmax-cookie-actions">
              <button
                type="button"
                onClick={() => decide({ analytics: false, embeds: false })}
                className="qmax-cookie-btn qmax-cookie-btn-primary"
                id="btn-cookies-necessarios"
              >
                Rejeitar opcionais
              </button>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="qmax-cookie-btn qmax-cookie-btn-ghost"
                id="btn-cookies-personalizar"
              >
                <Settings2 size={15} /> Personalizar
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, embeds: true })}
                className="qmax-cookie-btn qmax-cookie-btn-primary"
                id="btn-cookies-aceitar-todos"
              >
                <Check size={16} /> Aceitar todos
              </button>
            </div>
          </div>
        </section>
      )}

      {!showBanner && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="qmax-cookie-floating-toggle"
          aria-label="Preferências de cookies"
          title="Preferências de cookies"
        >
          <Cookie size={20} />
        </button>
      )}

      {showModal && (
        <div
          className="qmax-cookie-modal-backdrop"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
        >
          <div className="qmax-cookie-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qmax-cookie-modal-header">
              <h3 id="cookie-modal-title">
                <Shield size={19} /> Preferências de cookies
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="qmax-cookie-modal-close"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qmax-cookie-modal-body">
              <p className="qmax-cookie-modal-intro">
                Escolha o que autoriza neste navegador. O armazenamento necessário não pode ser desligado porque o site
                não funciona sem ele. As demais opções dependem do seu consentimento (LGPD, art. 7º, I) e podem ser
                revogadas aqui a qualquer momento.
              </p>

              <div className="qmax-cookie-categories">
                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <Lock size={16} />
                      <span>Necessários</span>
                      <span className="qmax-cookie-category-badge always">Sempre ativo</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Necessários (sempre ativos)">
                      <input type="checkbox" checked disabled />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Guardam sua escolha de cookies e mantêm a sessão de quem entra nas áreas restritas. Não são usados
                    para publicidade nem para identificar visitantes.
                  </p>
                </div>

                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <BarChart3 size={16} />
                      <span>Estatísticas</span>
                      <span className="qmax-cookie-category-badge optional">Opcional</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Permitir estatísticas">
                      <input
                        type="checkbox"
                        checked={draft.analytics}
                        onChange={(e) => setDraft({ ...draft, analytics: e.target.checked })}
                      />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Google Analytics 4 (Google LLC, com possível transferência internacional) e nosso contador de
                    visitas, que registra página, origem e navegador, sem nome, e-mail ou IP. Servem para medir quais
                    páginas e serviços interessam mais.
                  </p>
                </div>

                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <MapPin size={16} />
                      <span>Conteúdo de terceiros</span>
                      <span className="qmax-cookie-category-badge optional">Opcional</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Permitir conteúdo de terceiros">
                      <input
                        type="checkbox"
                        checked={draft.embeds}
                        onChange={(e) => setDraft({ ...draft, embeds: e.target.checked })}
                      />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Mapa do Google Maps na seção de contato. Ao carregar, o Google pode gravar cookies próprios. Sem esta
                    opção, o mapa só abre se você clicar nele.
                  </p>
                </div>
              </div>
            </div>

            <div className="qmax-cookie-modal-footer">
              <button
                type="button"
                onClick={() => decide({ analytics: false, embeds: false })}
                className="qmax-cookie-btn qmax-cookie-btn-secondary"
              >
                Rejeitar opcionais
              </button>
              <button type="button" onClick={() => decide(draft)} className="qmax-cookie-btn qmax-cookie-btn-primary">
                Salvar escolhas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
