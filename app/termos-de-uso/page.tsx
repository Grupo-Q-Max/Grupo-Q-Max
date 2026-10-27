import type { Metadata } from "next";
import Link from "next/link";
import { Scale, Shield, AlertTriangle, FileCheck, Copyright, Server, Ban, ArrowRight, Building } from "lucide-react";
import "@/app/legal.css";

export const metadata: Metadata = {
  title: "Termos de Uso e Condições Gerais | Grupo Q-Max",
  description:
    "Termos de Uso, condições de navegação, propriedade intelectual e limitações de responsabilidade aplicáveis às plataformas e serviços digitais do Grupo Q-Max.",
  alternates: {
    canonical: "/termos-de-uso",
  },
  openGraph: {
    title: "Termos de Uso | Grupo Q-Max",
    description:
      "Condições gerais de navegação, segurança e uso dos serviços e plataformas do Grupo Q-Max.",
    url: "/termos-de-uso",
    type: "website",
  },
};

export default function TermosDeUsoPage() {
  const dataAtualizacao = "27 de Outubro de 2026";

  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        {/* Header */}
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Scale size={14} /> Condições Gerais de Uso e Navegação
          </div>
          <h1 className="qmax-legal-title">Termos de Uso da Plataforma</h1>
          <p className="qmax-legal-subtitle">
            Regras, diretrizes de conduta, direitos autorais e limitações de responsabilidade civil aplicáveis a todos os
            visitantes, usuários e clientes das plataformas do Grupo Q-Max.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileCheck size={14} /> Versão 3.1
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> Grupo Q-Max Consolidado
            </span>
            <span className="qmax-legal-meta-item">
              <Scale size={14} /> Vigência a partir de: {dataAtualizacao}
            </span>
          </div>
        </header>

        {/* Sumário */}
        <nav className="qmax-legal-index" aria-label="Índice dos Termos">
          <div className="qmax-legal-index-title">
            <Scale size={16} color="#14d0c1" /> Índice dos Termos de Uso
          </div>
          <ul className="qmax-legal-index-list">
            <li><a href="#aceite">1. Aceite das Condições</a></li>
            <li><a href="#objeto">2. Objeto e Serviços Institucionais</a></li>
            <li><a href="#propriedade">3. Propriedade Intelectual e Marcas</a></li>
            <li><a href="#conduta">4. Regras de Conduta e Uso Proibido</a></li>
            <li><a href="#propostas">5. Propostas e Orçamentos</a></li>
            <li><a href="#limitacao">6. Limitação de Responsabilidade Civil</a></li>
            <li><a href="#disponibilidade">7. Disponibilidade e Manutenções</a></li>
            <li><a href="#links-terceiros">8. Links para Portais Externos</a></li>
            <li><a href="#rescisao">9. Bloqueio e Rescisão de Acesso</a></li>
            <li><a href="#foro">10. Legislação Aplicável e Foro</a></li>
          </ul>
        </nav>

        {/* Conteúdo */}
        <article className="qmax-legal-body">
          {/* Seção 1 */}
          <section id="aceite" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. Aceite das Condições</h2>
            <p>
              Ao acessar, navegar ou utilizar qualquer página, ferramenta, formulário ou funcionalidade disponibilizada no
              endereço <code>qmaxbrasil.com.br</code> ou em seus subdomínios, o usuário declara ter lido, compreendido e
              concordado de forma integral e sem ressalvas com as presentes condições.
            </p>
            <p>
              Caso o usuário não concorde com qualquer disposição destes Termos de Uso ou de nossa{" "}
              <Link href="/politica-de-privacidade">Política de Privacidade</Link>, deverá abster-se imediatamente de utilizar
              as plataformas do Grupo Q-Max.
            </p>
          </section>

          {/* Seção 2 */}
          <section id="objeto" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Objeto e Serviços Institucionais</h2>
            <p>
              O portal institucional do Grupo Q-Max destina-se a apresentar ao mercado o ecossistema empresarial do grupo,
              fornecer canais de contato direto, divulgar produtos e soluções de tecnologia corporativa e possibilitar a
              solicitação de diagnósticos e propostas comerciais nas seguintes frentes:
            </p>
            <ul>
              <li><strong>Auditoria Independente e Compliance</strong> (Q-Max Auditoria);</li>
              <li><strong>Contabilidade Consultiva, Gestão Fiscal e BPO Financeiro</strong> (Q-Max Contábil);</li>
              <li><strong>Inteligência Contábil para Clínicas Odontológicas e da Saúde</strong> (FINORA);</li>
              <li><strong>Recrutamento Executivo, Terceirização e Talentos</strong> (Q-Max Talents);</li>
              <li><strong>Tecnologia Empresarial, Sistemas QXBACK e QXSIGN</strong> (Q-Max Technology);</li>
              <li><strong>Locação de Espaços Corporativos e Domicílio Fiscal</strong> (Lagerhaus).</li>
            </ul>
          </section>

          {/* Seção 3 */}
          <section id="propriedade" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Propriedade Intelectual e Proteção de Marcas</h2>
            <div className="qmax-legal-callout">
              <div className="qmax-legal-callout-title">
                <Copyright size={16} color="#14d0c1" /> Direitos Autorais e Propriedade Industrial (Leis 9.610/98 e 9.279/96)
              </div>
              <p style={{ margin: 0 }}>
                Todos os elementos constitutivos do portal — incluindo, mas não se limitando a marcas nominativas e
                figurativas (&quot;Grupo Q-Max&quot;, &quot;Q-Max&quot;, &quot;FINORA&quot;, &quot;Lagerhaus&quot;, &quot;QXBACK&quot;, &quot;QXSIGN&quot;),
                logotipos, designs, códigos-fonte, arquitetura de software, layouts, ícones, ilustrações, textos, bancos de dados e
                vídeos — são de propriedade exclusiva do Grupo Q-Max ou de seus respectivos licenciantes.
              </p>
            </div>
            <p>
              É terminantemente proibido ao usuário ou a qualquer terceiro copiar, reproduzir, modificar, republicar,
              descompilar, realizar engenharia reversa, criar obras derivadas, extrair dados por meios automatizados (data
              scraping, web crawling ou screen scraping) ou explorar comercialmente qualquer conteúdo sem a prévia e expressa
              autorização por escrito do Grupo Q-Max.
            </p>
          </section>

          {/* Seção 4 */}
          <section id="conduta" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. Regras de Conduta e Usos Proibidos</h2>
            <p>
              O usuário compromete-se a utilizar as plataformas de maneira ética, lícita e com estrita observância da legislação
              em vigor. Constituem infrações gravíssimas a estes Termos:
            </p>
            <ul>
              <li>Fornecer dados falsos, incompletos, de terceiros ou fraudados em formulários de contato ou de contratação;</li>
              <li>Tentar violar mecanismos de autenticação, segurança, firewalls ou controle de acesso dos sistemas;</li>
              <li>Introduzir códigos maliciosos, vírus, trojans, worms ou qualquer outro artefato lesivo à infraestrutura de TI;</li>
              <li>Praticar ataques de negação de serviço (DoS/DDoS) ou promover sobrecarga artificial nos servidores;</li>
              <li>Utilizar a marca, reputação ou nome do Grupo Q-Max para veicular comunicações fraudulentas (phishing, spam).</li>
            </ul>
          </section>

          {/* Seção 5 */}
          <section id="propostas" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Propostas, Diagnósticos e Informações Institucionais</h2>
            <p>
              Os textos, artigos, calculadoras, estimativas ou simulações contidas no site têm caráter estritamente
              institucional, preliminar e informativo. <strong>Eles não constituem parecer técnico, contábil, fiscal ou
              auditoria vinculante</strong>.
            </p>
            <p>
              A formalização de qualquer prestação de serviços somente se consuma mediante celebração de contrato de prestação
              de serviços formal e bilateral, devidamente assinado pelas partes e acompanhado das respectivas cláusulas de escopo,
              prazos, honorários e responsabilidade técnica perante os conselhos de classe (CRC/CFC).
            </p>
          </section>

          {/* Seção 6 */}
          <section id="limitacao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">6. Limitação de Responsabilidade Civil</h2>
            <div className="qmax-legal-callout qmax-legal-callout-warning">
              <div className="qmax-legal-callout-title">
                <AlertTriangle size={16} color="#f59e0b" /> Cláusula de Blindagem e Isenção de Responsabilidade
              </div>
              <p>
                Em nenhuma hipótese o Grupo Q-Max, seus sócios, diretores, colaboradores ou prepostos responderão perante o
                usuário ou terceiros por:
              </p>
              <ul style={{ marginBottom: 0 }}>
                <li>Danos indiretos, lucros cessantes, perdas financeiras, interrupção de negócios ou perda de oportunidades comerciais;</li>
                <li>Decisões de negócios ou operacionais tomadas pelo usuário com base exclusiva nas informações institucionais preliminares do site;</li>
                <li>Inconsistências ou erros resultantes do preenchimento incorreto ou de má-fé de formulários pelos próprios usuários;</li>
                <li>Instabilidades decorrentes de falhas em operadoras de telecomunicações, provedores de acesso à internet ou eventos de força maior (Art. 393 do Código Civil Brasileiro).</li>
              </ul>
            </div>
          </section>

          {/* Seção 7 */}
          <section id="disponibilidade" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">7. Disponibilidade e Manutenções Técnicas</h2>
            <p>
              Embora o Grupo Q-Max empregue esforços de excelência para manter suas plataformas disponíveis 24 horas por dia, 7
              dias por semana, não há garantia expressa de funcionamento ininterrupto ou isento de instabilidades pontuais. A
              empresa reserva-se o direito de realizar paradas programadas para manutenção, atualização de segurança ou
              otimização dos sistemas sem necessidade de aviso prévio para acessos institucionais.
            </p>
          </section>

          {/* Seção 8 */}
          <section id="links-terceiros" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">8. Links para Portais Externos e Integrações</h2>
            <p>
              O portal poderá conter links para páginas de terceiros (como WhatsApp, Microsoft, LinkedIn, órgãos públicos e
              sistemas bancários). Tais links são disponibilizados unicamente para conveniência do usuário. O Grupo Q-Max não
              exerce controle sobre conteúdos, termos de serviço ou práticas de privacidade desses terceiros e não assume
              qualquer responsabilidade civil sobre eles.
            </p>
          </section>

          {/* Seção 9 */}
          <section id="rescisao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">9. Bloqueio e Rescisão de Acesso</h2>
            <p>
              O Grupo Q-Max reserva-se o direito soberano de bloquear, suspender ou encerrar unilateralmente o acesso de qualquer
              usuário aos seus portais ou sistemas restritos caso seja constatado o descumprimento de qualquer cláusula destes
              Termos, a prática de condutas ilícitas ou a tentativa de prejudicar a imagem institucional da corporação.
            </p>
          </section>

          {/* Seção 10 */}
          <section id="foro" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">10. Legislação Aplicável e Foro de Eleição</h2>
            <p>
              Estes Termos de Uso são regidos, interpretados e executados segundo as leis vigentes da República Federativa do
              Brasil.
            </p>
            <p>
              Fica expressamente eleito o <strong>Foro da Comarca de São Bernardo do Campo, Estado de São Paulo</strong>, com
              renúncia categórica a qualquer outro foro por mais privilegiado ou especial que seja, para dirimir qualquer dúvida,
              demanda ou litígio decorrente destes Termos.
            </p>
          </section>
        </article>

        {/* Rodapé com Navegação */}
        <div style={{ marginTop: 40, paddingTop: 30, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: "0.86rem", color: "#a1a1aa" }}>
            Consulte também nossa{" "}
            <Link href="/politica-de-privacidade" style={{ color: "#14d0c1", fontWeight: 600 }}>Política de Privacidade (LGPD)</Link>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/politica-de-cookies" className="qmax-legal-btn">
              <span>Política de Cookies</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
