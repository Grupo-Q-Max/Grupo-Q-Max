import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient;
  pool: any; 
};

const connectionString = process.env.DATABASE_URL!;

// Cache the pool so it doesn't get recreated on every HMR in development
if (!globalForPrisma.pool) {
  globalForPrisma.pool = mariadb.createPool(connectionString.replace('mysql://', 'mariadb://'));
}

const pool = globalForPrisma.pool;
const adapter = new PrismaMariaDb(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
