import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// The adapter builds its own pool from the URL (mysql:// accepted; pool size via
// `?connectionLimit=N`, driver default 10). Caching the client keeps one pool across HMR.
const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    // Query logs carry parameters (e-mails, tokens): development only.
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
