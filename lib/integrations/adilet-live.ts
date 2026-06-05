/**
 * Живой поиск на adilet.zan.kz (HTML) — дополнение к локальной базе.
 */

import type { AdiletDocument } from "./adilet";

const BASE = "https://adilet.zan.kz";

export async function searchAdiletLive(query: string, limit = 5): Promise<AdiletDocument[]> {
  const q = query.trim();
  if (!q || q.length < 3) return [];

  try {
    const url = `${BASE}/rus/search/docs?text=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LegalCRM-Jarvis/1.0 (+https://conglomerate-ai)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const html = await res.text();
    const results: AdiletDocument[] = [];
    const seen = new Set<string>();

    const linkRe = /href="(\/rus\/docs\/[^"#?]+)"[^>]*>([^<]{8,200})</gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) && results.length < limit) {
      const path = m[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const title = m[2]
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/\s+/g, " ")
        .trim();

      if (/^(далее|след|стр|page|home)/i.test(title)) continue;

      results.push({
        id: path.replace(/\//g, "_"),
        title,
        url: `${BASE}${path}`,
        date: "",
        type: "НПА (Әділет)",
        snippet: "Результат поиска на adilet.zan.kz — проверьте актуальную редакцию по ссылке.",
      });
    }

    return results;
  } catch {
    return [];
  }
}
