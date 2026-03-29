const { PrismaClient } = require("@prisma/client");
const { env } = require("../utils/env");

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

module.exports = {
  prisma,
};
