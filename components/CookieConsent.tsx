"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, Shield, Check, Settings2, X, Lock } from "lucide-react";
import "./cookie-consent.css";

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  timestamp: string;
  version: number;
}

const STORAGE_KEY = "qmax_cookie_consent_v1";
const CURRENT_VERSION = 1;

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    functional: false,
    timestamp: "",
    version: CURRENT_VERSION,
  });

  // Aplica o consentimento ao Google Consent Mode (GA4 / GTM)
  const applyGtagConsent = (prefs: CookiePreferences) => {
    if (typeof window !== "undefined" && typeof (window as unknown as { gtag?: Function }).gtag === "function") {
      const g = (window as unknown as { gtag: Function }).gtag;
      g("consent", "update", {
        analytics_storage: prefs.analytics ? "granted" : "denied",
        ad_storage: prefs.functional ? "granted" : "denied",
        ad_user_data: prefs.functional ? "granted" : "denied",
        ad_personalization: prefs.functional ? "granted" : "denied",
        functionality_storage: prefs.functional ? "granted" : "denied",
        security_storage: "granted",
      });
    }
  };

  useEffect(() => {
    setMounted(true);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CookiePreferences;
        if (parsed && parsed.version === CURRENT_VERSION) {
          setPreferences(parsed);
          applyGtagConsent(parsed);
          setShowBanner(false);
          return;
        }
      }
    } catch {
      // localStorage indisponível ou parse falhou
    }

    // Se não há consentimento salvo, exibe o banner
    setShowBanner(true);
  }, []);

  // Escuta evento global para reabrir configurações de cookies de qualquer link
  useEffect(() => {
    const handleOpen = () => setShowModal(true);
    window.addEventListener("open-cookie-preferences", handleOpen);
    return () => window.removeEventListener("open-cookie-preferences", handleOpen);
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    const updated: CookiePreferences = {
      ...prefs,
      necessary: true,
      timestamp: new Date().toISOString(),
      version: CURRENT_VERSION,
    };

    setPreferences(updated);
    applyGtagConsent(updated);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      // Salva cookie persistente por 1 ano
      document.cookie = `qmax_cookie_consent=1; max-age=${365 * 24 * 3600}; path=/; SameSite=Lax; Secure`;
    } catch {
      // Fallback
    }

    setShowBanner(false);
    setShowModal(false);
  };

  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      functional: true,
      timestamp: "",
      version: CURRENT_VERSION,
    });
  };

  const handleRejectNonEssential = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      functional: false,
      timestamp: "",
      version: CURRENT_VERSION,
    });
  };

  if (!mounted) return null;

  return (
    <>
      {/* Banner Inicial de Consentimento */}
      {showBanner && !showModal && (
        <section
          className="qmax-cookie-banner"
          role="region"
          aria-label="Aviso de Privacidade e Gestão de Cookies"
        >
          <div className="qmax-cookie-content">
            <div className="qmax-cookie-text-area">
              <div className="qmax-cookie-header">
                <span className="qmax-cookie-badge">
                  <Shield size={13} /> LGPD &amp; Privacidade
                </span>
                <h3 className="qmax-cookie-title">Sua privacidade e segurança de dados</h3>
              </div>
              <p className="qmax-cookie-desc">
                Utilizamos cookies essenciais para garantir o funcionamento seguro do site e, com o seu consentimento,
                cookies estatísticos para aprimorar sua experiência, em estrita conformidade com a Lei Geral de
                Proteção de Dados (Lei 13.709/18). Consulte nossa{" "}
                <Link href="/politica-de-privacidade">Política de Privacidade</Link> e nossa{" "}
                <Link href="/politica-de-cookies">Política de Cookies</Link>.
              </p>
            </div>

            <div className="qmax-cookie-actions">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="qmax-cookie-btn qmax-cookie-btn-secondary"
                id="btn-cookies-necessarios"
              >
                Apenas Necessários
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
                onClick={handleAcceptAll}
                className="qmax-cookie-btn qmax-cookie-btn-primary"
                id="btn-cookies-aceitar-todos"
              >
                <Check size={16} /> Aceitar Todos
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Botão Flutuante Discreto para Reabrir Preferências (LGPD Art. 8º §5º) */}
      {!showBanner && (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="qmax-cookie-floating-toggle"
          aria-label="Gerenciar Preferências de Cookies e Privacidade"
          title="Preferências de Cookies e LGPD"
        >
          <Cookie size={20} />
        </button>
      )}

      {/* Modal Detalhado de Personalização de Cookies */}
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
                <Shield size={19} color="#14d0c1" /> Preferências de Privacidade &amp; Cookies
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="qmax-cookie-modal-close"
                aria-label="Fechar configurações de cookies"
              >
                <X size={20} />
              </button>
            </div>

            <div className="qmax-cookie-modal-body">
              <p className="qmax-cookie-modal-intro">
                O Grupo Q-Max respeita sua autonomia. Você pode escolher quais categorias de cookies autoriza neste
                dispositivo. Cookies essenciais não podem ser desativados pois são indispensáveis para segurança,
                autenticação e prevenção a fraudes (LGPD Art. 7º, IX).
              </p>

              <div className="qmax-cookie-categories">
                {/* 1. Necessários */}
                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <Lock size={16} color="#14d0c1" />
                      <span>Cookies Estritamente Necessários</span>
                      <span className="qmax-cookie-category-badge always">Sempre Ativo</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Cookies Necessários (Sempre Ativos)">
                      <input type="checkbox" checked disabled />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Garantem a integridade da navegação, tokens de proteção contra CSRF, equilíbrio de carga e
                    autenticação em áreas restritas. Sem eles, o site não opera adequadamente.
                  </p>
                </div>

                {/* 2. Estatísticos / Analíticos */}
                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <Cookie size={16} color="#4df8ec" />
                      <span>Cookies Analíticos e de Desempenho</span>
                      <span className="qmax-cookie-category-badge optional">Opcional</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Permitir Cookies Analíticos">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                      />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Permitem contabilizar visitas e origens de tráfego de maneira 100% anonimizada e agregada através do
                    Google Analytics GA4, mensurando a performance das nossas páginas e serviços institucionais.
                  </p>
                </div>

                {/* 3. Funcionais */}
                <div className="qmax-cookie-category-item">
                  <div className="qmax-cookie-category-head">
                    <div className="qmax-cookie-category-title">
                      <Settings2 size={16} color="#a45cff" />
                      <span>Cookies Funcionais e de Preferências</span>
                      <span className="qmax-cookie-category-badge optional">Opcional</span>
                    </div>
                    <label className="qmax-cookie-switch" aria-label="Permitir Cookies Funcionais">
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                      />
                      <span className="qmax-cookie-slider" />
                    </label>
                  </div>
                  <p className="qmax-cookie-category-desc">
                    Memorizam suas preferências de navegação (como temas visuais, opções de formulário e idioma),
                    proporcionando uma experiência personalizada ao retornar ao site.
                  </p>
                </div>
              </div>
            </div>

            <div className="qmax-cookie-modal-footer">
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="qmax-cookie-btn qmax-cookie-btn-secondary"
              >
                Rejeitar Opcionais
              </button>
              <button
                type="button"
                onClick={() => saveConsent(preferences)}
                className="qmax-cookie-btn qmax-cookie-btn-primary"
              >
                Salvar Minhas Escolhas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
