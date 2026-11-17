import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Rotas públicas do fluxo de cadastro/roleta/telão. Sempre comparadas contra o
// path (sem query string), ancoradas e restritas ao método HTTP.
const PUBLIC_ROUTES: Array<[method: string, pattern: RegExp]> = [
  ['GET', /^\/api\/v1\/health\/?$/],
  ['POST', /^\/api\/v1\/participants\/register\/?$/],
  ['POST', /^\/api\/v1\/participants\/validate-whatsapp\/?$/],
  ['POST', /^\/api\/v1\/draws\/participation\/\d+\/?$/],
  ['GET', /^\/api\/v1\/prizes\/event\/\d+\/?$/],
  ['GET', /^\/api\/v1\/events\/?$/],
  ['POST', /^\/api\/v1\/admin-users\/login\/?$/],
  ['GET', /^\/api\/v1\/meetings\/event\/\d+\/available-slots\/?$/],
  ['POST', /^\/api\/v1\/meetings\/event\/\d+\/book\/?$/],
  ['GET', /^\/api\/v1\/whatsapp\/status\/?$/],
  ['GET', /^\/api\/v1\/dashboard\/event\/\d+\/public\/?$/],
  ['GET', /^\/api\/v1\/live\/event\/\d+\/?$/],
];

export function isPublicRoute(method: string, url: string): boolean {
  const upperMethod = method.toUpperCase();

  // Preflight de CORS
  if (upperMethod === 'OPTIONS') {
    return true;
  }

  const path = url.split('?')[0];

  return PUBLIC_ROUTES.some(
    ([routeMethod, pattern]) =>
      routeMethod === upperMethod && pattern.test(path),
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

@Injectable()
export class AdminMutationGuard implements CanActivate {
  private readonly logger = new Logger(AdminMutationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (
      isPublicRoute(request.method, request.originalUrl || request.url || '')
    ) {
      return true;
    }

    const expectedKey = (process.env.FINORA_ADMIN_API_KEY || '').trim();

    if (!expectedKey) {
      this.logger.error(
        'FINORA_ADMIN_API_KEY não configurada: rotas administrativas bloqueadas.',
      );
      throw new UnauthorizedException('Acesso administrativo não autorizado.');
    }

    if (!hasValidAdminKey(request)) {
      throw new UnauthorizedException('Acesso administrativo não autorizado.');
    }

    return true;
  }
}

// Chave administrativa válida: só o admin-proxy do web a envia.
export function hasValidAdminKey(request: Request): boolean {
  const expectedKey = (process.env.FINORA_ADMIN_API_KEY || '').trim();
  const received = request.headers['x-finora-admin-key'];
  const receivedKey = Array.isArray(received) ? received[0] : received;
  return Boolean(
    expectedKey && receivedKey && safeEqual(receivedKey.trim(), expectedKey),
  );
}

// Perfil do usuário do painel, repassado pelo admin-proxy junto com a chave.
// Sem o cabeçalho, conta como perfil restrito (dados mascarados).
export function isFullAdmin(request: Request): boolean {
  const header = request.headers['x-finora-admin-role'];
  const role = Array.isArray(header) ? header[0] : header;
  return hasValidAdminKey(request) && role === 'ADMIN';
}
