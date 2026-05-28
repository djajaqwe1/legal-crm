"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmShell } from "@/components/crm/shell";
import { Input } from "@/components/ui/input";
import { AdiletDocument } from "@/lib/integrations/adilet";
import { TeamReport } from "@/lib/agents/workflow";
import ReactMarkdown from "react-markdown";

import { ChevronRight, Home, Compass } from "lucide-react";
import Link from "next/link";

export default function StrategistPage() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<string>("");
  const [teamReport, setTeamReport] = useState<TeamReport | null>(null);
  const [mode, setMode] = useState<"single" | "team">("single");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Интеграция с Adilet
  const [lawSearch, setLawSearch] = useState("");
  const [foundLaws, setFoundLaws] = useState<AdiletDocument[]>([]);
  const [isSearchingLaws, setIsSearchingLaws] = useState(false);
  const [selectedLaws, setSelectedLaws] = useState<AdiletDocument[]>([]);

  async function handleLawSearch() {
    if (!lawSearch) return;
    setIsSearchingLaws(true);
    try {
      const response = await fetch(`/api/integrations/adilet?q=${encodeURIComponent(lawSearch)}`);
      const data = await response.json();
      setFoundLaws(data.results || []);
    } catch (err) {
      console.error("Law search failed", err);
    } finally {
      setIsSearchingLaws(false);
    }
  }

  function toggleLawSelection(doc: AdiletDocument) {
    if (selectedLaws.find(l => l.id === doc.id)) {
      setSelectedLaws(selectedLaws.filter(l => l.id !== doc.id));
    } else {
      setSelectedLaws([...selectedLaws, doc]);
    }
  }

  async function handleAnalyze() {
    if (!content) return;
    setIsLoading(true);
    setErrorMsg(null);
    setResult("");
    setTeamReport(null);
    try {
      // Добавляем тексты выбранных законов в контекст анализа
      const lawsContext = selectedLaws.map(l => `ИСТОЧНИК Adilet: ${l.title}\n${l.snippet}`).join("\n\n");
      
      if (mode === "team") {
        const response = await fetch("/api/ai/team-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, context: lawsContext }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Team analysis failed");
        setTeamReport(data);
      } else {
        const fullContent = `${content}\n\nПРИМЕНИМОЕ ЗАКОНОДАТЕЛЬСТВО (Adilet):\n${lawsContext}`;

        const response = await fetch("/api/ai/analyze-strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: fullContent }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Analysis failed");
        setResult(data.text);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка анализа";
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  }

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
            <Compass className="h-3 w-3" />
            Агент-Стратег
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Агент-Стратег</h2>
            <p className="text-sm text-zinc-500">Проработка судебной стратегии и анализ рисков</p>
          </div>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button 
              onClick={() => setMode("single")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mode === "single" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"}`}
            >
              Одиночный анализ
            </button>
            <button 
              onClick={() => setMode("team")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${mode === "team" ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-zinc-500"}`}
            >
              Командный разбор
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle>1. Контекст из базы Әділет (adilet.zan.kz)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Поиск законов для анализа..." 
                  value={lawSearch}
                  onChange={(e) => setLawSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLawSearch()}
                />
                <Button variant="outline" onClick={handleLawSearch} disabled={isSearchingLaws}>
                  {isSearchingLaws ? "..." : "Найти"}
                </Button>
              </div>
              
              {foundLaws.length > 0 && (
                <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-2">
                  {foundLaws.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs">
                      <input 
                        type="checkbox" 
                        checked={!!selectedLaws.find(l => l.id === doc.id)}
                        onChange={() => toggleLawSelection(doc)}
                      />
                      <span className="truncate flex-1">{doc.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedLaws.length > 0 && (
                <p className="text-[10px] text-green-600 font-medium">
                  Выбрано НПА для анализа: {selectedLaws.length}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle>2. Ввод данных для анализа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative text-sm">
                  {errorMsg}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Текст дела или описание ситуации</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Опишите ситуацию подробно или вставьте текст документа (иска, договора, претензии) для анализа шансов по ГПК РК..."
                  className="min-h-[300px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <Button
                onClick={handleAnalyze}
                className={`w-full ${mode === "team" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                disabled={isLoading || !content}
              >
                {isLoading 
                  ? (mode === "team" ? "Команда совещается..." : "Анализируем...") 
                  : (mode === "team" ? "Запустить командный разбор" : "Провести одиночный анализ")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>{mode === "team" ? "Результаты командного совещания" : "Юридическое заключение AI"}</CardTitle>
          </CardHeader>
          <CardContent>
            {teamReport ? (
              <div className="space-y-6 max-h-[700px] overflow-auto pr-2">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                  <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2">Вердикт Главного юриста (CEO):</h4>
                  <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{teamReport.finalVerdict}</ReactMarkdown>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 px-1">Отчеты специалистов:</h4>
                  {teamReport.responses.map((resp, i) => (
                    <div key={i} className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                          {resp.agentName}
                        </span>
                      </div>
                      <div className="text-xs prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{resp.content}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : result ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-center text-sm text-zinc-500">
                {mode === "team" 
                  ? "Нажмите 'Запустить командный разбор', чтобы собрать совещание ИИ-агентов."
                  : "Введите данные слева и нажмите кнопку анализа, чтобы получить прогноз шансов."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CrmShell>
  );
}
