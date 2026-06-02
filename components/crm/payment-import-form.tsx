"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";

export function PaymentImportForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/payments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text, source: file.name.includes("1c") ? "1c" : "rekassa" }),
      });
      const data = await res.json() as {
        imported?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Ошибка импорта");
      const errPart = data.errors?.length ? ` Предупреждения: ${data.errors.slice(0, 3).join("; ")}` : "";
      setResult(`Импортировано: ${data.imported ?? 0}, пропущено: ${data.skipped ?? 0}.${errPart}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border-2 border-dashed border-zinc-200 p-6 text-center dark:border-zinc-700 cursor-pointer hover:border-violet-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <FileSpreadsheet className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
        <p className="text-sm font-medium">CSV из Rekassa или 1С</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          Колонки: сумма; дата; источник; код дела; описание
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button disabled={loading} onClick={() => fileRef.current?.click()} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {loading ? "Импорт…" : "Загрузить CSV"}
      </Button>
      {result && <p className="text-sm text-green-700 dark:text-green-400">{result}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
