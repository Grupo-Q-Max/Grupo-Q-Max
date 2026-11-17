import type { Metadata } from "next";
import Link from "next/link";
import { Cookie, Shield, Building, FileText } from "lucide-react";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";
import { legal } from "@/data/site";
import "@/app/legal.css";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description: "Quais cookies e armazenamentos o site do Grupo Q-Max usa, para quê, por quanto tempo e como mudar suas escolhas.",
  alternates: { canonical: "/politica-de-cookies" },
};

/*
 * Must match the code: lib/consent.ts (consent storage), lib/auth.ts (session cookies),
 * components/GoogleAnalytics.tsx and components/DeferredGoogleMap.tsx (third parties).
 */
const items = [
  {
    name: "qmax_cookie_consent_v2",
    kind: "Armazenamento local (localStorage)",
    category: "Necessário",
    provider: legal.groupName,
    purpose: "Guarda suas escolhas neste aviso para não perguntar de novo a cada página.",
    duration: "Até você limpar os dados do navegador ou a política mudar de versão",
  },
  {
    name: "qmax_crm_session",
    kind: "Cookie HttpOnly",
    category: "Necessário (só áreas restritas)",
    provider: legal.groupName,
    purpose: "Mantém o login de colaboradores no CRM. Não é criado para visitantes do site.",
    duration: "7 dias",
  },
  {
    name: "qmax_admin",
    kind: "Cookie HttpOnly",
    category: "Necessário (só áreas restritas)",
    provider: legal.groupName,
    purpose: "Mantém o login no painel administrativo. Não é criado para visitantes do site.",
    duration: "7 dias",
  },
  {
    name: "_ga, _ga_*",
    kind: "Cookie",
    category: "Estatísticas (opcional)",
    provider: "Google LLC (Google Analytics 4)",
    purpose: "Distingue visitas para gerar estatísticas de uso. Só é criado depois que você autoriza.",
    duration: "Até 2 anos (apagado quando você revoga)",
  },
  {
    name: "Contador de visitas",
    kind: "Registro no servidor (sem cookie)",
    category: "Estatísticas (opcional)",
    provider: legal.groupName,
    purpose: "Registra a página visitada e o domínio de origem, sem IP e sem identificar você. Só com autorização.",
    duration: `${legal.retention.pageVisitsMonths} meses`,
  },
  {
    name: "NID e outros do Google",
    kind: "Cookie de terceiro",
    category: "Conteúdo de terceiros (opcional)",
    provider: "Google LLC (Google Maps)",
    purpose: "Criados pelo Google quando o mapa da seção de contato é carregado.",
    duration: "Definida pelo Google (até 6 meses)",
  },
];

export default function PoliticaDeCookiesPage() {
  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Cookie size={14} /> Cookies e armazenamento
          </div>
          <h1 className="qmax-legal-title">Política de Cookies</h1>
          <p className="qmax-legal-subtitle">
            O que o site grava no seu navegador, para quê e como você controla isso.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileText size={14} /> Versão {legal.privacyVersion}
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> {legal.groupName}
            </span>
            <span className="qmax-legal-meta-item">
              <Shield size={14} /> Atualizado em {legal.lastUpdated}
            </span>
          </div>
        </header>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <CookiePreferencesButton label="Gerenciar minhas preferências" />
        </div>

        <article className="qmax-legal-body">
          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. O que são cookies</h2>
            <p>
              Cookies e armazenamento local são pequenos dados que um site grava no seu navegador para lembrar algo entre
              uma página e outra, como uma escolha ou um login.
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Como usamos</h2>
            <ul>
              <li>
                <strong>Necessários:</strong> sempre ativos, porque o site não funciona sem eles. Guardam sua escolha de
                cookies e, nas áreas restritas, o login.
              </li>
              <li>
                <strong>Estatísticas (opcional):</strong> Google Analytics 4 e nosso contador de visitas. Desligados até
                você autorizar. O script do Google nem é carregado antes disso.
              </li>
              <li>
                <strong>Conteúdo de terceiros (opcional):</strong> mapa do Google Maps. Sem autorização, o mapa só carrega
                se você clicar nele.
              </li>
            </ul>
            <p>Não usamos cookies de publicidade, remarketing ou redes sociais.</p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Lista completa</h2>
            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Tipo</th>
                    <th>Categoria</th>
                    <th>Quem grava</th>
                    <th>Para quê</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.name}>
                      <td><code>{item.name}</code></td>
                      <td>{item.kind}</td>
                      <td>{item.category}</td>
                      <td>{item.provider}</td>
                      <td>{item.purpose}</td>
                      <td>{item.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. Como mudar ou revogar</h2>
            <p>
              Use o botão desta página, o link “Preferências de Cookies” no rodapé ou o ícone de cookie no canto da tela.
              Ao revogar as estatísticas, apagamos os cookies do Google Analytics do seu navegador. Você também pode
              apagar ou bloquear cookies nas configurações do navegador; bloquear os necessários pode impedir o login nas
              áreas restritas.
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Base legal e contato</h2>
            <p>
              Os opcionais dependem do seu consentimento (art. 7º, I da LGPD). Os necessários se apoiam no legítimo
              interesse de manter o site funcionando e seguro (art. 7º, IX). Dúvidas:{" "}
              <a href={`mailto:${legal.dpoEmail}`}><strong>{legal.dpoEmail}</strong></a>. Mais detalhes na{" "}
              <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
