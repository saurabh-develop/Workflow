import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const db =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = db;
}
