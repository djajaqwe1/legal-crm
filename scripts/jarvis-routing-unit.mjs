/**
 * Локальный unit-тест маршрутизации голосовых команд (без сервера).
 * node scripts/jarvis-routing-unit.mjs
 */

function isLikelyCaseQuery(q) {
  const t = q.trim();
  if (!t || t.length > 80) return false;
  if (/^LC-\d{4}-\d+/i.test(t)) return true;
  if (/^(ты|вы|умеешь|можешь|зачем|почему|как\s+работ|ozvuch|озвуч)/i.test(t)) return false;
  if (/\?/.test(t) && t.split(/\s+/).length > 5) return false;
  if (/озвучива|умеешь|можешь|команды|help|помощь/i.test(t)) return false;
  return true;
}

function matchCaseBrief(text) {
  const byCode = text.match(/(?:что|расскажи|кратко|сводка|статус)\s+(?:по\s+)?(LC-\d{4}-\d+)/i);
  if (byCode) return { caseQuery: byCode[1].trim() };
  const m = text.match(/(?:что|расскажи|кратко|сводка|статус)\s+по\s+делу\s+(.+)/i);
  if (!m) return null;
  const q = m[1].trim().replace(/\.$/, "");
  if (!isLikelyCaseQuery(q)) return null;
  return { caseQuery: q };
}

function matchHelp(text) {
  const t = text.toLowerCase().trim();
  return (
    /что\s+(?:ты|вы)(?:\s+[^\s?.!,]+){0,8}\s*(умеешь|можешь|делаешь)/.test(t) ||
    /чем\s+(?:ты|вы)\s+можешь|список\s+команд/.test(t) ||
    /зачем\s+(?:ты|вы)\s+озвучива/.test(t)
  );
}

const cases = [
  { input: "что ты умеешь?", wantHelp: true, wantCase: false },
  { input: "что ты вообще умеешь делать и зачем ты озвучиваешь", wantHelp: true, wantCase: false },
  { input: "что по делу Петрова", wantHelp: false, wantCase: true },
  { input: "кратко по LC-2026-001", wantHelp: false, wantCase: true },
  { input: "что CRM показывает", wantHelp: false, wantCase: false },
];

let pass = 0;
for (const c of cases) {
  const help = matchHelp(c.input);
  const brief = matchCaseBrief(c.input);
  const okHelp = help === c.wantHelp;
  const okCase = !!brief === c.wantCase;
  const ok = okHelp && okCase;
  if (ok) pass++;
  console.log(`${ok ? "✓" : "✗"} "${c.input.slice(0, 50)}" help=${help} brief=${!!brief}`);
}

console.log(`\n${pass}/${cases.length} routing checks`);
process.exit(pass === cases.length ? 0 : 1);
