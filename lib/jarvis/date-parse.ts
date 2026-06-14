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
    const withYear = p.match(new RegExp(`(\\d{1,2})\\s+${key}[a-zа-яё]*\\s+(\\d{4})`, "i"));
    if (withYear) {
      const d = new Date(Number(withYear[2]), monthIdx, Number(withYear[1]));
      if (!isNaN(d.getTime())) return toIso(d);
    }

    const noYear = p.match(new RegExp(`(\\d{1,2})\\s+${key}[a-zа-яё]*(?:\\s|$|,|\\.)`, "i"));
    if (noYear) {
      const day = Number(noYear[1]);
      const now = new Date();
      const year = now.getFullYear();
      let d = new Date(year, monthIdx, day);
      const todayStart = new Date(year, now.getMonth(), now.getDate());
      if (d.getTime() < todayStart.getTime()) {
        d = new Date(year + 1, monthIdx, day);
      }
      if (!isNaN(d.getTime())) return toIso(d);
    }
  }

  return null;
}

export type ParsedTaskDateTime = {
  dueDate: string;
  /** ISO datetime для dueDate в БД (если указано время) */
  dueDateTime?: string;
  /** Подпись времени для названия задачи, напр. «15:00 МСК» */
  timeLabel?: string;
};

/** Дата и время из фразы юриста: «до 17 июня в 15:00 по московскому». */
export function parseTaskDateTime(text: string): ParsedTaskDateTime | null {
  const dateCandidates: string[] = [];
  const until = text.match(/(?:до|к)\s+(\d{1,2}\s+[а-яё]+(?:\s+\d{4})?|\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/i);
  if (until?.[1]) dateCandidates.push(until[1]);
  const dotted = text.match(/(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)/);
  if (dotted?.[1]) dateCandidates.push(dotted[1]);
  const monthWord = text.match(/(\d{1,2}\s+[а-яё]+(?:\s+\d{4})?)/i);
  if (monthWord?.[1]) dateCandidates.push(monthWord[1]);

  let dueDate: string | null = null;
  for (const phrase of dateCandidates) {
    dueDate = parseDeadlinePhrase(phrase);
    if (dueDate) break;
  }
  if (!dueDate) return null;

  const timeMatch = text.match(/(?:в\s+)?(\d{1,2})[:.](\d{2})/);
  if (!timeMatch) return { dueDate };

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours > 23 || minutes > 59) return { dueDate };

  const moscow = /москов/i.test(text);
  const timeLabel = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}${moscow ? " МСК" : ""}`;
  const [year, month, day] = dueDate.split("-").map(Number);
  const utcHours = moscow ? hours - 3 : hours;
  const dt = new Date(Date.UTC(year, month - 1, day, utcHours, minutes));
  if (isNaN(dt.getTime())) return { dueDate, timeLabel };

  return { dueDate, dueDateTime: dt.toISOString(), timeLabel };
}
