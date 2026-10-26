import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { isPublicRoute } from './admin-mutation.guard';

// Limita só as rotas públicas. As administrativas chegam todas do admin-proxy
// (127.0.0.1) e já exigem a chave; contá-las por IP travaria o painel inteiro.
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    return !isPublicRoute(
      request.method,
      request.originalUrl || request.url || '',
    );
  }
}
