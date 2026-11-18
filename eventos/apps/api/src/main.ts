import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

(BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString(), 10);
  return Number.isSafeInteger(int) ? int : this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(),
  );

  // nginx e Next rodam na mesma VM: confia só nos saltos de loopback para que
  // req.ip seja o IP real do cliente (vindo do x-forwarded-for).
  app.set('trust proxy', 'loopback');
  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  const customOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Sem CORS_ORIGINS, só o site oficial (e localhost fora de produção).
  const allowedOrigins = [
    ...(customOrigins.length
      ? customOrigins
      : ['https://grupoqmax.com.br', 'https://www.grupoqmax.com.br']),
    ...(process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:3001']),
  ];

  app.use((req: any, _res: any, next: () => void) => {
    if (req.url && req.url.includes('?')) {
      const [path, query] = req.url.split('?');
      if (path.length > 1 && path.endsWith('/')) {
        req.url = `${path.slice(0, -1)}?${query}`;
      }
    } else if (req.url && req.url.length > 1 && req.url.endsWith('/')) {
      req.url = req.url.slice(0, -1);
    }
    next();
  });

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 3334;
  await app.listen(port);

  console.log('Finora Experience API running:');
  console.log(`http://localhost:${port}/api/v1`);
}

bootstrap();
