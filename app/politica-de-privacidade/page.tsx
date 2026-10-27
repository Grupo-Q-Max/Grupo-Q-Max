import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, FileText, CheckCircle2, AlertCircle, Mail, Building, Scale, ArrowRight } from "lucide-react";
import "@/app/legal.css";

export const metadata: Metadata = {
  title: "Política de Privacidade e Proteção de Dados (LGPD) | Grupo Q-Max",
  description:
    "Conheça nossa Política de Privacidade e Governança de Dados em estrita conformidade com a Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018 - LGPD).",
  alternates: {
    canonical: "/politica-de-privacidade",
  },
  openGraph: {
    title: "Política de Privacidade | Grupo Q-Max",
    description:
      "Transparência, segurança e governança no tratamento de dados pessoais pelo Grupo Q-Max em conformidade com a LGPD.",
    url: "/politica-de-privacidade",
    type: "website",
  },
};

export default function PoliticaPrivacidadePage() {
  const dataAtualizacao = "27 de Outubro de 2026";

  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        {/* Header */}
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Shield size={14} /> Lei Federal nº 13.709/2018 (LGPD)
          </div>
          <h1 className="qmax-legal-title">Política de Privacidade e Proteção de Dados</h1>
          <p className="qmax-legal-subtitle">
            Diretrizes corporativas de governança, segurança da informação e garantia dos direitos fundamentais de
            privacidade e autodeterminação informativa no âmbito de todas as unidades do Grupo Q-Max.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileText size={14} /> Versão 3.1
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> Grupo Q-Max Consolidado
            </span>
            <span className="qmax-legal-meta-item">
              <Scale size={14} /> Atualizado em: {dataAtualizacao}
            </span>
          </div>
        </header>

        {/* Sumário Rápido */}
        <nav className="qmax-legal-index" aria-label="Índice da Política">
          <div className="qmax-legal-index-title">
            <FileText size={16} color="#14d0c1" /> Índice da Política de Privacidade
          </div>
          <ul className="qmax-legal-index-list">
            <li><a href="#controlador">1. Identificação do Controlador</a></li>
            <li><a href="#dpo">2. Encarregado de Dados (DPO)</a></li>
            <li><a href="#principios">3. Princípios e Compromisso Legal</a></li>
            <li><a href="#dados-coletados">4. Dados Coletados e Finalidades</a></li>
            <li><a href="#bases-legais">5. Bases Legais de Tratamento</a></li>
            <li><a href="#direitos-titular">6. Direitos do Titular (Art. 18)</a></li>
            <li><a href="#compartilhamento">7. Compartilhamento de Dados</a></li>
            <li><a href="#seguranca">8. Segurança da Informação</a></li>
            <li><a href="#retencao">9. Retenção e Descarte</a></li>
            <li><a href="#isencao">10. Limitação de Responsabilidade</a></li>
            <li><a href="#foro">11. Legislação Aplicável e Foro</a></li>
          </ul>
        </nav>

        {/* Conteúdo Principal */}
        <article className="qmax-legal-body">
          {/* Seção 1 */}
          <section id="controlador" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. Identificação do Controlador</h2>
            <p>
              O <strong>GRUPO Q-MAX</strong>, sociedade empresária com sede na Rua Frei Gaspar, 941 - Conjunto 103-105,
              Centro, São Bernardo do Campo - SP, CEP 09710-180, doravante denominado simplesmente &quot;Controlador&quot;,
              atua no ecossistema de soluções corporativas integradas compreendendo as seguintes unidades e marcas
              associadas:
            </p>
            <ul>
              <li><strong>Q-Max Auditoria e Consultoria</strong> (serviços de auditoria independente, controles internos e compliance);</li>
              <li><strong>Q-Max Contábil</strong> (assessoria contábil, tributária, fiscal e outsourcing de folha de pagamento);</li>
              <li><strong>Q-Max Talents</strong> (recrutamento executivo, seleção e gestão estratégica de talentos);</li>
              <li><strong>Q-Max Technology</strong> (desenvolvimento de soluções de software corporativo, integrações e plataformas digitais);</li>
              <li><strong>FINORA</strong> (soluções em inteligência fiscal e gestão contábil para clínicas e profissionais de saúde);</li>
              <li><strong>Lagerhaus Coworking &amp; Negócios</strong> (espaço empresarial, domicílio fiscal e salas corporativas).</li>
            </ul>
            <p>
              Esta Política aplica-se indistintamente a todos os portais, sistemas web, plataformas e serviços operados sob o
              domínio <code>qmaxbrasil.com.br</code> e suas aplicações vinculadas.
            </p>
          </section>

          {/* Seção 2 */}
          <section id="dpo" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Encarregado pelo Tratamento de Dados Pessoais (DPO)</h2>
            <p>
              Em atendimento formal ao Artigo 41 da Lei nº 13.709/2018 (LGPD), o Grupo Q-Max instituiu um Encarregado
              de Proteção de Dados (Data Protection Officer - DPO) dedicado a intermediar a comunicação entre os
              titulares dos dados, a empresa e a Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
            <div className="qmax-legal-callout">
              <div className="qmax-legal-callout-title">
                <Mail size={16} color="#14d0c1" /> Canal Oficial do Encarregado (DPO)
              </div>
              <p style={{ margin: 0 }}>
                Para exercer qualquer direito previsto em lei, esclarecer dúvidas ou encaminhar notificações sobre
                privacidade, contate formalmente nosso DPO através do e-mail:{" "}
                <a href="mailto:dpo@grupoqmax.com.br"><strong>dpo@grupoqmax.com.br</strong></a> ou{" "}
                <a href="mailto:privacidade@grupoqmax.com.br"><strong>privacidade@grupoqmax.com.br</strong></a>.
              </p>
            </div>
          </section>

          {/* Seção 3 */}
          <section id="principios" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Princípios e Compromisso Legal</h2>
            <p>
              O tratamento de dados pessoais no Grupo Q-Max é pautado pela boa-fé e pela estrita observância de todos os
              princípios consagrados pelo Artigo 6º da LGPD:
            </p>
            <ul>
              <li><strong>Finalidade:</strong> Realização do tratamento para propósitos legítimos, específicos e informados;</li>
              <li><strong>Adequação:</strong> Compatibilidade do tratamento com as finalidades comunicadas ao titular;</li>
              <li><strong>Necessidade (Minimização):</strong> Coleta limitada ao mínimo estritamente indispensável para a realização de suas finalidades;</li>
              <li><strong>Livre Acesso:</strong> Garantia de consulta facilitada e gratuita aos titulares sobre a forma e a duração do tratamento;</li>
              <li><strong>Qualidade dos Dados:</strong> Garantia de exatidão, clareza, relevância e atualização contínua;</li>
              <li><strong>Transparência:</strong> Informações claras, precisas e facilmente acessíveis aos titulares;</li>
              <li><strong>Segurança:</strong> Emprego de medidas técnicas e administrativas aptas a proteger os dados de acessos não autorizados;</li>
              <li><strong>Prevenção:</strong> Adoção de medidas para evitar a ocorrência de danos em virtude do tratamento;</li>
              <li><strong>Não Discriminação:</strong> Impossibilidade de realização de tratamento para fins discriminatórios ou abusivos;</li>
              <li><strong>Responsabilização e Prestação de Contas:</strong> Demonstração de eficácia das medidas adotadas.</li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section id="dados-coletados" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. Dados Coletados e Finalidades do Tratamento</h2>
            <p>
              As informações pessoais tratadas pelo Grupo Q-Max dependem da interação estabelecida com as nossas
              plataformas e serviços:
            </p>

            <div className="qmax-legal-table-wrapper">
              <table className="qmax-legal-table">
                <thead>
                  <tr>
                    <th>Origem / Categoria</th>
                    <th>Dados Coletados</th>
                    <th>Finalidade Específica</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Formulários de Contato e Diagnóstico</strong></td>
                    <td>Nome completo, endereço de e-mail corporativo/pessoal, telefone/WhatsApp, nome da empresa e mensagem.</td>
                    <td>Responder solicitações, elaborar propostas comerciais customizadas e viabilizar contato técnico solicitado.</td>
                  </tr>
                  <tr>
                    <td><strong>Navegação e Telemetria</strong></td>
                    <td>Endereço IP, data e hora de acesso, tipo de navegador, sistema operacional e páginas visualizadas.</td>
                    <td>Cumprir obrigação legal do Marco Civil da Internet (guarda de logs por 6 meses) e prevenção a fraudes/ataques.</td>
                  </tr>
                  <tr>
                    <td><strong>Contratação e Serviços Contábeis/Fiscais</strong></td>
                    <td>Dados societários, CPF/CNPJ de sócios, informações fiscais, bancárias e contábeis de clientes contratantes.</td>
                    <td>Execução do contrato de prestação de serviços contábeis, apuração tributária e envio de obrigações acessórias ao Fisco.</td>
                  </tr>
                  <tr>
                    <td><strong>Q-Max Talents (Candidatos)</strong></td>
                    <td>Currículo profissional, histórico de formação, experiências anteriores e dados de contato.</td>
                    <td>Processos seletivos, triagem de competências e encaminhamento a vagas condizentes com o perfil do candidato.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Seção 5 */}
          <section id="bases-legais" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Bases Legais de Tratamento</h2>
            <p>
              Nenhum dado é tratado sem enquadramento prévio em uma das bases legais expressamente autorizadas pela
              legislação federal:
            </p>
            <ul>
              <li><strong>Execução de Contrato ou Procedimentos Preliminares (Art. 7º, V):</strong> Necessário para o cumprimento de contratos com clientes, parceiros e colaboradores ou para etapas que antecedem a contratação;</li>
              <li><strong>Cumprimento de Obrigação Legal ou Regulatória (Art. 7º, II):</strong> Para cumprimento de normas do Conselho Federal de Contabilidade (CFC), Receita Federal do Brasil, Secretarias da Fazenda e Ministério do Trabalho;</li>
              <li><strong>Legítimo Interesse (Art. 7º, IX):</strong> Para aprimoramento da segurança cibernética, prevenção contra fraudes e melhoria contínua da usabilidade das plataformas;</li>
              <li><strong>Consentimento (Art. 7º, I):</strong> Quando expressamente requerido para comunicações promocionais e cookies analíticos opcionais.</li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section id="direitos-titular" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">6. Direitos do Titular dos Dados (Art. 18 da LGPD)</h2>
            <p>
              O titular dos dados possui o direito inalienável de obter do Controlador, a qualquer momento e mediante
              requisição expressa e gratuita:
            </p>
            <ul>
              <li><strong>Confirmação da existência de tratamento</strong> de seus dados;</li>
              <li><strong>Acesso aos dados</strong> tratados pelo Grupo Q-Max;</li>
              <li><strong>Correção</strong> de dados incompletos, inexatos ou desatualizados;</li>
              <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
              <li><strong>Portabilidade dos dados</strong> a outro fornecedor de serviço, mediante requisição expressa e resguardados os segredos comerciais;</li>
              <li><strong>Eliminação dos dados pessoais</strong> tratados com o seu consentimento, exceto nas hipóteses de conservação legalmente admitidas;</li>
              <li><strong>Informação das entidades públicas e privadas</strong> com as quais o Controlador realizou uso compartilhado de dados;</li>
              <li><strong>Revogação do consentimento</strong> de forma facilitada e a qualquer tempo.</li>
            </ul>
            <p>
              Para o exercício de qualquer um desses direitos, basta enviar e-mail com a identificação do titular para{" "}
              <a href="mailto:dpo@grupoqmax.com.br"><strong>dpo@grupoqmax.com.br</strong></a>. Nossa equipe responderá no prazo
              legal estipulado pela ANPD.
            </p>
          </section>

          {/* Seção 7 */}
          <section id="compartilhamento" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">7. Compartilhamento de Dados</h2>
            <p>
              O Grupo Q-Max não comercializa, não aluga e não compartilha dados pessoais com terceiros para fins de
              marketing não autorizado. O compartilhamento ocorre exclusivamente nas hipóteses estritamente necessárias:
            </p>
            <ul>
              <li><strong>Provedores de Infraestrutura de Nuvem:</strong> Servidores em nuvem de alta segurança (Microsoft Azure), com redundância e certificações internacionais de proteção (ISO 27001, SOC 2);</li>
              <li><strong>Órgãos Governamentais e Reguladores:</strong> Receita Federal, Prefeituras, Secretarias Estaduais da Fazenda, Caixa Econômica Federal e Junta Comercial, para cumprimento inescusável de obrigações legais;</li>
              <li><strong>Instituições Financeiras Homologadas:</strong> Para processamento seguro de pagamentos e emissão de notas fiscais;</li>
              <li><strong>Determinação Judicial ou Policial:</strong> Mediante ordem judicial fundamentada ou solicitação expressa da ANPD.</li>
            </ul>
          </section>

          {/* Seção 8 */}
          <section id="seguranca" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">8. Segurança da Informação e Blindagem Técnica</h2>
            <p>
              Adotamos medidas técnicas, operacionais e administrativas de nível empresarial para blindar as informações contra
              acesso não autorizado, destruição, perda, alteração ou vazamento:
            </p>
            <ul>
              <li>Criptografia de ponta a ponta em trânsito com protocolo <strong>TLS 1.3 / HTTPS</strong> e certificados de alta confidencialidade;</li>
              <li>Isolamento de credenciais e senhas através de algoritmos criptográficos modernos de hashing (Bcrypt / Argon2);</li>
              <li>Controle de acesso granular baseado no princípio do menor privilégio (Least Privilege Access);</li>
              <li>Proteção contra ataques automatizados, limitação de taxa (Rate Limiting) e prevenção contra ataques CSRF e XSS;</li>
              <li>Backups periódicos e testes contínuos de integridade e continuidade de negócios.</li>
            </ul>
          </section>

          {/* Seção 9 */}
          <section id="retencao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">9. Retenção e Descarte de Dados</h2>
            <p>
              Os dados pessoais serão retidos pelo período estritamente necessário para cumprir as finalidades para as quais
              foram coletados, observados os prazos prescricionais previstos na legislação brasileira (Código Civil, Código
              Tributário Nacional, Consolidação das Leis do Trabalho e normas do CFC). Após o término da finalidade e do prazo
              legal obrigatório, os dados serão eliminados ou anonimizados de forma segura e irreversível.
            </p>
          </section>

          {/* Seção 10 */}
          <section id="isencao" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">10. Limitação de Responsabilidade</h2>
            <div className="qmax-legal-callout qmax-legal-callout-warning">
              <div className="qmax-legal-callout-title">
                <AlertCircle size={16} color="#f59e0b" /> Cláusula de Isenção de Responsabilidade
              </div>
              <p style={{ margin: 0 }}>
                O Grupo Q-Max emprega os mais elevados padrões técnicos razoáveis e disponíveis para garantir a segurança dos
                dados. Todavia, a empresa <strong>não será responsabilizada</strong> por: (i) atos culposos ou dolosos
                praticados exclusivamente pelo titular (como compartilhamento voluntário ou negligente de suas senhas ou
                acesso a links maliciosos em dispositivos próprios); (ii) ataques cibernéticos de força maior ou que
                extrapolem o estado da técnica de segurança universalmente aplicável; (iii) veracidade ou exatidão de dados
                unilateralmente inseridos por usuários e visitantes nos formulários.
              </p>
            </div>
          </section>

          {/* Seção 11 */}
          <section id="foro" className="qmax-legal-section">
            <h2 className="qmax-legal-heading">11. Legislação Aplicável e Foro de Eleição</h2>
            <p>
              Esta Política é regida e interpretada em conformidade integral com as Leis da República Federativa do Brasil, em
              especial a Lei nº 13.709/2018 (LGPD), a Lei nº 12.965/2014 (Marco Civil da Internet) e o Código de Defesa do
              Consumidor.
            </p>
            <p>
              Fica eleito o <strong>Foro da Comarca de São Bernardo do Campo, Estado de São Paulo</strong>, com expressa renúncia
              a qualquer outro, por mais privilegiado que seja, para dirimir quaisquer controvérsias oriundas desta Política.
            </p>
          </section>
        </article>

        {/* Rodapé Interno com Botões de Ação */}
        <div style={{ marginTop: 40, paddingTop: 30, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: "0.86rem", color: "#a1a1aa" }}>
            Dúvidas jurídicas ou exercício de direitos? Entre em contato com{" "}
            <a href="mailto:dpo@grupoqmax.com.br" style={{ color: "#14d0c1", fontWeight: 600 }}>dpo@grupoqmax.com.br</a>
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
