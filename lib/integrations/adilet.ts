/**
 * Сервис интеграции с ИС «Әділет» (adilet.zan.kz)
 * MVP: локальная база ключевых актов РК + релевантный поиск по запросу.
 * При подключении официального API — заменить searchAdilet на HTTP-вызов.
 */

export interface AdiletDocument {
  id: string;
  title: string;
  url: string;
  date: string;
  type: string;
  snippet?: string;
  articleRef?: string;
  keywords?: string[];
}

const ADILET_KNOWLEDGE_BASE: AdiletDocument[] = [
  {
    id: "gpk",
    title: "Гражданский процессуальный кодекс Республики Казахстан",
    url: "https://adilet.zan.kz/rus/docs/K1500000377",
    date: "31.10.2015",
    type: "Кодекс",
    snippet:
      "Настоящий Кодекс регулирует порядок рассмотрения и разрешения гражданских дел судами. Иски предъявляются в суд по месту жительства ответчика, если иное не установлено законом.",
    articleRef: "ст. 30, 148, 403",
    keywords: ["гпк", "иск", "суд", "подсудность", "ходатайство", "апелляция", "кассация", "доказательства"],
  },
  {
    id: "gk",
    title: "Гражданский кодекс Республики Казахстан (Общая часть)",
    url: "https://adilet.zan.kz/rus/docs/K940001000_",
    date: "27.12.1994",
    type: "Кодекс",
    snippet:
      "Гражданским законодательством регулируются имущественные и связанные с ними личные неимущественные отношения. Договор считается заключённым при достижении согласия по существенным условиям.",
    articleRef: "ст. 272, 378, 401",
    keywords: ["гк", "договор", "обязательство", "ответственность", "неустойка", "ущерб", "сделка"],
  },
  {
    id: "housing",
    title: "Закон Республики Казахстан «О жилищных отношениях»",
    url: "https://adilet.zan.kz/rus/docs/Z970000094_",
    date: "16.04.1997",
    type: "Закон",
    snippet:
      "Регулирует отношения по поводу оснований возникновения, изменения и прекращения права пользования жилым помещением, содержания и ремонта жилья.",
    articleRef: "ст. 10, 45, 67",
    keywords: ["жильё", "жилищ", "квартира", "найм", "сосед", "управляющая компания"],
  },
  {
    id: "labor",
    title: "Трудовой кодекс Республики Казахстан",
    url: "https://adilet.zan.kz/rus/docs/K1700000117",
    date: "23.11.2015",
    type: "Кодекс",
    snippet:
      "Регулирует трудовые отношения. Расторжение трудового договора по инициативе работодателя допускается при наличии оснований, предусмотренных Кодексом.",
    articleRef: "ст. 52, 54, 143",
    keywords: ["труд", "увольнение", "работник", "работодатель", "зарплата", "отпуск"],
  },
  {
    id: "admin",
    title: "Кодекс Республики Казахстан об административных правонарушениях",
    url: "https://adilet.zan.kz/rus/docs/K1400000375",
    date: "05.07.2014",
    type: "Кодекс",
    snippet:
      "Определяет виды административных правонарушений, меры административного взыскания и порядок производства по делам об административных правонарушениях.",
    articleRef: "ст. 541, 804",
    keywords: ["коап", "штраф", "административ", "протокол", "полиция"],
  },
  {
    id: "entrepreneur",
    title: "Предпринимательский кодекс Республики Казахстан",
    url: "https://adilet.zan.kz/rus/docs/K1500000375",
    date: "29.10.2015",
    type: "Кодекс",
    snippet:
      "Регулирует предпринимательскую деятельность, государственную поддержку субъектов предпринимательства, защиту прав предпринимателей.",
    articleRef: "ст. 6, 11",
    keywords: ["ип", "тоо", "бизнес", "предприниматель", "госзакуп"],
  },
  {
    id: "pretension",
    title: "ГК РК — досудебный порядок урегулирования спора",
    url: "https://adilet.zan.kz/rus/docs/K940001000_",
    date: "27.12.1994",
    type: "Норма",
    snippet:
      "Сторона обязана принять меры по урегулированию спора до обращения в суд, если это предусмотрено законом или договором. Претензионный порядок — обязательное условие для ряда категорий споров.",
    articleRef: "ст. 8, 401",
    keywords: ["претензия", "досудеб", "требование", "ответ на претензию"],
  },
  {
    id: "appeal",
    title: "ГПК РК — апелляционное и кассационное обжалование",
    url: "https://adilet.zan.kz/rus/docs/K1500000377",
    date: "31.10.2015",
    type: "Норма",
    snippet:
      "Решение суда первой инстанции может быть обжаловано в апелляционном порядке. Срок подачи апелляционной жалобы — один месяц со дня вынесения решения в окончательной форме.",
    articleRef: "ст. 403, 435",
    keywords: ["апелляция", "кассация", "жалоба", "обжалование", "решение суда"],
  },
];

function scoreDocument(doc: AdiletDocument, tokens: string[]): number {
  const haystack = [
    doc.title,
    doc.snippet ?? "",
    doc.type,
    doc.articleRef ?? "",
    ...(doc.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (haystack.includes(token)) score += 2;
    if (doc.keywords?.some(k => k.includes(token) || token.includes(k))) score += 3;
  }
  return score;
}

export async function searchAdilet(query: string): Promise<AdiletDocument[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = ADILET_KNOWLEDGE_BASE.map(doc => ({
    doc,
    score: scoreDocument(doc, tokens),
  }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  let local = scored.map(x => x.doc);

  if (!local.length && /закон|стать|кодекс|норм|прав|суд|иск|договор|претенз/.test(q)) {
    local = ADILET_KNOWLEDGE_BASE.slice(0, 3);
  }

  const topScore = scored[0]?.score ?? 0;
  if (local.length >= 3 && topScore >= 4) {
    return local;
  }

  const { searchAdiletLive } = await import("./adilet-live");
  const live = await searchAdiletLive(query, 5);
  if (!live.length) return local;

  const localUrls = new Set(local.map(d => d.url));
  const merged = [...local];
  for (const doc of live) {
    if (!localUrls.has(doc.url)) merged.push(doc);
  }
  return merged.slice(0, 8);
}

export async function fetchAdiletDocumentText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LegalCRM-Jarvis/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4000) || null;
  } catch {
    return null;
  }
}
