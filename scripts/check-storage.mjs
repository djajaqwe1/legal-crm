/**
 * Проверка Supabase Storage (локально: node scripts/check-storage.mjs)
 * Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env
 */
import "dotenv/config";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "legal-documents";

if (!url || !key) {
  console.error("❌ Нет SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env");
  process.exit(1);
}

console.log("✓ SUPABASE_URL:", url);
console.log("✓ Bucket:", bucket);

const listRes = await fetch(`${url}/storage/v1/bucket/${bucket}`, {
  headers: { Authorization: `Bearer ${key}`, apikey: key },
});

if (!listRes.ok) {
  const err = await listRes.text();
  console.error(`❌ Bucket "${bucket}": ${listRes.status}`, err.slice(0, 200));
  process.exit(1);
}

const meta = await listRes.json();
console.log("✓ Bucket найден, public:", meta.public ?? meta.public ?? "?");

const testKey = `_healthcheck/${Date.now()}.txt`;
const uploadRes = await fetch(`${url}/storage/v1/object/${bucket}/${testKey}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "text/plain",
    "x-upsert": "true",
  },
  body: "crm storage ok",
});

if (!uploadRes.ok) {
  const err = await uploadRes.text();
  console.error(`❌ Тестовая загрузка: ${uploadRes.status}`, err.slice(0, 200));
  process.exit(1);
}

console.log("✓ Тестовая загрузка прошла:", testKey);
console.log("\nStorage настроен корректно.");
