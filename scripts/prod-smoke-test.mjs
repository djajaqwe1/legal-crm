/**
 * Smoke test production (requires ADMIN_PASSWORD env or pass as arg)
 * Usage: node scripts/prod-smoke-test.mjs [baseUrl] [password]
 */
const BASE = process.argv[2] ?? "https://project-072fj.vercel.app";
const PASSWORD = process.argv[3] ?? process.env.ADMIN_PASSWORD ?? "";

const tests = [];
function ok(name, pass, detail = "") {
  tests.push({ name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  if (!PASSWORD) {
    console.error("Set ADMIN_PASSWORD or pass as 2nd arg");
    process.exit(1);
  }

  const jar = {};
  const getCookie = (res) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      jar[k.trim()] = v;
    }
  };
  const cookieHeader = () =>
    Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

  // 1. Public pages
  const home = await fetch(BASE);
  ok("GET /", home.ok, String(home.status));

  const loginPage = await fetch(`${BASE}/login`);
  ok("GET /login", loginPage.ok, String(loginPage.status));

  // 2. API without auth → 401
  const healthNoAuth = await fetch(`${BASE}/api/health`);
  ok("GET /api/health без сессии → 401", healthNoAuth.status === 401, String(healthNoAuth.status));

  // 3. Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  getCookie(loginRes);
  const loginData = await loginRes.json();
  ok("POST /api/auth/login", loginRes.ok && loginData.ok, JSON.stringify(loginData));

  // 4. Health with auth
  const health = await fetch(`${BASE}/api/health`, { headers: { Cookie: cookieHeader() } });
  const healthData = await health.json();
  ok("GET /api/health db", health.ok && healthData.db === true, `db=${healthData.db}`);
  ok("GET /api/health storage", healthData.storage === true, `storage=${healthData.storage}`);

  // 5. Jarvis intake
  const intakeMsg =
    "Новое дело для Иванова — спор с управляющей компанией по ремонту крыши, дедлайн через 2 недели, нужна претензия по жилищному закону";
  const jarvisRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: intakeMsg }] }),
  });
  const jarvisData = await jarvisRes.json();
  ok("Jarvis intake HTTP", jarvisRes.ok, String(jarvisRes.status));
  ok("Jarvis needsConfirmation", jarvisData.needsConfirmation === true, String(jarvisData.needsConfirmation));
  ok("Jarvis pendingAction", jarvisData.pendingAction?.toolName === "intake_new_case", jarvisData.pendingAction?.toolName ?? "none");
  ok("Jarvis client parse", jarvisData.pendingAction?.args?.clientName === "Иванова", jarvisData.pendingAction?.args?.clientName ?? "?");
  ok("Jarvis title capitalized", /^[A-ZА-ЯЁ]/.test(jarvisData.pendingAction?.args?.title ?? ""), jarvisData.pendingAction?.args?.title ?? "?");
  ok("Jarvis reply has plan", /Разрешаю|план/i.test(jarvisData.reply ?? ""), (jarvisData.reply ?? "").slice(0, 60));

  // 6. Simple stats intent
  const statsRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "Покажи статистику CRM" }] }),
  });
  const statsData = await statsRes.json();
  ok("Jarvis stats", statsRes.ok && statsData.toolUsed === "get_stats", statsData.toolUsed ?? statsData.error);

  // 7. Adilet pure search (not operational)
  const lawRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "найди статью по жилищным отношениям" }] }),
  });
  const lawData = await lawRes.json();
  ok("Jarvis adilet-only", lawRes.ok && lawData.toolUsed === "search_adilet", lawData.toolUsed ?? "?");

  // 8. Voice: open case
  const openRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "открой реестр дел" }] }),
  });
  const openData = await openRes.json();
  ok("Jarvis navigate cases", openRes.ok && openData.toolUsed === "navigate_to", openData.toolUsed ?? "?");

// 9. Morning brief voice
  const briefRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "мой рабочий день" }] }),
  });
  const briefData = await briefRes.json();
  ok("Jarvis morning brief", briefRes.ok && briefData.toolUsed === "get_lawyer_daily", briefData.toolUsed ?? "?");

  // 10. Create client voice (confirmation only)
  const clientRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "создай клиента Тестов Голос" }] }),
  });
  const clientData = await clientRes.json();
  ok("Jarvis create client confirm", clientRes.ok && clientData.needsConfirmation === true && clientData.pendingAction?.toolName === "create_client", clientData.pendingAction?.toolName ?? "?");

  const adiletRes = await fetch(`${BASE}/api/ai/jarvis`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ messages: [{ role: "user", content: "найди в адилет жилищные отношения" }] }),
  });
  const adiletData = await adiletRes.json();
  ok("Jarvis voice adilet", adiletRes.ok && adiletData.toolUsed === "search_adilet", adiletData.toolUsed ?? "?");

  const failed = tests.filter((t) => !t.pass);
  console.log(`\n${tests.length - failed.length}/${tests.length} passed`);
  if (failed.length) {
    console.log("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
