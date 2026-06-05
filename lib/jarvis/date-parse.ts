/** Разбор дедлайнов из голоса/текста юриста. */

const MONTHS: Record<string, number> = {
  январ: 0, феврал: 1, март: 2, апрел: 3, май: 4, июн: 5,
  июл: 6, август: 7, сентябр: 8, октябр: 9, ноябр: 10, декабр: 11,
};

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function parseDeadlinePhrase(phrase: string): string | null {
  const p = phrase.trim().toLowerCase();
  if (!p) return null;

  const weeks = p.match(/через\s+(\d+)\s+недел/i);
  if (weeks) return addDays(new Date(), Number(weeks[1]) * 7);

  const days = p.match(/через\s+(\d+)\s+дн/i);
  if (days) return addDays(new Date(), Number(days[1]));

  const dotted = p.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]) - 1;
    let year = Number(dotted[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return toIso(d);
  }

  for (const [key, monthIdx] of Object.entries(MONTHS)) {
    const m = p.match(new RegExp(`(\\d{1,2})\\s+${key}[a-z]*\\s+(\\d{4})`));
    if (m) {
      const d = new Date(Number(m[2]), monthIdx, Number(m[1]));
      if (!isNaN(d.getTime())) return toIso(d);
    }
  }

  return null;
}
