import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminMutationGuard, isPublicRoute } from './admin-mutation.guard';

function contextFor(
  method: string,
  url: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: url, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminMutationGuard', () => {
  const guard = new AdminMutationGuard();
  const originalKey = process.env.FINORA_ADMIN_API_KEY;

  afterEach(() => {
    process.env.FINORA_ADMIN_API_KEY = originalKey;
  });

  it('libera só rotas públicas ancoradas, pelo path e método', () => {
    expect(isPublicRoute('GET', '/api/v1/health')).toBe(true);
    expect(isPublicRoute('POST', '/api/v1/participants/register')).toBe(true);
    expect(isPublicRoute('GET', '/api/v1/participants/5/public')).toBe(true);
    expect(isPublicRoute('POST', '/api/v1/draws/participation/5')).toBe(true);
    expect(isPublicRoute('OPTIONS', '/api/v1/admin-users')).toBe(true);

    expect(isPublicRoute('GET', '/api/v1/admin-users?x=/health')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/admin-users/health')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/admin-users?x=/events')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/participants/5')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/participants/event/1')).toBe(false);
    expect(isPublicRoute('POST', '/api/v1/draws/event/1/grand-draw')).toBe(
      false,
    );
    expect(
      isPublicRoute('POST', '/api/v1/draws/event/1/grand-draw/2/claim'),
    ).toBe(false);
    expect(
      isPublicRoute('POST', '/api/v1/whatsapp/event/1/broadcast'),
    ).toBe(false);
    expect(isPublicRoute('DELETE', '/api/v1/events')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/dashboard/event/2/public')).toBe(
      true,
    );
    expect(isPublicRoute('GET', '/api/v1/dashboard/event/2')).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/live/event/2')).toBe(true);
    expect(isPublicRoute('POST', '/api/v1/live/event/2')).toBe(false);
    expect(
      isPublicRoute('GET', '/api/v1/participants/pending-draws?eventId=2'),
    ).toBe(false);
    expect(isPublicRoute('GET', '/api/v1/vip-codes/event/1')).toBe(false);
    expect(
      isPublicRoute('POST', '/api/v1/vip-codes/event/1/generate'),
    ).toBe(false);
  });

  it('exige a chave configurada em rotas administrativas', () => {
    process.env.FINORA_ADMIN_API_KEY = 'chave-de-teste';

    expect(
      guard.canActivate(
        contextFor('GET', '/api/v1/admin-users', {
          'x-finora-admin-key': 'chave-de-teste',
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        contextFor('GET', '/api/v1/admin-users', {
          'x-finora-admin-key': 'outra',
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('falha fechado sem FINORA_ADMIN_API_KEY', () => {
    delete process.env.FINORA_ADMIN_API_KEY;

    expect(() =>
      guard.canActivate(
        contextFor('GET', '/api/v1/admin-users', { 'x-finora-admin-key': '' }),
      ),
    ).toThrow(UnauthorizedException);
  });
});
