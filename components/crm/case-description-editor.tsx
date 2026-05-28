"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  caseId: string;
  initialDescription: string | null;
}

export function CaseDescriptionEditor({ caseId, initialDescription }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      setEditing(false);
      router.refresh();
    } catch {
      setError("Не удалось сохранить. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setText(initialDescription ?? "");
    setEditing(false);
    setError(null);
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Опишите суть дела, ключевые факты, позицию стороны..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Сохранить
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
            <X className="mr-1 h-3.5 w-3.5" />
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="min-h-[3rem] rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {text || <span className="italic text-zinc-400">Описание отсутствует</span>}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <Pencil className="h-3 w-3" />
        Редактировать
      </button>
    </div>
  );
}
