"use client";

import { useState } from "react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type AdminRole, canAccessAdminPage } from "@/lib/admin-access";
import { FinoraLogo, QmaxBrandLogo } from "@/components/brand/Brand";
import {
  LayoutDashboard,
  Gift,
  ListOrdered,
  Calendar,
  ShieldAlert,
  MessageSquare,
  Mail,
  Sparkles,
  Users,
  Package,
  Ticket,
  Flag,
  ShieldCheck,
  History,
  BarChart3,
  BookOpen,
  Settings,
  Disc,
  Menu,
  X,
  Printer,
  Send,
  Crown,
  Trophy,
  type LucideIcon,
} from "lucide-react";

type MenuItem = { label: string; href: string; icon?: LucideIcon };

const ICON_MAP: Record<string, LucideIcon> = {
  "/admin/dashboard": LayoutDashboard,
  "/admin/balcao": Gift,
  "/admin/premiacoes": Trophy,
  "/admin/fila": ListOrdered,
  "/admin/agenda": Calendar,
  "/admin/recompensas-vip": Crown,
  "/admin/placa-stand": Printer,
  "/admin/antifraude": ShieldAlert,
  "/admin/comunicacao": MessageSquare,
  "/admin/disparos": Send,
  "/admin/mensagens": Mail,
  "/admin/sorteio-final": Sparkles,
  "/admin/participantes": Users,
  "/admin/premios": Package,
  "/admin/codigos-vip": Ticket,
  "/admin/eventos": Flag,
  "/admin/usuarios": ShieldCheck,
  "/admin/historico": History,
  "/admin/relatorios": BarChart3,
  "/admin/guia": BookOpen,
  "/admin/configuracoes": Settings,
};

const GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: "OPERAÇÃO",
    items: [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Placa do Stand (A4)", href: "/admin/placa-stand" },
      { label: "Balcão de entrega", href: "/admin/balcao" },
      { label: "Premiações (Ganhadores)", href: "/admin/premiacoes" },
      { label: "Fila de premiação", href: "/admin/fila" },
      { label: "Agenda comercial", href: "/admin/agenda" },
      { label: "Recompensas VIP (Agenda)", href: "/admin/recompensas-vip" },
      { label: "Antifraude", href: "/admin/antifraude" },
    ],
  },
  {
    title: "COMUNICAÇÃO",
    items: [
      { label: "Acompanhar Disparos", href: "/admin/disparos" },
      { label: "Fila WhatsApp", href: "/admin/comunicacao" },
      { label: "Modelos de mensagem", href: "/admin/mensagens" },
    ],
  },
  { title: "SORTEIO", items: [{ label: "Sorteio Geral", href: "/admin/sorteio-final" }] },
  {
    title: "CADASTROS",
    items: [
      { label: "Participantes", href: "/admin/participantes" },
      { label: "Prêmios e estoque", href: "/admin/premios" },
      { label: "Códigos VIP", href: "/admin/codigos-vip" },
      { label: "Eventos", href: "/admin/eventos" },
      { label: "Administradores", href: "/admin/usuarios" },
    ],
  },
  {
    title: "SISTEMA",
    items: [
      { label: "Histórico", href: "/admin/historico" },
      { label: "Relatórios", href: "/admin/relatorios" },
      { label: "Guia do estande", href: "/admin/guia" },
      { label: "Configurações", href: "/admin/configuracoes" },
    ],
  },
];

function isItemActive(itemHref: string, currentPathname: string): boolean {
  const cleanHref = itemHref.replace(/\/+$/, "") || "/";
  const cleanPath = (currentPathname || "").replace(/\/+$/, "") || "/";
  return cleanPath === cleanHref || cleanPath.startsWith(`${cleanHref}/`);
}

export default function AdminSidebarNav({ role, roletas = [] }: { role: AdminRole; roletas?: MenuItem[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentEventId = searchParams.get("event") || searchParams.get("eventId");
  const eventQuery = currentEventId ? `?event=${currentEventId}` : "";

  return (
    <aside className="relative flex w-full shrink-0 flex-col border-b border-white/10 bg-[#050811] text-slate-300 min-[1025px]:sticky min-[1025px]:top-0 min-[1025px]:h-dvh min-[1025px]:w-64 min-[1025px]:border-r min-[1025px]:border-b-0 min-[1025px]:border-white/10">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-4 min-[1025px]:flex-col min-[1025px]:items-start min-[1025px]:gap-1 min-[1025px]:px-6 min-[1025px]:pt-6 min-[1025px]:pb-5 min-[1025px]:border-b min-[1025px]:border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <QmaxBrandLogo height={22} />
            <span className="h-4 w-px bg-white/20" />
            <FinoraLogo height={20} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#00E5FF] uppercase">
              Finora Experience
            </span>
            <span className="inline-block size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" />
          </div>
        </div>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 min-[1025px]:hidden"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Nav Content */}
      <nav
        aria-label="Menu do admin"
        className={`px-3 py-2 ${
          mobileOpen ? "flex flex-col gap-4 border-t border-white/10 bg-[#070B16] max-h-[calc(100vh-80px)] overflow-y-auto" : "hidden"
        } min-[1025px]:flex min-[1025px]:flex-1 min-[1025px]:flex-col min-[1025px]:gap-1 min-[1025px]:overflow-y-auto min-[1025px]:py-4`}
      >
        {GROUPS.map((group) => {
          const groupItems = group.title === "OPERAÇÃO" ? [...group.items.slice(0, 3), ...roletas, ...group.items.slice(3)] : group.items;
          const items = groupItems.filter((item) => canAccessAdminPage(role, item.href));
          if (items.length === 0) return null;

          return (
            <div key={group.title} className="flex flex-col gap-1">
              <span className="px-3 pt-3 pb-1 font-mono text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
                {group.title}
              </span>
              {items.map((item) => {
                const active = isItemActive(item.href, pathname);
                const Icon = ICON_MAP[item.href] || Disc;

                return (
                  <Link
                    key={item.href}
                    href={`${item.href}${eventQuery}`}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-[#D90F81]/25 via-white/[0.04] to-transparent text-white font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#D90F81] shadow-[0_0_12px_#D90F81]" />
                    )}
                    <Icon
                      size={17}
                      className={`flex-none transition-colors duration-200 ${
                        active ? "text-[#00E5FF]" : "text-slate-500 group-hover:text-slate-300"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Mobile logout inside collapsible */}
        <div className="mt-4 border-t border-white/10 pt-4 min-[1025px]:hidden">
          <AdminLogoutButton />
        </div>
      </nav>

      {/* Desktop Logout Button */}
      <div className="hidden border-t border-white/10 p-4 min-[1025px]:block">
        <AdminLogoutButton />
      </div>
    </aside>
  );
}

