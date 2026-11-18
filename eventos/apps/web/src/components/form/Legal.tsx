export const PRIVACY_POLICY_URL = "https://grupoqmax.com.br/politica-de-privacidade";
export const TERMS_URL = "https://grupoqmax.com.br/termos-de-uso";
export const REGULATION_URL = "https://grupoqmax.com.br/regulamento-finora";

const link = "font-semibold underline underline-offset-2 hover:text-white";

// Texto do aceite obrigatório (LGPD): links abrem em nova aba para não perder o formulário.
export function PrivacyConsentText() {
  return (
    <>
      Li e aceito a{" "}
      <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className={link}>
        Política de Privacidade
      </a>{" "}
      e o{" "}
      <a href={REGULATION_URL} target="_blank" rel="noopener noreferrer" className={link}>
        Regulamento
      </a>
      , e autorizo o uso dos meus dados para esta ativação e o sorteio. (obrigatório)
    </>
  );
}

export function LegalFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-5 py-4 text-xs text-slate-400">
      <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">
        Política de Privacidade
      </a>
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">
        Termos de Uso
      </a>
      <a href={REGULATION_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">
        Regulamento
      </a>
    </footer>
  );
}
