// Regras de acesso a páginas por perfil. Sem dependências de servidor: usado
// pelo proxy (bloqueio) e pelo menu lateral (esconder itens).

export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "OPERATOR" | "VIEWER";

export const ADMIN_ROLES: AdminRole[] = ["SUPER_ADMIN", "ADMIN", "OPERATOR", "VIEWER"];

// Página para onde o perfil é mandado quando abre uma página sem acesso.
export function adminHome(role: AdminRole): string {
  return role === "OPERATOR" ? "/admin/balcao/" : "/admin/dashboard/";
}

// Exportar a planilha de leads (dados pessoais completos).
export function canExportParticipants(role: AdminRole): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

// OPERATOR: só o balcão (/admin/balcao) e as roletas do estande (fora de /admin).
// VIEWER: só leitura; sem gestão de administradores, balcão nem roletas (ações).
export function canAccessAdminPage(role: AdminRole, pathname: string): boolean {
  if (!pathname.startsWith("/admin")) return role !== "VIEWER";
  if (role === "OPERATOR") return /^\/admin\/balcao\/?$/.test(pathname);
  if (role === "VIEWER") return !/^\/admin\/(usuarios|balcao)(\/|$)/.test(pathname);
  return true;
}
