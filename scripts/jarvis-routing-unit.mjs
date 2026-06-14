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

function matchNavigate(text) {
  const t = text.trim().toLowerCase();
  if (/^(?:открой|покажи|перейди\s+к?)\s*(?:реестр\s+)?дел(?:а|о)?$/.test(t)) return "cases";
  return null;
}

function matchIncompleteHint(text) {
  const raw = text.trim();
  if (/^(?:перенеси|поставь|измени|обнови)\s+дедлайн\s*$/i.test(raw)) return true;
  return false;
}

function parseDeadlinePhrase(phrase) {
  const MONTHS = { январ: 0, феврал: 1, март: 2, апрел: 3, май: 4, июн: 5, июл: 6, август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11 };
  const p = phrase.trim().toLowerCase();
  for (const [key, monthIdx] of Object.entries(MONTHS)) {
    const noYear = p.match(new RegExp(`(\\d{1,2})\\s+${key}[a-zа-яё]*(?:\\s|$|,|\\.)`, "i"));
    if (noYear) return true;
  }
  return false;
}
const cases = [
  { input: "что ты умеешь?", wantHelp: true, wantCase: false },
  { input: "что ты вообще умеешь делать и зачем ты озвучиваешь", wantHelp: true, wantCase: false },
  { input: "что по делу Петрова", wantHelp: false, wantCase: true },
  { input: "кратко по LC-2026-001", wantHelp: false, wantCase: true },
  { input: "что CRM показывает", wantHelp: false, wantCase: false },
  { input: "открой реестр дел", wantNav: "cases" },
  { input: "15 июня", wantDate: true },
  { input: "обнови дедлайн", wantIncomplete: true },
  { input: "измени эту задачу", wantUpdateTask: true },
  { input: "отметь задачу позвонить выполненной", wantCompleteTask: true, taskQuery: "позвонить" },
];

function matchUpdateTask(text) {
  return (
    /(?:измени|обнови|перенеси|исправь|дополни|скорректируй)\s+(?:эту\s+)?задач/i.test(text) ||
    /эту\s+задач/i.test(text)
  );
}

function matchCompleteTask(text) {
  if (!/(?:отметь|закрой|выполни|заверш)\s+(?:эту\s+)?задач/i.test(text)) return null;
  const simple = text.match(
    /(?:отметь|закрой|выполни|заверш)\s+задач(?:у|и)\s+[«"]?(.+)[»"]?\s*$/i,
  );
  if (!simple) return null;
  const taskQuery = simple[1]
    .trim()
    .replace(/\s+(?:как\s+)?(?:выполненн(?:ой|ая|ую|a)?|выполнено|закрыт(?:ой|ая|ую)?|done)\s*\.?$/i, "")
    .trim();
  return { taskQuery };
}

let pass = 0;
for (const c of cases) {
  const help = matchHelp(c.input);
  const brief = matchCaseBrief(c.input);
  const nav = matchNavigate(c.input);
  const date = c.wantDate ? parseDeadlinePhrase(c.input) : null;
  const incomplete = c.wantIncomplete ? matchIncompleteHint(c.input) : null;
  const updateTask = c.wantUpdateTask ? matchUpdateTask(c.input) : null;
  const completeTask = c.wantCompleteTask ? matchCompleteTask(c.input) : null;
  const okHelp = c.wantHelp === undefined || help === c.wantHelp;
  const okCase = c.wantCase === undefined || !!brief === c.wantCase;
  const okNav = c.wantNav === undefined || nav === c.wantNav;
  const okDate = c.wantDate === undefined || date === c.wantDate;
  const okIncomplete = c.wantIncomplete === undefined || incomplete === c.wantIncomplete;
  const okUpdateTask = c.wantUpdateTask === undefined || updateTask === c.wantUpdateTask;
  const okCompleteTask =
    c.wantCompleteTask === undefined ||
    (completeTask?.taskQuery === c.taskQuery && !completeTask?.taskQuery?.includes("выполненн"));
  const ok = okHelp && okCase && okNav && okDate && okIncomplete && okUpdateTask && okCompleteTask;
  if (ok) pass++;
  console.log(`${ok ? "✓" : "✗"} "${c.input.slice(0, 50)}" help=${help} brief=${!!brief} nav=${nav ?? "-"} date=${date ?? "-"}`);
}

console.log(`\n${pass}/${cases.length} routing checks`);
process.exit(pass === cases.length ? 0 : 1);
