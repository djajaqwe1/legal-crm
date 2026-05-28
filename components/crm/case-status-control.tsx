"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { caseStatusOptions } from "@/lib/case-status";
import { Loader2 } from "lucide-react";

type CaseStatusControlProps = {
  caseId: string;
  currentStatus: string;
};

export function CaseStatusControl({
  caseId,
  currentStatus,
}: CaseStatusControlProps) {
  const [status, setStatus] = useState(currentStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onChange(nextStatus: string) {
    setStatus(nextStatus);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        throw new Error("Не удалось изменить статус");
      }

      router.refresh();
    } catch {
      setStatus(currentStatus);
      setError("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(event) => onChange(event.target.value)}
        disabled={isSaving}
        className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-400"
      >
        {caseStatusOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {isSaving && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}
