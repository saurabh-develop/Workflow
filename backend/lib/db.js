import { PrismaClient } from "./generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: 10000, // default: 2000ms — time to wait to acquire a transaction
      timeout: 30000, // default: 5000ms — max time a transaction can run
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
