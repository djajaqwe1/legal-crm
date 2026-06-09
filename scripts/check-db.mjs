import { config } from "dotenv";
import { PrismaClient } from "../lib/generated-client/index.js";

config();
const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1`;
  console.log("DB OK");
} catch (e) {
  console.log("DB FAIL:", e instanceof Error ? e.message.slice(0, 120) : e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
