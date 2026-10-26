import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { PublicThrottlerGuard } from './public-throttler.guard';

@Controller()
class FakeController {
  @Get('health')
  health() {
    return 'ok';
  }

  @Get('dashboard')
  dashboard() {
    return 'ok';
  }
}

describe('PublicThrottlerGuard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [FakeController],
      providers: [{ provide: APP_GUARD, useClass: PublicThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(() => app.close());

  it('limita rota pública e ignora rota administrativa', async () => {
    const server = app.getHttpServer();

    await request(server).get('/api/v1/health').expect(200);
    await request(server).get('/api/v1/health').expect(200);
    await request(server).get('/api/v1/health').expect(429);

    for (let i = 0; i < 5; i++) {
      await request(server).get('/api/v1/dashboard').expect(200);
    }
  });
});
