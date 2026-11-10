"use client";

import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { FinoraLogo, QmaxBrandLogo } from "@/components/brand/Brand";
import { ShieldCheck, Sparkles, Layers, Zap } from "lucide-react";

export default function AdminLoginClient() {
  return (
    <main className="relative grid min-h-dvh grid-cols-1 overflow-hidden bg-ink-950 text-ink-text lg:grid-cols-[1.1fr_480px] xl:grid-cols-[1.2fr_520px]">
      {/* Glows de ambientação institucional */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 size-[600px] rounded-full bg-[radial-gradient(circle,rgba(217,15,129,0.15),transparent_70%)] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-1/4 size-[550px] rounded-full bg-[radial-gradient(circle,rgba(0,119,255,0.12),transparent_70%)] blur-3xl"
      />

      {/* Lado Esquerdo: Apresentação da Marca & Atributos do Sistema */}
      <div className="relative z-10 flex flex-col justify-between gap-10 px-8 py-10 sm:px-14 md:py-16 lg:px-20">
        <div className="flex items-center gap-3">
          <QmaxBrandLogo height={28} />
          <span className="h-5 w-px bg-ink-line/80" />
          <FinoraLogo height={24} />
          <span className="h-5 w-px bg-ink-line/80" />
          <span className="font-mono text-xs tracking-widest text-ink-text-2 uppercase">
            Finora Experience
          </span>
        </div>

        <div className="my-auto flex max-w-2xl flex-col gap-6 py-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-ink-line bg-ink-900/80 px-3.5 py-1.5 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-ink-text-2 uppercase">
              Painel Operacional & Gestão
            </span>
          </div>

          <h1 className="font-display text-[clamp(36px,4.5vw,60px)] leading-[1.02] font-black tracking-[-0.04em] text-white">
            Controle integrado de ativações & estandes.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-ink-text-2 sm:text-lg">
            Gestão em tempo real das experiências de <strong className="font-semibold text-white">Roleta</strong> e <strong className="font-semibold text-white">Cofre Premiado</strong>, balcão de prêmios, antifraude de alta fidelidade e auditoria completa.
          </p>

          {/* Destaques do ecossistema */}
          <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-ink-line/60 bg-ink-900/60 p-4 backdrop-blur-md">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-[#d90f81]">
                <Layers size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Multi-Eventos</span>
                <span className="text-xs text-ink-text-2">Invictus e Clinicorp com perfis customizados e isolados.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-ink-line/60 bg-ink-900/60 p-4 backdrop-blur-md">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-sky-400">
                <ShieldCheck size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Blindagem Antifraude</span>
                <span className="text-xs text-ink-text-2">Validação de CPF, IP, dispositivo e histórico de participações.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-ink-line/60 bg-ink-900/60 p-4 backdrop-blur-md">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-amber-400">
                <Sparkles size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Premiação & Estoque</span>
                <span className="text-xs text-ink-text-2">Fila determinística e controle de estoque de brindes no balcão.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-ink-line/60 bg-ink-900/60 p-4 backdrop-blur-md">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-emerald-400">
                <Zap size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">WhatsApp & Agenda</span>
                <span className="text-xs text-ink-text-2">Comunicação automatizada e agendamentos comerciais VIP.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-line/50 pt-6 text-xs text-ink-text-2">
          <span>© 2026 Grupo Q-Max & Finora. Todos os direitos reservados.</span>
          <span className="font-mono text-[11px] text-[#7D8AA3]">Ambiente Criptografado & Auditado</span>
        </div>
      </div>

      {/* Lado Direito: Formulário de Autenticação */}
      <div className="relative z-10 flex flex-col justify-center border-t border-ink-line/50 bg-paper px-6 py-12 text-text sm:px-12 md:px-14 lg:border-t-0 lg:border-l lg:border-ink-line/60 lg:shadow-[-20px_0_60px_rgba(0,0,0,0.4)]">
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-finora-600 uppercase">
              Acesso Restrito
            </span>
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-text">
              Entrar no painel
            </h2>
            <p className="text-sm text-text-2">
              Insira suas credenciais de administrador da equipe Grupo Q-Max ou Finora.
            </p>
          </div>

          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
