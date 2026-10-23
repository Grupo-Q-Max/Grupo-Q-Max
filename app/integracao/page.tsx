import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Contact,
  FileSignature,
  Gift,
  HeartPulse,
  History,
  KeyRound,
  Layers,
  ListChecks,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  SquareKanban,
  Table2,
  Tv,
  Users2,
  Workflow,
} from "lucide-react";

import { ScrollReveal } from "@/components/ScrollReveal";
import { companies, contact, values } from "@/data/site";
import "./integracao.css";

export const metadata: Metadata = {
  title: "Integração",
  description:
    "Guia de integração para novos colaboradores: o Grupo Q-Max, suas empresas, produtos e ferramentas internas (CRM e Controle de Fechamento).",
  alternates: {
    canonical: "/integracao",
  },
  robots: { index: false, follow: false },
};

const sections = [
  { id: "quem-somos", label: "Quem somos" },
  { id: "grupo-empresas", label: "Empresas do grupo" },
  { id: "grupo-produtos", label: "Produtos" },
  { id: "crm", label: "CRM interno" },
  { id: "fechamento", label: "Controle de fechamento" },
  { id: "primeira-semana", label: "Primeira semana" },
  { id: "duvidas", label: "Dúvidas e contatos" },
];

const pillars = [
  {
    icon: ShieldCheck,
    title: "Missão",
    text: "Assegurar soluções e serviços de alta qualidade e preservar a nossa reputação e do cliente utilizando-se de atitudes éticas.",
  },
  {
    icon: Sparkles,
    title: "Visão",
    text: "Ser reconhecida como líder em soluções empresariais inovadoras, criando valor real para nossos clientes.",
  },
];

const companyServices: Record<string, string[]> = {
  audit: [
    "Auditoria das Demonstrações Contábeis",
    "Gestão de Riscos e Processos",
    "Controles Internos e Compliance",
    "LGPD e DPO",
  ],
  contabil: [
    "Assessoria Contábil, Fiscal e Trabalhista",
    "Abertura de Empresas",
    "Terceirização - BPO",
    "Planejamento Tributário",
  ],
  talents: [
    "Recrutamento e Seleção",
    "Treinamento e Desenvolvimento",
    "Departamento Pessoal",
    "Cultura e Clima Organizacional",
  ],
  technology: [
    "Estratégias Digitais",
    "Programa de Indicação (QXBACK)",
    "Visibilidade de Marca",
    "Desenvolvimento de Ferramentas",
  ],
  lagerhaus: [
    "Endereço Fiscal",
    "Endereço Comercial",
    "Armazenagem e Estocagem",
    "Espaços de Coworking",
  ],
};

const qxbackSteps = [
  {
    title: "Cadastro do indicador",
    text: "Cliente, parceiro ou qualquer pessoa cria uma conta em qxback.com.br e passa a ter um código de indicador.",
  },
  {
    title: "Indicação",
    text: "O indicador informa a empresa indicada (CNPJ, contato) e os serviços de interesse. A indicação vira um negócio no pipeline QXBACK do CRM.",
  },
  {
    title: "Contato e proposta",
    text: "O time comercial move o card: Em Contato, Proposta em Elaboração (gera bônus de R$ 20 para aprovação, quando o serviço tem bonificação) e Proposta Enviada (calcula o QXBack de cada serviço).",
  },
  {
    title: "Fechamento",
    text: "Negócio fechado gera o ganho do indicador como \"Aguardando Liberação\". O indicador recebe e-mail a cada mudança de etapa.",
  },
  {
    title: "Liberação e resgate",
    text: "O financeiro aprova o ganho, o valor entra no saldo e o indicador solicita o resgate pela plataforma.",
  },
];

const qxbackRules = [
  "Para mover para Proposta Enviada, os serviços do card precisam ter preço maior que zero.",
  "Para mover para Perdido, o CRM pede o motivo — ele é enviado ao indicador.",
  "Empresas parceiras e funcionários do grupo não recebem bônus por indicação.",
  "Todo ganho passa por aprovação do financeiro antes de virar saldo.",
];

const otherProducts = [
  {
    id: "qxsign",
    icon: FileSignature,
    name: "QXSIGN",
    kicker: "Documentação digital",
    accent: "#16e1d4",
    text: "Atendimento personalizado para emissão de certificados digitais e documentação digital. Ofereça quando o cliente precisa de e-CNPJ, e-CPF ou assinar documentos digitalmente — comum na abertura de empresas e em obrigações fiscais.",
    href: "https://qxsign.com.br",
    external: true,
  },
  {
    id: "finora",
    icon: HeartPulse,
    name: "FINORA",
    kicker: "Clínicas odontológicas",
    accent: "#b464ff",
    text: "Planejamento tributário, gestão contábil e financeira e regularização documental para clínicas odontológicas. É a porta de entrada do grupo nesse segmento: leads de dentistas e clínicas são direcionados para cá.",
    href: "/finora",
    external: false,
  },
];

const crmFeatures = [
  {
    icon: LogIn,
    title: "Acesso",
    text: "Entre em /login com sua conta Microsoft corporativa. Se não tiver acesso, peça ao administrador do CRM.",
  },
  {
    icon: SquareKanban,
    title: "Pipelines e cards",
    text: "Cada pipeline é um quadro com etapas. Pipelines de vendas guardam negócios (valor, serviços, contato); pipelines de tarefas organizam o trabalho interno. Arraste o card para mudar de etapa.",
  },
  {
    icon: Layers,
    title: "Espaços e permissões",
    text: "Pipelines são agrupados em espaços na barra lateral. Você só vê os pipelines liberados para você ou para o seu grupo.",
  },
  {
    icon: Contact,
    title: "Contatos",
    text: "Contatos são reaproveitados por e-mail e telefone, então procure antes de criar. Também é possível importar contatos por CSV.",
  },
  {
    icon: Search,
    title: "Busca global",
    text: "Use Ctrl+K para achar qualquer card pelo nome, número ou contato. Cards fechados há mais de 30 dias saem do quadro, mas continuam na busca.",
  },
  {
    icon: Bell,
    title: "Notificações e Meu painel",
    text: "Você é avisado quando é responsável por um card ou quando algo muda nele. Em Meu painel (/crm/me) ficam os seus cards e pendências.",
  },
  {
    icon: Workflow,
    title: "Automações",
    text: "Algumas etapas disparam ações automáticas (e-mails, tarefas, integração com o QXBACK). Por isso, mova os cards para a etapa certa assim que algo acontecer.",
  },
];

const closingUrl = "https://grupoqmax.com.br/controle-fechamento-2";

const closingSteps = [
  {
    title: "Abertura da competência",
    text: "No início do mês, a competência é aberta: o sistema cria um fechamento para cada empresa ativa, com os setores dela, e herda os responsáveis do mês anterior.",
  },
  {
    title: "Sincronização com o GOB",
    text: "Todo dia às 06:00 o sistema busca no GOB Core as obrigações transmitidas (eSocial, DCTFWeb, PGDAS-D, SPED, GIA etc.) e preenche data e recibo sozinho.",
  },
  {
    title: "Preenchimento pelo setor",
    text: "Cada setor abre o seu grid, filtra as empresas sob sua responsabilidade e atualiza o status de cada coluna, com observações e anexos quando precisar.",
  },
  {
    title: "Progresso automático",
    text: "Os cards de progresso recalculam a cada alteração. Quando todas as colunas de um setor terminam, o setor está fechado; quando todos os setores terminam, a empresa está fechada.",
  },
  {
    title: "Acompanhamento",
    text: "Líderes acompanham pelos painéis, pelos alertas e pelo modo TV do escritório. Toda alteração fica registrada no log de auditoria.",
  },
];

const closingModules = [
  {
    icon: Table2,
    title: "Grids por setor",
    text: "Fiscal, Contábil, DP, BPO Financeiro e Cushman & Wakefield têm layouts próprios, com as obrigações do setor (PGDAS, ICMS, Folha, FGTS Digital, Balancete, Conciliação...) e as colunas do GOB.",
  },
  {
    icon: RefreshCw,
    title: "Automação GOB Core",
    text: "Obrigações transmitidas entram automaticamente. O painel /administracao/gob mostra o progresso da sincronização e permite rodar de novo um mês específico.",
  },
  {
    icon: Receipt,
    title: "Parcelamentos",
    text: "Acordos PGFN/RFB por empresa, fila de parcelas do mês, baixa e estorno, comprovante por parcela e alerta de cancelamento com 3 parcelas em aberto.",
  },
  {
    icon: ShieldCheck,
    title: "Certificados e alertas",
    text: "Certificados digitais A1 a vencer e SLAs em risco aparecem nos alertas — bom momento para oferecer a renovação pelo QXSIGN.",
  },
  {
    icon: History,
    title: "Auditoria",
    text: "Toda alteração registra quem mudou, empresa, setor, campo, data e o valor antes e depois. Consulte em /administracao/logs.",
  },
  {
    icon: Tv,
    title: "Modo TV",
    text: "Painel em tela cheia para as TVs do escritório, com relógio e progresso do fechamento girando a cada 10 segundos.",
  },
];

const closingRules = [
  "Administradores, sócios e líderes editam todas as empresas; os demais só editam as empresas e fechamentos atribuídos a eles.",
  "Colunas do GOB são preenchidas automaticamente; se algo parecer errado, confira a transmissão no GOB antes de editar o grid.",
  "ISS e Carnê-Leão são preenchidos manualmente pelo operador.",
  "Reabrir ou sincronizar uma competência só cria o que falta: o que já foi preenchido é preservado.",
];

const firstWeek = [
  "Entrar no CRM com a conta Microsoft e conferir quais pipelines você enxerga.",
  "Acessar o Controle de Fechamento e localizar, no grid do seu setor, as empresas sob sua responsabilidade.",
  "Ler as páginas de cada empresa do grupo no site e anotar os serviços principais.",
  "Criar uma conta no QXBACK e acompanhar com o time uma indicação do início ao fim.",
  "Abrir um card de teste em um pipeline de tarefas, mover entre etapas e usar a busca (Ctrl+K).",
  "Conhecer QXSIGN e FINORA para saber quando indicar cada um ao cliente.",
  "Combinar com o seu gestor quais pipelines e rotinas ficam sob sua responsabilidade.",
];

const faqs = [
  {
    question: "Um cliente quer indicar outra empresa. O que faço?",
    answer: "Peça para ele se cadastrar no QXBACK (qxback.com.br) e registrar a indicação por lá. Assim a indicação entra no CRM e ele acompanha os ganhos. Indicações feitas fora da plataforma não geram bônus.",
  },
  {
    question: "Movi um card e o CRM bloqueou. Por quê?",
    answer: "Algumas etapas têm regras: proposta exige serviços com preço e perda exige motivo. Complete o que o aviso pede e mova de novo.",
  },
  {
    question: "Não vejo um pipeline que meu colega vê.",
    answer: "A visibilidade é por pessoa ou grupo. Peça ao administrador do CRM para liberar o pipeline para você.",
  },
  {
    question: "Não consigo editar uma empresa no Controle de Fechamento.",
    answer: "Você só edita empresas e fechamentos atribuídos a você. Peça ao líder do seu setor para te designar como responsável.",
  },
  {
    question: "Para qual empresa do grupo direciono um lead?",
    answer: "Pelo serviço: auditoria e compliance para a Auditoria; contabilidade, fiscal e abertura para a Contábil; RH para a Talents; digital e indicações para a Technology; endereço fiscal e coworking para a Lagerhaus; clínicas odontológicas para a FINORA.",
  },
];

const whatsappUrl = `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`;

export default function IntegracaoPage() {
  return (
    <main className="onb-page">
      <section className="onb-hero">
        <div className="onb-hero__glow" />
        <div className="container onb-hero__inner">
          <span className="eyebrow">
            <BookOpen size={14} />
            INTEGRAÇÃO DE COLABORADORES
          </span>
          <h1>
            Bem-vindo ao <em>Grupo Q-Max.</em>
          </h1>
          <p>
            Este guia reúne o que você precisa saber nos primeiros dias: quem somos, o que cada
            empresa do grupo faz, como funcionam nossos produtos e como usar as ferramentas internas.
          </p>
          <nav className="onb-toc" aria-label="Seções do guia">
            {sections.map((section, index) => (
              <a key={section.id} href={`#${section.id}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <ScrollReveal animation="fade-up">
        <section id="quem-somos" className="onb-section">
          <div className="container">
            <header className="onb-section__head">
              <span className="eyebrow">
                <Users2 size={13} />
                QUEM SOMOS
              </span>
              <h2>Um grupo, várias especialidades.</h2>
              <p>
                O Grupo Q-Max reúne empresas de auditoria, contabilidade, RH, tecnologia e estrutura
                física. Cada uma tem sua especialidade, mas todas atendem o mesmo cliente de forma
                integrada — é comum um cliente da Contábil também usar a Talents ou a Lagerhaus.
              </p>
            </header>

            <div className="onb-grid onb-grid--2">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article key={pillar.title} className="onb-card">
                    <div className="onb-card__icon">
                      <Icon size={22} />
                    </div>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="onb-values">
              <small>NOSSOS VALORES</small>
              <ul className="onb-chips">
                {values.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="grupo-empresas" className="onb-section onb-section--alt">
          <div className="container">
            <header className="onb-section__head">
              <span className="eyebrow">
                <Building2 size={13} />
                EMPRESAS DO GRUPO
              </span>
              <h2>Cinco empresas, uma estrutura conectada.</h2>
              <p>Saiba o que cada uma faz para direcionar o cliente para o lugar certo.</p>
            </header>

            <div className="onb-grid onb-grid--3">
              {companies.map((company) => (
                <article
                  key={company.id}
                  className="onb-card onb-company"
                  style={{ "--accent": company.accent } as React.CSSProperties}
                >
                  <small className="onb-company__eyebrow">{company.eyebrow}</small>
                  <h3>{company.name}</h3>
                  <p>{company.description}</p>
                  <ul className="onb-list">
                    {companyServices[company.id]?.map((service) => (
                      <li key={service}>{service}</li>
                    ))}
                  </ul>
                  <Link href={company.href} className="onb-link">
                    Ver página da empresa
                    <ArrowRight size={15} />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="grupo-produtos" className="onb-section">
          <div className="container">
            <header className="onb-section__head">
              <span className="eyebrow">
                <Gift size={13} />
                PRODUTOS
              </span>
              <h2>Nossos produtos digitais.</h2>
              <p>
                Plataformas próprias que complementam os serviços das empresas. O QXBACK é o que
                você mais vai usar no dia a dia, porque está ligado ao CRM.
              </p>
            </header>

            <article className="onb-card onb-product" style={{ "--accent": "#79ef2d" } as React.CSSProperties}>
              <div className="onb-product__head">
                <div>
                  <small className="onb-company__eyebrow">Indicação & bonificação</small>
                  <h3>QXBACK</h3>
                </div>
                <a href="https://qxback.com.br" target="_blank" rel="noopener noreferrer" className="onb-link">
                  qxback.com.br
                  <ArrowUpRight size={15} />
                </a>
              </div>
              <p>
                Programa de indicação do grupo: quem indica uma empresa que contrata nossos serviços
                ganha bônus e cashback (o &quot;QXBack&quot;). Cada indicação vira um negócio no
                pipeline QXBACK do CRM, e o andamento do card atualiza automaticamente o indicador.
              </p>

              <ol className="onb-steps">
                {qxbackSteps.map((step, index) => (
                  <li key={step.title}>
                    <span className="onb-steps__number">{String(index + 1).padStart(2, "0")}</span>
                    <h4>{step.title}</h4>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>

              <div className="onb-rules">
                <small>REGRAS IMPORTANTES</small>
                <ul className="onb-list">
                  {qxbackRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </article>

            <div className="onb-grid onb-grid--2">
              {otherProducts.map((product) => {
                const Icon = product.icon;
                return (
                  <article
                    key={product.id}
                    className="onb-card onb-company"
                    style={{ "--accent": product.accent } as React.CSSProperties}
                  >
                    <div className="onb-card__icon">
                      <Icon size={22} />
                    </div>
                    <small className="onb-company__eyebrow">{product.kicker}</small>
                    <h3>{product.name}</h3>
                    <p>{product.text}</p>
                    {product.external ? (
                      <a href={product.href} target="_blank" rel="noopener noreferrer" className="onb-link">
                        {product.href.replace("https://", "")}
                        <ArrowUpRight size={15} />
                      </a>
                    ) : (
                      <Link href={product.href} className="onb-link">
                        Ver página
                        <ArrowRight size={15} />
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="crm" className="onb-section onb-section--alt">
          <div className="container">
            <header className="onb-section__head">
              <span className="eyebrow">
                <SquareKanban size={13} />
                CRM INTERNO
              </span>
              <h2>Onde o trabalho acontece.</h2>
              <p>
                O CRM do grupo concentra negócios, tarefas, contatos e as indicações do QXBACK. Veja
                o essencial para começar.
              </p>
            </header>

            <div className="onb-grid onb-grid--3">
              {crmFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="onb-card">
                    <div className="onb-card__icon">
                      <Icon size={22} />
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="onb-center">
              <Link href="/login" className="onb-button">
                Acessar o CRM
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="fechamento" className="onb-section">
          <div className="container">
            <header className="onb-section__head">
              <span className="eyebrow">
                <ClipboardCheck size={13} />
                CONTROLE DE FECHAMENTO
              </span>
              <h2>O fechamento do mês, empresa por empresa.</h2>
              <p>
                O Controle de Fechamento (QMAX OS) é onde os setores Fiscal, Contábil, DP e BPO
                acompanham, todo mês, as obrigações de cada empresa cliente. Ele substitui as
                planilhas de controle e já recebe do GOB Core o que foi transmitido.
              </p>
            </header>

            <article className="onb-card onb-product">
              <div className="onb-product__head">
                <div>
                  <small className="onb-company__eyebrow">Como funciona</small>
                  <h3>Ciclo mensal</h3>
                </div>
                <a href={closingUrl} target="_blank" rel="noopener noreferrer" className="onb-link">
                  Abrir o Controle de Fechamento
                  <ArrowUpRight size={15} />
                </a>
              </div>

              <ol className="onb-steps">
                {closingSteps.map((step, index) => (
                  <li key={step.title}>
                    <span className="onb-steps__number">{String(index + 1).padStart(2, "0")}</span>
                    <h4>{step.title}</h4>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>

              <div className="onb-rules">
                <small>
                  <KeyRound size={12} /> REGRAS IMPORTANTES
                </small>
                <ul className="onb-list">
                  {closingRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </article>

            <div className="onb-grid onb-grid--3">
              {closingModules.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.title} className="onb-card">
                    <div className="onb-card__icon">
                      <Icon size={22} />
                    </div>
                    <h3>{module.title}</h3>
                    <p>{module.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="primeira-semana" className="onb-section onb-section--alt">
          <div className="container onb-narrow">
            <header className="onb-section__head">
              <span className="eyebrow">
                <ListChecks size={13} />
                PRIMEIRA SEMANA
              </span>
              <h2>Seu roteiro para os primeiros dias.</h2>
            </header>

            <ul className="onb-checklist">
              {firstWeek.map((item) => (
                <li key={item}>
                  <CheckCircle2 size={20} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="duvidas" className="onb-section">
          <div className="container onb-narrow">
            <header className="onb-section__head">
              <span className="eyebrow">
                <Sparkles size={13} />
                DÚVIDAS E CONTATOS
              </span>
              <h2>Perguntas frequentes</h2>
            </header>

            {faqs.map((faq) => (
              <details key={faq.question} className="onb-faq">
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}

            <div className="onb-contact">
              <a href={`mailto:${contact.email}`}>
                <Mail size={18} />
                {contact.email}
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Phone size={18} />
                {contact.phone}
              </a>
              <span>
                <MapPin size={18} />
                {contact.address}
              </span>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
