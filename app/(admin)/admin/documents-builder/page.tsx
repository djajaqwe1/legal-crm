"use client";

import { useState, useEffect, useCallback, Suspense, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmShell } from "@/components/crm/shell";
import { History, Loader2, Clock, ChevronRight, Home, Wand2 } from "lucide-react";
import Link from "next/link";

type DocBuilderHistoryItem = {
  role: string;
  content: string;
  createdAt: string;
};

const DOCUMENT_TYPES = [
  { id: "lawsuit", label: "Исковое заявление" },
  { id: "contract", label: "Договор оказания услуг" },
  { id: "claim", label: "Претензия" },
  { id: "petition", label: "Ходатайство" },
  { id: "appeal", label: "Апелляционная жалоба" },
  { id: "response", label: "Возражение на исковое заявление" },
  { id: "poa", label: "Доверенность" },
  { id: "settlement", label: "Мировое соглашение" },
];

type QuickTemplate = { label: string; type: string; prompt: string };

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: "💰 Взыскание долга",
    type: "lawsuit",
    prompt: "Истец: [Название компании/ФИО]. Ответчик: [Название компании/ФИО]. Суть: взыскание задолженности по договору поставки на сумму [сумма] тенге. Долг не погашен с [дата]. Прошу взыскать основной долг, пени и расходы на юруслуги.",
  },
  {
    label: "🏠 Расторжение аренды",
    type: "claim",
    prompt: "Арендодатель: [ФИО/компания]. Арендатор: [ФИО/компания]. Объект аренды: [адрес]. Основание расторжения: систематическая неоплата аренды, задолженность за [N] месяцев. Прошу освободить помещение в течение 30 дней.",
  },
  {
    label: "📝 Договор услуг",
    type: "contract",
    prompt: "Исполнитель: ТОО «Конгломерат Алтай» (юридические услуги). Заказчик: [ФИО/компания]. Предмет: юридическое представительство по делу [описание]. Стоимость: [сумма] тенге. Срок: [дата начала] — [дата окончания].",
  },
  {
    label: "🏢 Корпоративный спор",
    type: "lawsuit",
    prompt: "Истец: [акционер/участник ТОО]. Ответчик: [компания]. Суть: нарушение прав участника — невыплата дивидендов / незаконное решение общего собрания / нарушение преимущественного права. Просим признать решение недействительным и взыскать убытки.",
  },
  {
    label: "📋 Доверенность",
    type: "poa",
    prompt: "Доверитель: [ФИО, ИИН, адрес]. Представитель: [ФИО адвоката/юриста]. Полномочия: представлять интересы во всех судебных инстанциях РК, подписывать процессуальные документы, получать документы. Срок действия: 1 год.",
  },
];

function DocumentsBuilderContent() {
  const searchParams = useSearchParams();
  const [type, setType] = useState("lawsuit");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<DocBuilderHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/generate-document", { credentials: "include" });
      const data = (await res.json()) as { messages?: DocBuilderHistoryItem[] };
      if (data.messages) {
        setHistory(data.messages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  async function handleDownloadPdf() {
    if (!result) return;
    setIsDownloading(true);
    try {
      const response = await fetch("/api/documents/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: result,
          title: DOCUMENT_TYPES.find((t) => t.id === type)?.label,
        }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${DOCUMENT_TYPES.find((t) => t.id === type)?.label}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Ошибка при скачивании PDF");
    } finally {
      setIsDownloading(false);
    }
  }

  const handleGenerate = useCallback(async (customPrompt?: string, customType?: string) => {
    const targetPrompt = customPrompt || prompt;
    const targetType = customType || type;
    
    if (!targetPrompt) return;
    setIsLoading(true);
    setErrorMsg(null);
    setInfoNotice(null);
    try {
      const response = await fetch("/api/ai/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: DOCUMENT_TYPES.find((t) => t.id === targetType)?.label || targetType,
          prompt: targetPrompt,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        text?: string;
        warning?: string;
      };
      if (!response.ok) throw new Error(data.error || "Generation failed");
      setResult(typeof data.text === "string" ? data.text : "");
      setInfoNotice(typeof data.warning === "string" ? data.warning : null);
      void loadHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка генерации";
      setErrorMsg(message);
      setResult("");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, type, loadHistory]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadHistory();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadHistory]);

  useEffect(() => {
    const urlType = searchParams.get("type");
    const urlPrompt = searchParams.get("prompt");
    const autoGen = searchParams.get("auto");

    startTransition(() => {
      if (urlType) setType(urlType);
      if (urlPrompt) {
        setPrompt(decodeURIComponent(urlPrompt));
      }
    });

    let tid: number | undefined;
    if (urlPrompt) {
      const decodedPrompt = decodeURIComponent(urlPrompt);
      if (autoGen === "true" && !isLoading && result === "") {
        tid = window.setTimeout(() => {
          void handleGenerate(decodedPrompt, urlType || type);
          const newUrl =
            window.location.pathname +
            "?" +
            searchParams.toString().replace("auto=true", "auto=false");
          window.history.replaceState({}, "", newUrl);
        }, 0);
      }
    }
    return () => {
      if (tid !== undefined) window.clearTimeout(tid);
    };
  }, [searchParams, handleGenerate, isLoading, result, type]);

  return (
    <CrmShell>
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <Wand2 className="h-3 w-3" />
            Конструктор
          </span>
        </nav>

        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Конструктор документов</h2>
          <p className="text-sm text-zinc-500">Автоматическая генерация исков, договоров и претензий по праву РК</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader>
                <CardTitle>Параметры документа</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
              {infoNotice && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                  {infoNotice}
                </div>
              )}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                  {errorMsg}
                </div>
              )}
              <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Быстрые шаблоны</label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => {
                          setType(tpl.type);
                          setPrompt(tpl.prompt);
                        }}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип документа</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Описание ситуации / Данные</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Например: Истец ТОО 'Альфа', Ответчик ИП 'Иванов', суть спора: взыскание задолженности по договору поставки №1 от 01.01.2024 на сумму 500 000 тенге..."
                    className="min-h-[200px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>

                <Button
                  onClick={() => handleGenerate()}
                  className="w-full"
                  disabled={isLoading || !prompt}
                >
                  {isLoading ? "Генерация..." : "Сгенерировать документ"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Результат</CardTitle>
                {result && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadPdf}
                      disabled={isDownloading}
                    >
                      {isDownloading ? "..." : "Скачать PDF"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(result).then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2000);
                        }).catch(() => null);
                      }}
                    >
                      {copied ? "✓ Скопировано" : "Копировать"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="prose prose-sm dark:prose-invert max-h-[600px] overflow-auto whitespace-pre-wrap rounded-md border border-zinc-100 bg-zinc-50 p-4 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
                    {result}
                  </div>
                ) : (
                  <div className="flex h-[400px] items-center justify-center text-sm text-zinc-500">
                    Здесь появится сгенерированный текст
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* История чатов */}
        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              История
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[800px] overflow-auto px-4 pb-4">
              {isHistoryLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-center py-8 text-xs text-zinc-500 italic">История пуста</p>
              ) : (
                <div className="space-y-4">
                  {history.map((msg, i) => msg.role === "user" && (
                    <div key={i} className="group cursor-pointer rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                         onClick={() => {
                           const nextMsg = history[i-1]; // Ответ обычно идет перед (т.к. сортировка desc)
                           if (nextMsg && nextMsg.role === "assistant") {
                             setResult(nextMsg.content);
                             // Извлекаем тип и промпт из текста запроса пользователя
                             const match = msg.content.match(/Тип: (.*)\. Запрос: (.*)/);
                             if (match) {
                               const foundType = DOCUMENT_TYPES.find(t => t.label === match[1]);
                               if (foundType) setType(foundType.id);
                               setPrompt(match[2]);
                             }
                           }
                         }}>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                        <Clock className="h-3 w-3" />
                        {new Date(msg.createdAt).toLocaleString("ru-RU")}
                      </div>
                      <p className="text-xs line-clamp-2 font-medium">{msg.content.split(". Запрос: ")[1] || msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </CrmShell>
  );
}

export default function DocumentsBuilderPage() {
  return (
    <Suspense
      fallback={
        <CrmShell>
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
            Загрузка конструктора…
          </div>
        </CrmShell>
      }
    >
      <DocumentsBuilderContent />
    </Suspense>
  );
}
