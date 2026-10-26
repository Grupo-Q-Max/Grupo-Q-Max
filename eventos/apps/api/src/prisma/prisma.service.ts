import 'dotenv/config';

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient } from '../generated/prisma/client';

function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada.');
  }

  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const config = getDatabaseConfig();

    const poolLimit = process.env.DATABASE_CONNECTION_LIMIT
      ? Number(process.env.DATABASE_CONNECTION_LIMIT)
      : 25;

    const adapter = new PrismaMariaDb({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit:
        Number.isInteger(poolLimit) && poolLimit > 0 ? poolLimit : 25,
    });

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Prisma conectado ao banco.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
