"use client";

import { useState } from "react";
import { CrmShell } from "@/components/crm/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdiletDocument } from "@/lib/integrations/adilet";
import { Input } from "@/components/ui/input";
import { ChevronRight, Home, BookOpen } from "lucide-react";
import Link from "next/link";

export default function AdiletIntegrationPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdiletDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch() {
    if (!query) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/integrations/adilet?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Adilet search failed", error);
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
            <BookOpen className="h-3 w-3" />
            База Әділет
          </span>
        </nav>

        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">ИС «Әділет»: База НПА</h2>
          <p className="text-sm text-zinc-500">Поиск актуальных текстов кодексов и законов Республики Казахстан</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Поиск по законодательству</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Напр: Гражданский кодекс, Жилищные отношения..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? "Поиск..." : "Найти"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {results.map((doc) => (
            <Card key={doc.id} className="hover:border-zinc-400 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-md text-blue-600 dark:text-blue-400">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.title}</a>
                    </CardTitle>
                    <p className="text-xs text-zinc-500 mt-1">{doc.type} от {doc.date}</p>
                  </div>
                  <Button variant="ghost" size="sm">Использовать в Агенте</Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 italic">
                  &ldquo;{doc.snippet}&rdquo;
                </p>
              </CardContent>
            </Card>
          ))}
          {results.length === 0 && !isLoading && query && (
            <div className="text-center py-12 text-zinc-500">
              Ничего не найдено. Попробуйте другой запрос.
            </div>
          )}
        </div>
      </div>
    </CrmShell>
  );
}
