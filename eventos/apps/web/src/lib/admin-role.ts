import { cookies } from "next/headers";
import type { AdminRole } from "@/lib/admin-access";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-session";

// Perfil da sessão admin atual (Server Components). Sem sessão válida, assume o
// perfil mais restrito; o proxy já redireciona para o login nesse caso.
export async function getAdminRole(): Promise<AdminRole> {
  const cookieStore = await cookies();
  const session = readAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  return session?.role ?? "VIEWER";
}
