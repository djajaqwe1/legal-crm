import { prisma } from "@/lib/prisma";

const CACHE_MS = 45_000;

let lastProbeAt = 0;
let lastOk = false;
let probeInFlight: Promise<boolean> | null = null;

/** Сброс кэша после ошибки запроса (положительный кэш мог устареть). */
export function invalidateDatabaseReachability() {
  lastProbeAt = 0;
}

/**
 * Лёгкая проверка доступности PostgreSQL. Результат кэшируется на CACHE_MS,
 * параллельные вызовы в рамках одного прогона объединяются в один SELECT 1.
 */
export async function isDatabaseReachable(): Promise<boolean> {
  const now = Date.now();
  if (now - lastProbeAt < CACHE_MS && lastProbeAt > 0) {
    return lastOk;
  }

  if (probeInFlight) {
    return probeInFlight;
  }

  probeInFlight = (async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      lastOk = true;
      lastProbeAt = Date.now();
      return true;
    } catch {
      lastOk = false;
      lastProbeAt = Date.now();
      return false;
    } finally {
      probeInFlight = null;
    }
  })();

  return probeInFlight;
}
