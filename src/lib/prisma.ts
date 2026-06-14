import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. Next.js dev hot-reload and the standalone worker can
 * both import this; the global guard prevents exhausting Postgres connections.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
