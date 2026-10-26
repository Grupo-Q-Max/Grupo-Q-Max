"use client";

import {
  BookOpen,
  Smartphone,
  Sparkles,
  PackageCheck,
  Tv,
  MessageSquare,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Trophy,
  ShieldCheck,
  Users,
  QrCode,
  Zap,
  ArrowRight,
  Layers,
  Crown,
  Printer,
  Calendar,
  Clock,
  Compass,
  FileSpreadsheet,
  Lock,
  Radio,
  Sliders,
  ChevronRight,
  Copy,
  Check,
  Keyboard,
  Globe,
  Flame,
  LayoutDashboard,
  Gift,
  ListOrdered,
  ShieldAlert,
  Mail,
  Package,
  Ticket,
  BarChart3,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FinoraLogo, QmaxBrandLogo } from "@/components/brand/Brand";

// route: slug do evento ativo (rota pública /<slug>/...).
export default function FieldGuideView({ route }: { route: string }) {
  const activeSlug = route || "clinicorp";
  const [activeTab, setActiveTab] = useState<"sitemap" | "pop" | "shortcuts" | "faq">("sitemap");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  function copyToClipboard(url: string) {
    if (typeof window !== "undefined" && navigator.clipboard) {
      const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  }

  // Grupos de rotas para o Mapa Geral
  const publicRoutes = [
    {
      title: "Totem de Cadastro do Participante",
      path: `/${activeSlug}/cadastro`,
      badge: "Público / Estande",
      badgeColor: "bg-[#E6F0FF] text-finora-600 border-[#B9D4F7]",
      desc: "Formulário onde o visitante digita nome, CPF, WhatsApp, e-mail e porte da clínica (cadeiras). Possui validação matemática de CPF, suporte a modo offline e detecção automática de cartão VIP (?vip=...).",
      icon: Smartphone,
      isExternal: true,
    },
    {
      title: "Roleta Interativa Oficial (Tablet)",
      path: `/${activeSlug}/roleta`,
      badge: "Tablet / Operador",
      badgeColor: "bg-[#EFEBFD] text-[#6B4FD8] border-[#D4C7F9]",
      desc: "Tela do tablet no estande. Exibe a fila em tempo real com atalhos numéricos [1] a [9]. Quando um participante com Bilhete Dourado é selecionado, a roleta acende em ouro com o botão 'Girar Roleta VIP'.",
      icon: Sparkles,
      isExternal: true,
    },
    {
      title: "Cofre VIP Interativo",
      path: `/${activeSlug}/cofre`,
      badge: "Experiência Especial",
      badgeColor: "bg-amber-50 text-amber-900 border-amber-300",
      desc: "Ativação alternativa para abertura de cofre digital com som de engrenagens procedurais, cracking de dígitos e fanfarra de vitória.",
      icon: Lock,
      isExternal: true,
    },
    {
      title: "Telão de Alta Definição & TV do Estande",
      path: `/tv`,
      altPath: `/${activeSlug}/telao`,
      badge: "Smart TV / Telão",
      badgeColor: "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]",
      desc: "Exibição contínua para a Smart TV virada para o corredor. Toca acorde harmônico de aeroporto e aciona locutora em português chamando os doutores e VIPs pelo nome. Tecla [F] ativa tela cheia.",
      icon: Tv,
      isExternal: true,
    },
    {
      title: "Super Sorteio Geral de Palco",
      path: `/${activeSlug}/sorteio-geral`,
      badge: "Palco Principal",
      badgeColor: "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]",
      desc: "Tela monumental para o momento de encerramento no palco. Roleta cinematográfica de participantes, efeito de suspense e chuva de confetes digitais.",
      icon: Trophy,
      isExternal: true,
    },
    {
      title: "Landing Page Oficial do Evento",
      path: `/${activeSlug}`,
      badge: "Público Geral",
      badgeColor: "bg-paper text-text-2 border-line",
      desc: "Página de boas-vindas com a identidade visual e cores oficiais do evento, botão de acesso ao cadastro e regulamento.",
      icon: Globe,
      isExternal: true,
    },
  ];

  const commercialRoutes = [
    {
      title: "Gestão de Participantes & Leads",
      path: "/admin/participantes",
      badge: "Comercial / SDR",
      badgeColor: "bg-amber-50 text-amber-900 border-amber-300",
      desc: "Painel comercial com filtro '👑 Grandes Clínicas (6+ Cadeiras)', botão de 1-Clique WhatsApp Web pré-preenchido, exportação de planilha CSV e exportação de contatos vCard (.vcf) direto para a agenda do celular.",
      icon: Users,
    },
    {
      title: "Agenda Comercial & Reuniões VIP",
      path: "/admin/agenda",
      badge: "Consultores / SDR",
      badgeColor: "bg-[#E6F0FF] text-finora-600 border-[#B9D4F7]",
      desc: "Grade horária com todos os doutores que têm consultoria agendada no estande. Botão Zap direto para confirmar a presença, marcação de concluída ou no-show e disparo automático do CSAT pós-reunião.",
      icon: Calendar,
    },
    {
      title: "Códigos VIP & Bilhetes Dourados",
      path: "/admin/codigos-vip",
      badge: "Diretoria / Mentoria",
      badgeColor: "bg-amber-100 text-amber-900 border-amber-400",
      desc: "Geração em lote de códigos VIP de mentorado. Visualizador do Bilhete Dourado com animação de luz metálica, cópia de link individual para WhatsApp e modo de impressão gráfica para crachás físicos.",
      icon: Crown,
    },
    {
      title: "Balcão Rápido de Entrega de Brindes",
      path: "/admin/balcao",
      badge: "Operadores de Balcão",
      badgeColor: "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]",
      desc: "Entrega instantânea de brindes mediante digitação do PIN numérico de 4 dígitos ou leitura do QR Code do participante. Dá baixa no estoque automaticamente.",
      icon: Gift,
    },
    {
      title: "Placa de Balcão em Acrílico (A4)",
      path: "/admin/placa-stand",
      badge: "Gráfica / Recepção",
      badgeColor: "bg-[#EFEBFD] text-[#6B4FD8] border-[#D4C7F9]",
      desc: "Folha padrão A4 pronta para impressão, feita para ser colocada no display de acrílico do estande com QR Code gigante para os participantes escanearem.",
      icon: Printer,
    },
    {
      title: "Painel de Controle do Sorteio Geral",
      path: "/admin/sorteio-final",
      badge: "Mestre de Cerimônias",
      badgeColor: "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]",
      desc: "Mesa de controle do sorteio de encerramento no palco. Permite filtrar elegíveis, disparar o sorteio por teclado ([Espaço] ou [Enter]) e registrar o ganhador oficial.",
      icon: Sparkles,
    },
  ];

  const adminRoutes = [
    {
      title: "Dashboard Geral em Tempo Real",
      path: "/admin/dashboard",
      badge: "Visão Executiva",
      badgeColor: "bg-[#E6F0FF] text-finora-600 border-[#B9D4F7]",
      desc: "Indicadores em tempo real: total de giros, estoque disponível por brinde, pacing de consumo e taxa de conversão do estande.",
      icon: LayoutDashboard,
    },
    {
      title: "Prêmios & Controle de Estoque",
      path: "/admin/premios",
      badge: "Logística",
      badgeColor: "bg-paper text-text border-line",
      desc: "Cadastro de novos brindes, quantidades totais, probabilidade no sorteio e configuração do alerta de estoque baixo.",
      icon: Package,
    },
    {
      title: "Fila de Premiação da Roleta",
      path: "/admin/fila",
      badge: "Roleta / Estoque",
      badgeColor: "bg-paper text-text border-line",
      desc: "Ajuste manual e automático da sequência de brindes que sairão na roleta do estande.",
      icon: ListOrdered,
    },
    {
      title: "Sistema Antifraude & Whitelist",
      path: "/admin/antifraude",
      badge: "Segurança",
      badgeColor: "bg-[#FDE8EC] text-[#A3112F] border-[#F5C2CD]",
      desc: "Regras de bloqueio por CPF duplicado, telefone, dispositivo ou IP. Inclui Whitelist de números para testes ilimitados da equipe e diretoria.",
      icon: ShieldAlert,
    },
    {
      title: "Comunicação & Disparos WhatsApp",
      path: "/admin/comunicacao",
      badge: "Marketing",
      badgeColor: "bg-[#E3F6EA] text-[#0F7A3D] border-[#B7E4C7]",
      desc: "Envio de transmissões e avisos em massa para todos os participantes do evento pelo WhatsApp.",
      icon: MessageSquare,
    },
    {
      title: "Modelos de Mensagem (Templates)",
      path: "/admin/mensagens",
      badge: "Marketing",
      badgeColor: "bg-paper text-text border-line",
      desc: "Editor de textos das mensagens automáticas com tags dinâmicas e tecnologia Spintax anti-bloqueio.",
      icon: Mail,
    },
    {
      title: "Configurações da Z-API & Evento",
      path: "/admin/configuracoes",
      badge: "TI / Suporte",
      badgeColor: "bg-paper text-text border-line",
      desc: "Conexão da instância WhatsApp via QR Code Z-API, chaves de API e alternância de eventos.",
      icon: Settings,
    },
    {
      title: "Relatórios & Métricas Consolidadas",
      path: "/admin/relatorios",
      badge: "Pós-Evento",
      badgeColor: "bg-[#E6F0FF] text-finora-600 border-[#B9D4F7]",
      desc: "Auditoria completa de todos os giros, premiações entregues, horários de pico e logs de segurança.",
      icon: BarChart3,
    },
  ];

  const shortcuts = [
    {
      key: "1 a 9",
      context: "Roleta do Estande",
      action: "Seleciona imediatamente o 1º até o 9º participante na fila da roleta sem precisar clicar.",
    },
    {
      key: "Espaço ou Enter",
      context: "Roleta / Sorteio Geral / Cofre",
      action: "Aciona o giro da roleta, abre o cofre VIP ou inicia o grande sorteio no palco.",
    },
    {
      key: "/",
      context: "Roleta & Participantes",
      action: "Foca instantaneamente na barra de busca de nome, CRO, clínica ou telefone.",
    },
    {
      key: "F",
      context: "Telão TV / Roleta / Sorteio Palco",
      action: "Alterna para o modo Tela Cheia (Fullscreen) limpo, sem barra do navegador.",
    },
    {
      key: "M",
      context: "Telão TV / Sorteio Palco",
      action: "Muta ou ativa os efeitos sonoros, acorde de aeroporto e a locutora vocal em português.",
    },
    {
      key: "Esc",
      context: "Modais e Gavetas",
      action: "Fecha qualquer janela pop-up, gaveta lateral de detalhes ou modal do Bilhete Dourado.",
    },
  ];

  const popSteps = [
    {
      step: 1,
      tag: "INÍCIO DO DIA",
      title: "1. Abertura do Estande & Checklist",
      icon: Layers,
      href: "/admin",
      btnText: "Abrir Dashboard",
      items: [
        "Verifique se o sinal Wi-Fi ou 4G/5G dos tablets está estável.",
        "Abra o Dashboard Principal (/admin) no notebook da coordenação.",
        "Certifique-se de que a Z-API (WhatsApp) consta como CONECTADA em Configurações.",
        "Imprima a Placa do Stand (/admin/placa-stand) e coloque no display de acrílico do balcão.",
      ],
    },
    {
      step: 2,
      tag: "CADASTRO & CAPTAÇÃO",
      title: "2. Cadastro do Visitante (Totem/Placa)",
      icon: Smartphone,
      href: `/${activeSlug}/cadastro`,
      btnText: "Abrir Tela de Cadastro",
      items: [
        "Oriente o visitante a escanear a placa do estande para preencher o formulário.",
        "O E-mail e o Telefone são validados no momento da digitação.",
        "Quem responde '6 ou mais cadeiras' é marcado como Lead Ouro / Prioritário.",
        "Quem possui Bilhete Dourado (Mentorado) recebe imediatamente o badge VIP e cupom do telão.",
      ],
    },
    {
      step: 3,
      tag: "ROLETA & PREMIAÇÃO",
      title: "3. Giro na Roleta Oficial",
      icon: PackageCheck,
      href: `/${activeSlug}/roleta`,
      btnText: "Abrir Roleta",
      items: [
        "O operador no tablet digita o número [1] a [9] para selecionar o visitante que chegou na fila.",
        "Pressione [Espaço] para disparar o giro da roleta.",
        "Se o participante for VIP, a roleta acende dourada com o Pool VIP de mentorados.",
        "O participante recebe seu PIN de 4 dígitos na tela e no WhatsApp.",
      ],
    },
    {
      step: 4,
      tag: "BALCÃO DE ENTREGA",
      title: "4. Baixa do Brinde no Estoque",
      icon: Gift,
      href: "/admin/balcao",
      btnText: "Abrir Balcão",
      items: [
        "No notebook do balcão, digite o PIN de 4 dígitos do visitante.",
        "Confirme o brinde físico entregue.",
        "O estoque atualiza em tempo real e o pacing do evento recalcula a liberação dos próximos brindes.",
      ],
    },
    {
      step: 5,
      tag: "ATENDIMENTO COMERCIAL",
      title: "5. Agenda Comercial & 1-Clique WhatsApp",
      icon: Calendar,
      href: "/admin/agenda",
      btnText: "Abrir Agenda",
      items: [
        "O comercial acompanha os horários agendados em /admin/agenda.",
        "Clique no botão verde 'Zap' para falar com o doutor em 1 clique sem salvar o contato.",
        "Ao concluir a reunião, clique em '[ Concluída ]': o sistema dispara automaticamente a pesquisa CSAT em 15 minutos.",
        "Exporte o arquivo .vcf em /admin/participantes para salvar todos os 200+ contatos no celular de uma vez.",
      ],
    },
    {
      step: 6,
      tag: "SHOW DE ENCERRAMENTO",
      title: "6. Grande Sorteio no Telão Principal",
      icon: Trophy,
      href: `/${activeSlug}/sorteio-geral`,
      btnText: "Abrir Sorteio do Telão",
      items: [
        "Projete a tela /${activeSlug}/sorteio-geral no telão do estande ou do auditório.",
        "Aperte [F] para deixar em tela cheia e [M] para garantir o áudio ligado.",
        "Pressione [Espaço] para acionar a revelação com suspense e chuva de confetes.",
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-6 text-text font-sans max-w-6xl mx-auto w-full pb-16">
      {/* Banner Principal com Navegação Rápida */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-line bg-surface p-6 md:p-8 backdrop-blur shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <QmaxBrandLogo variant="dark" height={22} />
              <span className="h-4 w-px bg-slate-300" />
              <FinoraLogo height={20} />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-black px-3.5 py-1 rounded-full bg-[#E6F0FF] text-finora-600 border border-[#B9D4F7] uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                <Compass size={14} /> CENTRAL DE CONTROLE & MAPA DO EVENTO
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-paper text-text-2 border border-line">
                Evento: <strong className="text-text capitalize">{activeSlug}</strong>
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-black tracking-tight text-text">
              Guia Geral de Rotas, Redirecionamentos & Operação
            </h1>
            <p className="text-xs md:text-sm text-text-2 mt-1.5 max-w-2xl leading-relaxed">
              Consulte e acesse todas as telas do sistema com 1 clique: totens do estande, painéis de TV, ferramentas comerciais e backoffice administrativo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${activeSlug}/cadastro`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <span>Abrir Totem Cadastro</span>
              <ExternalLink size={14} />
            </Link>
            <Link
              href="/tv"
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0C1222] hover:bg-[#18233C] text-[#00E5FF] text-xs font-bold border border-cyan-500/30 shadow-md transition-all active:scale-95"
            >
              <Tv size={14} />
              <span>Abrir TV/Telão</span>
            </Link>
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 pt-5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("sitemap")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "sitemap"
                ? "bg-finora-600 text-white shadow-sm"
                : "bg-paper text-text-2 hover:text-text border border-line"
            }`}
          >
            <Compass size={15} />
            <span>Mapa de Rotas & Links Diretos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pop")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "pop"
                ? "bg-finora-600 text-white shadow-sm"
                : "bg-paper text-text-2 hover:text-text border border-line"
            }`}
          >
            <BookOpen size={15} />
            <span>Manual Operacional (POP)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("shortcuts")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "shortcuts"
                ? "bg-finora-600 text-white shadow-sm"
                : "bg-paper text-text-2 hover:text-text border border-line"
            }`}
          >
            <Keyboard size={15} />
            <span>Atalhos de Teclado</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("faq")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === "faq"
                ? "bg-finora-600 text-white shadow-sm"
                : "bg-paper text-text-2 hover:text-text border border-line"
            }`}
          >
            <HelpCircle size={15} />
            <span>Dúvidas & Suporte Rápido</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: MAPA GERAL DE ROTAS & REDIRECIONAMENTOS */}
      {activeTab === "sitemap" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Categoria 1: Telas do Estande & Participantes */}
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="grid size-7 place-items-center rounded-lg bg-[#E6F0FF] text-finora-600">
                <Smartphone size={16} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-text">Telas Públicas & Experiências no Estande</h2>
                <p className="text-xs text-text-2">Telas abertas nos tablets, totens e na Smart TV de frente para o corredor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicRoutes.map((r) => {
                const IconComponent = r.icon;
                return (
                  <div key={r.path} className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4.5 shadow-2xs hover:border-line-strong transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${r.badgeColor}`}>
                          {r.badge}
                        </span>
                        <IconComponent size={17} className="text-finora-600 shrink-0" />
                      </div>

                      <h3 className="text-sm font-bold text-text mb-1.5">{r.title}</h3>
                      <p className="text-xs text-text-2 leading-relaxed mb-3">{r.desc}</p>
                    </div>

                    <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-finora-700 truncate max-w-[170px]" title={r.path}>
                        {r.path}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(r.path)}
                          className="p-1.5 rounded-lg border border-line hover:bg-paper text-text-2 hover:text-text transition-all cursor-pointer"
                          title="Copiar link"
                        >
                          {copiedUrl === r.path ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        </button>
                        <Link
                          href={r.path}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E6F0FF] hover:bg-finora-600 text-finora-700 hover:text-white text-xs font-bold transition-all cursor-pointer"
                        >
                          <span>Abrir</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categoria 2: Comercial & Atendimento */}
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="grid size-7 place-items-center rounded-lg bg-amber-100 text-amber-900">
                <Users size={16} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-text">Gestão Comercial, Leads & Atendimento</h2>
                <p className="text-xs text-text-2">Ferramentas de conversão direta, WhatsApp 1-clique, agenda e balcão</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commercialRoutes.map((r) => {
                const IconComponent = r.icon;
                return (
                  <div key={r.path} className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4.5 shadow-2xs hover:border-line-strong transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${r.badgeColor}`}>
                          {r.badge}
                        </span>
                        <IconComponent size={17} className="text-amber-800 shrink-0" />
                      </div>

                      <h3 className="text-sm font-bold text-text mb-1.5">{r.title}</h3>
                      <p className="text-xs text-text-2 leading-relaxed mb-3">{r.desc}</p>
                    </div>

                    <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-amber-900 truncate max-w-[170px]" title={r.path}>
                        {r.path}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(r.path)}
                          className="p-1.5 rounded-lg border border-line hover:bg-paper text-text-2 hover:text-text transition-all cursor-pointer"
                          title="Copiar link"
                        >
                          {copiedUrl === r.path ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        </button>
                        <Link
                          href={r.path}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          <span>Acessar</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categoria 3: Configuração & Inteligência */}
          <div>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="grid size-7 place-items-center rounded-lg bg-[#EFEBFD] text-[#6B4FD8]">
                <Settings size={16} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-text">Inteligência, Estoque & Configurações de Sistema</h2>
                <p className="text-xs text-text-2">Controle de estoque, antifraude, integrações WhatsApp e auditoria</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {adminRoutes.map((r) => {
                const IconComponent = r.icon;
                return (
                  <div key={r.path} className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-2xs hover:border-line-strong transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${r.badgeColor}`}>
                          {r.badge}
                        </span>
                        <IconComponent size={15} className="text-text-2 shrink-0" />
                      </div>

                      <h3 className="text-xs font-bold text-text mb-1">{r.title}</h3>
                      <p className="text-[11px] text-text-2 leading-relaxed mb-3 line-clamp-3">{r.desc}</p>
                    </div>

                    <div className="pt-2.5 border-t border-line flex items-center justify-between gap-1">
                      <span className="font-mono text-[10px] text-text-2 truncate max-w-[120px]" title={r.path}>
                        {r.path}
                      </span>
                      <Link
                        href={r.path}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#EEF1F5] hover:bg-line-strong text-text text-[11px] font-bold transition-all"
                      >
                        <span>Ir</span>
                        <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: MANUAL OPERACIONAL (POP) */}
      {activeTab === "pop" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {popSteps.map((s) => {
            const IconComponent = s.icon;
            return (
              <div
                key={s.step}
                className="bg-surface border-2 border-line p-6 rounded-3xl backdrop-blur hover:border-line-strong transition-all flex flex-col md:flex-row justify-between gap-6"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-[#E6F0FF] text-finora-600 border border-[#B9D4F7] uppercase tracking-wider">
                      PASSO {s.step}
                    </span>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-paper text-text-2 border border-line uppercase tracking-wider">
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold text-text flex items-center gap-2">
                    <IconComponent size={20} className="text-finora-600 shrink-0" />
                    <span>{s.title}</span>
                  </h3>

                  <ul className="mt-3 space-y-2 text-xs text-text">
                    {s.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                        <CheckCircle2 size={15} className="text-[#0F7A3D] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex md:flex-col justify-end md:justify-center shrink-0">
                  <Link
                    href={s.href}
                    className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-full bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all border border-[#B9D4F7] whitespace-nowrap shadow-xs"
                  >
                    <span>{s.btnText}</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: ATALHOS DE TECLADO */}
      {activeTab === "shortcuts" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-line rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="grid size-9 place-items-center rounded-xl bg-[#E6F0FF] text-finora-600">
                <Keyboard size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-text">Atalhos de Teclado para a Equipe</h3>
                <p className="text-xs text-text-2">Acelere o atendimento no estande e opere a roleta ou telão sem usar o mouse</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {shortcuts.map((sc) => (
                <div key={sc.key} className="flex items-start gap-3.5 p-4 rounded-2xl border border-line bg-paper">
                  <kbd className="px-3 py-1.5 rounded-lg border-2 border-line-strong bg-surface text-text font-mono text-xs font-black shadow-xs shrink-0 min-w-14 text-center">
                    {sc.key}
                  </kbd>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-finora-600 block mb-0.5">
                      {sc.context}
                    </span>
                    <p className="text-xs text-text font-medium leading-relaxed">
                      {sc.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: FAQ & RESOLUÇÃO RÁPIDA DE PROBLEMAS */}
      {activeTab === "faq" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-surface border-2 border-line p-6 md:p-8 rounded-3xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#FFF3DC] border border-[#F2D19B] flex items-center justify-center text-[#8A4B00]">
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text text-base">
                  Perguntas Frequentes & Resolução Rápida de Suporte
                </h3>
                <p className="text-xs text-text-2">
                  Soluções imediatas para os principais contratempos no dia do evento
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-paper border border-line rounded-2xl">
                <strong className="text-[#8A4B00] font-bold block mb-1">
                  • O participante digitou o WhatsApp errado?
                </strong>
                <p className="text-text leading-relaxed">
                  Acesse <strong>Participantes</strong> (/admin/participantes), localize o doutor, clique na linha para abrir a gaveta lateral e use o botão direto do WhatsApp. O prêmio também pode ser entregue normalmente pelo PIN numérico no Balcão Rápido.
                </p>
              </div>

              <div className="p-4 bg-paper border border-line rounded-2xl">
                <strong className="text-[#8A4B00] font-bold block mb-1">
                  • Como liberar giros de teste para diretores ou promotores?
                </strong>
                <p className="text-text leading-relaxed">
                  Acesse <strong>Antifraude</strong> (/admin/antifraude) no menu lateral e adicione o número de telefone ou CPF da pessoa na <strong>Whitelist de Isenção</strong> para giros ilimitados sem travar a base real.
                </p>
              </div>

              <div className="p-4 bg-paper border border-line rounded-2xl">
                <strong className="text-[#8A4B00] font-bold block mb-1">
                  • E se a internet do pavilhão oscilar ou cair?
                </strong>
                <p className="text-text leading-relaxed">
                  O formulário de cadastro possui <strong>Modo Offline com sincronização automática</strong> em cache local. Os cadastros são armazenados no navegador do tablet e enviados para o servidor assim que a conexão retornar, sem perder nenhum doutor.
                </p>
              </div>

              <div className="p-4 bg-paper border border-line rounded-2xl">
                <strong className="text-[#8A4B00] font-bold block mb-1">
                  • Como importar todos os contatos para o WhatsApp do vendedor?
                </strong>
                <p className="text-text leading-relaxed">
                  Em <strong>Participantes</strong> (/admin/participantes), clique no botão <strong>"Salvar no Celular (.vcf)"</strong>. Envie o arquivo gerado para o celular do vendedor; ao abrir, o iPhone ou Android adiciona todos os contatos com 1 clique na agenda.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
