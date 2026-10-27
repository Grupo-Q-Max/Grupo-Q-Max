"use client";

import Link from "next/link";
import { Cookie, Shield, Lock, Settings2, Sliders, CheckCircle2, ArrowRight, Building, FileText } from "lucide-react";
import "@/app/legal.css";

export default function PoliticaDeCookiesPage() {
  const dataAtualizacao = "27 de Outubro de 2026";

  const handleOpenPreferences = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-cookie-preferences"));
    }
  };

  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        {/* Header */}
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Cookie size={14} /> Transparência e Controle de Rastreamento
          </div>
          <h1 className="qmax-legal-title">Política de Cookies</h1>
          <p className="qmax-legal-subtitle">
            Entenda detalhadamente como o Grupo Q-Max utiliza cookies e tecnologias de armazenamento local para
            assegurar a integridade do site, proteger seus dados e garantir sua plena autonomia de escolha conforme a LGPD.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileText size={14} /> Versão 2.4
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> Grupo Q-Max Consolidado
            </span>
            <span className="qmax-legal-meta-item">
              <Shield size={14} /> Atualizado em: {dataAtualizacao}
            </span>
          </div>
        </header>

        {/* Botão de Destaque para Gerenciar Cookies */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <button
            type="button"
            onClick={handleOpenPreferences}
            className="qmax-legal-btn"
            style={{ fontSize: "1rem", padding: "14px 28px" }}
          >
            <Sliders size={18} />
            <span>Gerenciar Minhas Preferências de Cookies</span>
          </button>
        </div>

        {/* Sumário */}
        <nav className="qmax-legal-index" aria-label="Índice dos Cookies">
          <div className="qmax-legal-index-title">
            <Cookie size={16} color="#14d0c1" /> Índice da Política de Cookies
          </div>
          <ul className="qmax-legal-index-list">
            <li><a href="#o-que-sao">1. O que são Cookies?</a></li>
            <li><a href="#por-que-usamos">2. Por que utilizamos Cookies?</a></li>
            <li><a href="#categorias">3. Categorias de Cookies Utilizados</a></li>
            <li><a href="#tabela-cookies">4. Tabela Transparente de Cookies</a></li>
            <li><a href="#google-consent">5. Google Consent Mode v2</a></li>
            <li><a href="#como-gerenciar">6. Como gerenciar nos navegadores</a></li>
            <li><a href="#contato">7. Dúvidas e Contato com o DPO</a></li>
          </ul>
        </nav>

        {/* Conteúdo */}
        <article className="qmax-legal-body">
          {/* Seção 1 */}
          <section id="o-que-sao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. O que são Cookies?</h2>
            <p>
              Cookies são pequenos arquivos de texto transmitidos e salvos no seu computador, tablet ou smartphone quando
              você visita um site. Eles permitem que o portal memorize informações sobre a sua visita (como idioma
              preferido, opções de navegação e autenticação de segurança), facilitando o seu próximo acesso e tornando a sua
              experiência mais rápida, estável e agradável.
            </p>
          </section>

          {/* Seção 2 */}
          <section id="por-que-usamos" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Por que utilizamos Cookies?</h2>
            <p>
              No Grupo Q-Max, os cookies são empregados com propósitos estritamente técnicos, operacionais e de transparência:
            </p>
            <ul>
              <li><strong>Segurança e Autenticação:</strong> Validar sessões de usuários autorizados e prevenir ataques de injeção e CSRF;</li>
              <li><strong>Desempenho e Medição:</strong> Monitorar métricas agregadas de velocidade e volume de tráfego, sem identificar individualmente os visitantes;</li>
              <li><strong>Personalização:</strong> Preservar suas preferências de tema visual (claro/escuro) e choices de consentimento de privacidade.</li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section id="categorias" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Categorias de Cookies Utilizados</h2>
            <p>Classificamos nossos cookies em três grupos fundamentais:</p>

            <h3 className="qmax-legal-subheading">A) Cookies Estritamente Necessários (Essenciais)</h3>
            <p>
              São essenciais para que o site funcione corretamente. Eles habilitam funcionalidades centrais, como navegação
              segura, balanceamento de requisições e armazenamento do próprio estado de consentimento. Por lei (LGPD Art. 7º,
              IX), esses cookies não dependem de autorização prévia e não podem ser desligados nos sistemas do site.
            </p>

            <h3 className="qmax-legal-subheading">B) Cookies Analíticos e de Desempenho (Opcionais)</h3>
            <p>
              Coletam dados anonimizados sobre como os visitantes interagem com nossas páginas (quais links são mais clicados,
              tempo de permanência e eventuais páginas com erro). Os dados são processados de forma estatística agregada via
              Google Analytics GA4, auxiliando nossa equipe de engenharia e produto a aprimorar o portal continuamente.
            </p>

            <h3 className="qmax-legal-subheading">C) Cookies Funcionais (Opcionais)</h3>
            <p>
              Permitem que o site se recorde de preferências registradas pelo usuário para oferecer recursos customizados e
              facilidades na navegação.
            </p>
          </section>

          {/* Seção 4 */}
          <section id="tabela-cookies" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. Tabela Transparente de Cookies e Armazenamento</h2>
            <p>Abaixo detalhamos os principais identificadores técnicos utilizados:</p>

            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Identificador</th>
                    <th>Categoria</th>
                    <th>Provedor</th>
                    <th>Finalidade Técnica</th>
                    <th>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>qmax_cookie_consent_v1</code></td>
                    <td>Necessário</td>
                    <td>Grupo Q-Max</td>
                    <td>Armazena no navegador as preferências de consentimento de cookies selecionadas pelo usuário.</td>
                    <td>1 ano (persistente)</td>
                  </tr>
                  <tr>
                    <td><code>qmax_crm_session</code></td>
                    <td>Necessário</td>
                    <td>Grupo Q-Max</td>
                    <td>Cookie seguro HttpOnly que mantém autenticada a sessão do colaborador/consultor nas áreas restritas.</td>
                    <td>Sessão / 7 dias</td>
                  </tr>
                  <tr>
                    <td><code>qmax_admin</code></td>
                    <td>Necessário</td>
                    <td>Grupo Q-Max</td>
                    <td>Autenticação administrativa com assinatura criptográfica HMAC.</td>
                    <td>Sessão</td>
                  </tr>
                  <tr>
                    <td><code>_ga</code> / <code>_ga_*</code></td>
                    <td>Analítico</td>
                    <td>Google Analytics (GA4)</td>
                    <td>Gera estatísticas agregadas e anônimas de uso das páginas institucionais (condicionado a consentimento).</td>
                    <td>Até 2 anos</td>
                  </tr>
                  <tr>
                    <td><code>theme</code></td>
                    <td>Funcional</td>
                    <td>Grupo Q-Max</td>
                    <td>Memoriza a preferência de tema visual (claro ou escuro) do usuário.</td>
                    <td>Persistente</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Seção 5 */}
          <section id="google-consent" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Integração com Google Consent Mode v2</h2>
            <p>
              Nosso portal adota o padrão internacional mais avançado de conformidade digital: o{" "}
              <strong>Google Consent Mode v2</strong>. Isso significa que, por padrão, antes de qualquer clique do visitante,
              todos os identificadores de publicidade e medição estatística permanecem em estado de bloqueio absoluto
              (<code>denied</code>). Somente se você clicar expressamente em &quot;Aceitar Todos&quot; ou autorizar na aba de
              personalização, o envio de telemetria analítica é ativado (<code>granted</code>).
            </p>
          </section>

          {/* Seção 6 */}
          <section id="como-gerenciar" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">6. Como gerenciar cookies em seu navegador</h2>
            <p>
              Além de utilizar o nosso gerenciador de preferências a qualquer momento (clicando no ícone flutuante de cookie no
              canto inferior da tela), você também pode bloquear, recusar ou excluir cookies diretamente nas configurações do seu
              navegador de internet:
            </p>
            <ul>
              <li><strong>Google Chrome:</strong> Configurações &gt; Privacidade e segurança &gt; Cookies e outros dados do site;</li>
              <li><strong>Microsoft Edge:</strong> Configurações &gt; Cookies e permissões do site &gt; Gerenciar e excluir cookies;</li>
              <li><strong>Mozilla Firefox:</strong> Opções &gt; Privacidade e Segurança &gt; Cookies e dados de sites;</li>
              <li><strong>Apple Safari:</strong> Preferências &gt; Privacidade &gt; Bloquear todos os cookies.</li>
            </ul>
            <p>
              <em>Atenção: Ao desativar todos os cookies pelo navegador (inclusive os essenciais), algumas funcionalidades
              críticas de segurança e autenticação do portal podem não funcionar corretamente.</em>
            </p>
          </section>

          {/* Seção 7 */}
          <section id="contato" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">7. Dúvidas e Contato com o DPO</h2>
            <p>
              Se você tiver dúvidas sobre nossa Política de Cookies ou desejar esclarecimentos adicionais sobre a forma como
              protegemos seus dados, entre em contato diretamente com o nosso Encarregado pelo Tratamento de Dados Pessoais
              (DPO):
            </p>
            <div className="qmax-legal-callout">
              <div className="qmax-legal-callout-title">
                <Shield size={16} color="#14d0c1" /> Encarregado de Dados (DPO) — Grupo Q-Max
              </div>
              <p style={{ margin: 0 }}>
                E-mail: <a href="mailto:dpo@grupoqmax.com.br"><strong>dpo@grupoqmax.com.br</strong></a><br />
                Atendimento: Segunda a sexta-feira, das 09h às 18h (Horário de Brasília).
              </p>
            </div>
          </section>
        </article>

        {/* Rodapé com Navegação */}
        <div style={{ marginTop: 40, paddingTop: 30, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: "0.86rem", color: "#a1a1aa" }}>
            Conheça também nossa{" "}
            <Link href="/politica-de-privacidade" style={{ color: "#14d0c1", fontWeight: 600 }}>Política de Privacidade (LGPD)</Link>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={handleOpenPreferences}
              className="qmax-legal-btn"
            >
              <Sliders size={16} />
              <span>Alterar Escolhas de Cookies</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
