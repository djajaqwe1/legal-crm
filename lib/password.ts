import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

/** Scrypt (N=16384, r=8, p=1), хранение: `saltHex:keyHex`. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [saltHex, keyHex] = parts;
  if (!saltHex || !keyHex || saltHex.length % 2 !== 0 || keyHex.length % 2 !== 0) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEYLEN) return false;
  const actual = scryptSync(plain, salt, KEYLEN, { N: 16384, r: 8, p: 1 });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
