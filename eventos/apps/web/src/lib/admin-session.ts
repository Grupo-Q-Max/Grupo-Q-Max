import { createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-access";

export type { AdminRole } from "@/lib/admin-access";

// Sessão admin por usuário: cookie "<payload base64url>.<HMAC-SHA256>", assinado
// com FINORA_ADMIN_SESSION_TOKEN. Sem a env, nenhuma sessão é criada nem aceita.

export const ADMIN_SESSION_COOKIE = "finora_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export type AdminSession = {
  uid: number;
  role: AdminRole;
  exp: number;
};

function getSecret(): string | null {
  return process.env.FINORA_ADMIN_SESSION_TOKEN?.trim() || null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSession(uid: number, role: AdminRole): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const session: AdminSession = {
    uid,
    role,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readAdminSession(token: string | undefined): AdminSession | null {
  const secret = getSecret();
  if (!secret || !token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !Number.isInteger(session?.uid) ||
      !ADMIN_ROLES.includes(session?.role) ||
      typeof session?.exp !== "number" ||
      session.exp < Date.now()
    ) {
      return null;
    }
    return session as AdminSession;
  } catch {
    return null;
  }
}

const OPERATOR_API: Array<[methods: string[], pattern: RegExp]> = [
  // Balcão (QuickClaimControl)
  [["GET", "HEAD"], /^events$/],
  [["GET"], /^draws\/participation\/\d+\/verify-claim$/],
  [["POST"], /^draws\/participation\/\d+\/claim$/],
  [["GET"], /^draws\/event\/\d+\/pending-claims$/],
  [["GET"], /^meetings\/event\/\d+\/available-slots$/],
  [["POST"], /^meetings\/event\/\d+\/book$/],
  // Roleta do estande (ClinicorpRouletteExperience)
  [["GET"], /^participants\/pending-draws$/],
  [["GET"], /^draws\/event\/\d+\/eligible-grand-draw$/],
  [["POST"], /^draws\/event\/\d+\/grand-draw$/],
  [["POST"], /^draws\/event\/\d+\/grand-draw\/\d+\/claim$/],
  [["POST"], /^prizes$/],
];

// relativePath: caminho depois de /api/admin-proxy/, sem barra inicial/final e sem query.
export function canAccessAdminApi(
  session: AdminSession,
  method: string,
  relativePath: string,
): boolean {
  const upperMethod = method.toUpperCase();

  // VIEWER: só leitura, sem a lista de administradores nem exportação de leads.
  if (session.role === "VIEWER") {
    return (
      (upperMethod === "GET" || upperMethod === "HEAD") &&
      !/^admin-users(\/|$)/.test(relativePath) &&
      !/\/export-(crm-)?csv$/.test(relativePath)
    );
  }

  if (session.role !== "OPERATOR") return true;
  return OPERATOR_API.some(
    ([methods, pattern]) => methods.includes(upperMethod) && pattern.test(relativePath),
  );
}
