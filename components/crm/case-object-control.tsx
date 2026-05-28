"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type LegalObjectRow = { id: string; name: string };

type CaseObjectControlProps = {
  caseId: string;
  clientId: string;
  currentObjectId: string | null;
};

export function CaseObjectControl({
  caseId,
  clientId,
  currentObjectId,
}: CaseObjectControlProps) {
  const router = useRouter();
  const [objects, setObjects] = useState<LegalObjectRow[]>([]);
  const [value, setValue] = useState(currentObjectId ?? "");
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setValue(currentObjectId ?? "");
    }, 0);
    return () => window.clearTimeout(t);
  }, [currentObjectId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingList(true);
      try {
        const res = await fetch(`/api/objects?clientId=${encodeURIComponent(clientId)}`);
        const data = (await res.json()) as LegalObjectRow[] | { error?: string };
        if (!cancelled && Array.isArray(data)) {
          setObjects(data);
        }
      } catch {
        if (!cancelled) setObjects([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function save(nextId: string) {
    setSaving(true);
    setError(null);
    try {
      const objectId = nextId === "" ? null : nextId;
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Не удалось сохранить");
      }
      setValue(nextId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setValue(currentObjectId ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          void save(next);
        }}
        disabled={loadingList || saving}
        className="max-w-[240px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      >
        <option value="">Без объекта</option>
        {objects.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {(loadingList || saving) && (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
