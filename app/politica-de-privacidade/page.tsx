import type { Metadata } from "next";
import Link from "next/link";
import { Shield, FileText, Mail, Building, Scale, ArrowRight } from "lucide-react";
import { legal } from "@/data/site";
import "@/app/legal.css";

export const metadata: Metadata = {
  title: "Política de Privacidade (LGPD)",
  description:
    "Como o Grupo Q-Max trata dados pessoais: quais dados, para quê, com quem compartilha, por quanto tempo e como exercer seus direitos (Lei nº 13.709/2018).",
  alternates: { canonical: "/politica-de-privacidade" },
  openGraph: {
    title: "Política de Privacidade | Grupo Q-Max",
    description: "Como o Grupo Q-Max trata dados pessoais conforme a LGPD.",
    url: "/politica-de-privacidade",
    type: "website",
  },
};

/*
 * Keep this page in step with the code: every row below matches a real form, cookie or integration.
 * When a new form, tracker or partner is added, update the tables and bump legal.privacyVersion
 * in data/site.ts (the cookie banner then asks again).
 */
const operations = [
  {
    origin: "Formulário “Fale com o especialista” do site",
    data: "Nome, empresa (opcional), telefone/WhatsApp (opcional), unidade de interesse, data do aceite e versão desta política.",
    purpose: "Responder ao seu pedido de contato e diagnóstico. A conversa segue no WhatsApp.",
    basis: "Consentimento (art. 7º, I) e procedimentos preliminares a contrato a seu pedido (art. 7º, V).",
    retention: `${legal.retention.leadsMonths} meses após o envio, ou até você pedir a exclusão.`,
  },
  {
    origin: "Estatísticas de visita (somente se você autorizar no aviso de cookies)",
    data: "Página visitada, site de origem (apenas o domínio) e data. Pelo Google Analytics: identificador de cookie, dados do dispositivo e localização aproximada, com IP anonimizado.",
    purpose: "Saber quais páginas e serviços interessam mais e melhorar o site.",
    basis: "Consentimento (art. 7º, I), revogável a qualquer momento em “Preferências de Cookies”.",
    retention: `Contador próprio: ${legal.retention.pageVisitsMonths} meses. Google Analytics: 14 meses.`,
  },
  {
    origin: "Cadastro em ativações e eventos FINORA (ex.: roleta e sorteios em feiras)",
    data: "Nome, CPF, WhatsApp, e-mail, CRO e UF, nome da clínica, número de cadeiras (quando pedido), código VIP. Para evitar fraude: identificador do aparelho, IP e navegador.",
    purpose: "Validar a participação (um cadastro por pessoa), enviar o PIN e o resultado por WhatsApp, entregar prêmios e agendar a reunião solicitada.",
    basis: "Execução do regulamento que você aceita (art. 7º, V) e prevenção à fraude (art. 11, II, “g” e art. 7º, IX). Envio de novidades e contato comercial só com o seu consentimento separado (art. 7º, I).",
    retention: "12 meses após o fim do evento; depois os dados são anonimizados. Quem autorizou novidades permanece até revogar.",
  },
  {
    origin: "Propostas comerciais e contratação",
    data: "Dados de contato, CNPJ, nome e CPF de quem aceita a proposta, IP e data do aceite. Documentos de onboarding enviados por você: contrato social, certificado digital, alvará e folha de pagamento.",
    purpose: "Formalizar e comprovar a contratação, assinar o contrato eletronicamente e iniciar a prestação do serviço contábil.",
    basis: "Execução de contrato (art. 7º, V), obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
    retention: "Durante o contrato e pelos prazos legais (fiscais, contábeis e trabalhistas, em regra 5 anos). Documentos de propostas não aceitas: até 90 dias.",
  },
  {
    origin: "Clientes e serviços prestados (contábil, auditoria, RH, coworking)",
    data: "Dados societários, de sócios, fiscais, contábeis e, na folha de pagamento, dados de empregados do cliente.",
    purpose: "Prestar o serviço contratado e cumprir obrigações perante Receita Federal, Fazendas, eSocial e demais órgãos.",
    basis: "Execução de contrato (art. 7º, V) e obrigação legal (art. 7º, II). Para dados de empregados do cliente, o Grupo Q-Max atua como operador, seguindo as instruções do cliente (controlador).",
    retention: "Prazos legais de guarda de cada obrigação.",
  },
  {
    origin: "Currículos enviados por e-mail ou WhatsApp (Q-Max Talents)",
    data: "Currículo e dados de contato que você decidir enviar.",
    purpose: "Avaliar seu perfil para vagas do Grupo ou de clientes de recrutamento.",
    basis: "Procedimentos preliminares a contrato a seu pedido (art. 7º, V) e consentimento para indicação a clientes (art. 7º, I).",
    retention: "Até 12 meses após o envio, salvo pedido de exclusão antes disso.",
  },
];

const processors = [
  ["Microsoft (Azure e Microsoft 365)", "Hospedagem do site e dos sistemas, banco de dados e e-mail.", "Brasil e/ou exterior"],
  ["Google (Analytics e Maps)", "Estatísticas de visita e mapa, somente com a sua autorização.", "Exterior (EUA)"],
  ["Meta (WhatsApp)", "Conversa que você inicia pelo site.", "Exterior"],
  ["Z-API", "Envio do PIN e de avisos por WhatsApp nas ativações FINORA.", "Brasil"],
  ["D4Sign", "Assinatura eletrônica de contratos.", "Brasil"],
  ["Ferramentas de CRM (ex.: RD Station)", "Somente para participantes de eventos que autorizaram receber novidades.", "Brasil e/ou exterior"],
  ["Órgãos públicos", "Receita Federal, Fazendas, Prefeituras, Junta Comercial, eSocial, quando a lei exige.", "Brasil"],
  ["Autoridades", "Quando houver ordem judicial ou requisição legal.", "Brasil"],
];

export default function PoliticaPrivacidadePage() {
  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Shield size={14} /> Lei nº 13.709/2018 (LGPD)
          </div>
          <h1 className="qmax-legal-title">Política de Privacidade</h1>
          <p className="qmax-legal-subtitle">
            Como o {legal.groupName} trata seus dados pessoais, por que, com quem compartilha, por quanto tempo e como
            você exerce seus direitos.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileText size={14} /> Versão {legal.privacyVersion}
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> {legal.groupName}
            </span>
            <span className="qmax-legal-meta-item">
              <Scale size={14} /> Atualizado em {legal.lastUpdated}
            </span>
          </div>
        </header>

        <nav className="qmax-legal-index" aria-label="Índice da Política">
          <div className="qmax-legal-index-title">
            <FileText size={16} /> Índice
          </div>
          <ul className="qmax-legal-index-list">
            <li><a href="#controlador">1. Quem é o controlador</a></li>
            <li><a href="#dpo">2. Encarregado (DPO)</a></li>
            <li><a href="#dados">3. Quais dados tratamos e por quê</a></li>
            <li><a href="#minimizacao">4. O que não coletamos</a></li>
            <li><a href="#compartilhamento">5. Com quem compartilhamos</a></li>
            <li><a href="#internacional">6. Transferência internacional</a></li>
            <li><a href="#cookies">7. Cookies</a></li>
            <li><a href="#direitos">8. Seus direitos</a></li>
            <li><a href="#seguranca">9. Segurança e incidentes</a></li>
            <li><a href="#retencao">10. Retenção e exclusão</a></li>
            <li><a href="#menores">11. Crianças e adolescentes</a></li>
            <li><a href="#alteracoes">12. Alterações desta política</a></li>
            <li><a href="#lei">13. Legislação e foro</a></li>
          </ul>
        </nav>

        <article className="qmax-legal-body">
          <section id="controlador" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. Quem é o controlador</h2>
            <p>
              O {legal.groupName} reúne as empresas abaixo, com sede em {legal.address}. Cada empresa é controladora dos
              dados tratados nos serviços que presta; os canais do site são operados em conjunto.
            </p>
            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Marca</th>
                    <th>Razão social</th>
                    <th>CNPJ</th>
                  </tr>
                </thead>
                <tbody>
                  {legal.companies.map((company) => (
                    <tr key={company.brand}>
                      <td><strong>{company.brand}</strong></td>
                      <td>{company.legalName}</td>
                      <td>{company.cnpj}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Esta política vale para os sites <code>grupoqmax.com.br</code> e <code>qmaxbrasil.com.br</code>, suas
              páginas de eventos e de propostas, e para os atendimentos feitos a partir deles.
            </p>
          </section>

          <section id="dpo" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Encarregado pelo tratamento de dados (DPO)</h2>
            <div className="qmax-legal-callout">
              <div className="qmax-legal-callout-title">
                <Mail size={16} /> Canal do encarregado
              </div>
              <p style={{ margin: 0 }}>
                {legal.dpoName}:{" "}
                <a href={`mailto:${legal.dpoEmail}`}><strong>{legal.dpoEmail}</strong></a>. Use este canal para dúvidas,
                pedidos sobre seus dados e comunicações da ANPD (art. 41 da LGPD).
              </p>
            </div>
          </section>

          <section id="dados" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Quais dados tratamos e por quê</h2>
            <p>Tratamos apenas os dados necessários para cada finalidade abaixo.</p>
            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Onde</th>
                    <th>Dados</th>
                    <th>Finalidade</th>
                    <th>Base legal</th>
                    <th>Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((row) => (
                    <tr key={row.origin}>
                      <td><strong>{row.origin}</strong></td>
                      <td>{row.data}</td>
                      <td>{row.purpose}</td>
                      <td>{row.basis}</td>
                      <td>{row.retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Quando a base é o consentimento, você pode revogá-lo a qualquer momento, sem custo, pelo e-mail do
              encarregado ou, para cookies, em “Preferências de Cookies” no rodapé. A revogação não afeta o que foi feito
              antes dela.
            </p>
          </section>

          <section id="minimizacao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. O que não coletamos</h2>
            <ul>
              <li>Não pedimos dados sensíveis (saúde, religião, biometria, etc.) nos formulários do site.</li>
              <li>O contador de visitas próprio não guarda IP, nome, e-mail nem identificador de navegador.</li>
              <li>Não usamos cookies de publicidade nem fazemos remarketing.</li>
              <li>Não vendemos nem alugamos dados pessoais.</li>
              <li>Não tomamos decisões automatizadas que afetem seus interesses com base nos dados do site.</li>
            </ul>
          </section>

          <section id="compartilhamento" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Com quem compartilhamos</h2>
            <p>
              Compartilhamos dados somente com os fornecedores (operadores) e órgãos abaixo, na medida do necessário para
              cada finalidade, e entre as empresas do {legal.groupName} para atender ao serviço que você pediu.
            </p>
            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Quem</th>
                    <th>Para quê</th>
                    <th>Onde</th>
                  </tr>
                </thead>
                <tbody>
                  {processors.map(([who, why, where]) => (
                    <tr key={who}>
                      <td><strong>{who}</strong></td>
                      <td>{why}</td>
                      <td>{where}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="internacional" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">6. Transferência internacional</h2>
            <p>
              Alguns fornecedores (Google, Microsoft, Meta) podem armazenar dados fora do Brasil. Essas transferências se
              apoiam nas hipóteses do art. 33 da LGPD, como cláusulas contratuais padrão e garantias oferecidas pelos
              fornecedores, e, no caso das estatísticas do Google, no seu consentimento específico.
            </p>
          </section>

          <section id="cookies" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">7. Cookies</h2>
            <p>
              Só usamos o armazenamento necessário para o site funcionar. Estatísticas e o mapa do Google ficam
              desligados até você autorizar. A lista completa está na{" "}
              <Link href="/politica-de-cookies">Política de Cookies</Link>.
            </p>
          </section>

          <section id="direitos" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">8. Seus direitos (art. 18 da LGPD)</h2>
            <p>Você pode pedir, de graça, a qualquer momento:</p>
            <ul>
              <li>confirmação de que tratamos seus dados e acesso a eles;</li>
              <li>correção de dados incompletos, errados ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei;</li>
              <li>portabilidade a outro fornecedor;</li>
              <li>eliminação dos dados tratados com seu consentimento, salvo guarda exigida por lei;</li>
              <li>informação sobre com quem compartilhamos seus dados;</li>
              <li>informação sobre a possibilidade de não consentir e as consequências disso;</li>
              <li>revogação do consentimento;</li>
              <li>revisão de decisões tomadas apenas com base em tratamento automatizado.</li>
            </ul>
            <p>
              Envie o pedido para <a href={`mailto:${legal.dpoEmail}`}><strong>{legal.dpoEmail}</strong></a>. Podemos
              pedir uma confirmação de identidade para proteger seus dados. Respondemos em até {legal.responseDays} dias.
              Se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD) em{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">gov.br/anpd</a> ou aos órgãos de
              defesa do consumidor.
            </p>
          </section>

          <section id="seguranca" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">9. Segurança e incidentes</h2>
            <p>
              Usamos medidas técnicas e administrativas razoáveis para proteger os dados, entre elas: conexão HTTPS,
              acesso restrito por login às áreas internas, permissões por perfil, limite de tentativas nos formulários,
              CPF cifrado nos cadastros de eventos e registro de acessos administrativos. Nenhum sistema é totalmente
              imune a falhas. Se ocorrer um incidente de segurança com risco ou dano relevante, comunicaremos a ANPD e os
              titulares afetados, como manda o art. 48 da LGPD.
            </p>
          </section>

          <section id="retencao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">10. Retenção e exclusão</h2>
            <p>
              Guardamos os dados pelos prazos da tabela da seção 3. Encerrado o prazo, os dados são eliminados ou
              anonimizados automaticamente, exceto quando a lei exige guarda por mais tempo (por exemplo, documentos
              fiscais, contábeis e trabalhistas) ou para defesa em processos (art. 16 da LGPD).
            </p>
          </section>

          <section id="menores" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">11. Crianças e adolescentes</h2>
            <p>
              Nossos serviços são voltados a empresas e profissionais. Não coletamos intencionalmente dados de menores de
              18 anos. Se isso ocorrer, escreva para o encarregado e os dados serão excluídos.
            </p>
          </section>

          <section id="alteracoes" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">12. Alterações desta política</h2>
            <p>
              Podemos atualizar esta política. A versão e a data ficam no topo da página. Mudanças relevantes são
              avisadas no site, e o aviso de cookies é exibido de novo para você confirmar suas escolhas.
            </p>
          </section>

          <section id="lei" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">13. Legislação e foro</h2>
            <p>
              Esta política segue a legislação brasileira, em especial a Lei nº 13.709/2018 (LGPD), a Lei nº 12.965/2014
              (Marco Civil da Internet) e o Código de Defesa do Consumidor. Fica eleito o foro da Comarca de São Bernardo
              do Campo/SP, ressalvado o direito do consumidor de propor ação no foro do seu domicílio.
            </p>
          </section>
        </article>

        <div style={{ marginTop: 40, paddingTop: 30, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: "0.86rem", color: "#a1a1aa" }}>
            Dúvidas ou pedidos sobre seus dados:{" "}
            <a href={`mailto:${legal.dpoEmail}`} style={{ color: "var(--qmax-magenta, #d90f81)", fontWeight: 600 }}>{legal.dpoEmail}</a>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/termos-de-uso" className="qmax-legal-btn">
              <span>Ver Termos de Uso</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
