"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scale } from "lucide-react";
import {
  COURT_INSTANCE_OPTIONS,
  OUTCOME_OPTIONS,
  courtInstanceLabel,
  outcomeLabel,
} from "@/lib/case-outcome";
import type { CaseOutcome, CourtInstance } from "@/lib/generated-client";

type CaseCourtPanelProps = {
  caseId: string;
  outcome: CaseOutcome | null;
  courtInstance: CourtInstance | null;
  assignedLawyer: string | null;
};

export function CaseCourtPanel({
  caseId,
  outcome,
  courtInstance,
  assignedLawyer,
}: CaseCourtPanelProps) {
  const router = useRouter();
  const [outcomeVal, setOutcomeVal] = useState(outcome ?? "PENDING");
  const [instanceVal, setInstanceVal] = useState(courtInstance ?? "");
  const [lawyer, setLawyer] = useState(assignedLawyer ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>, field: string) {
    setSaving(field);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Ошибка сохранения");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-900 dark:text-violet-200">
        <Scale className="h-4 w-4" />
        Судебные параметры
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-zinc-500">Исход дела</label>
          <div className="flex items-center gap-2">
            <select
              value={outcomeVal}
              onChange={(e) => {
                const next = e.target.value as CaseOutcome;
                setOutcomeVal(next);
                void patch({ outcome: next }, "outcome");
              }}
              disabled={saving === "outcome"}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {saving === "outcome" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
          </div>
          <p className="text-[10px] text-zinc-400">Сейчас: {outcomeLabel(outcome)}</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium uppercase text-zinc-500">Инстанция</label>
          <div className="flex items-center gap-2">
            <select
              value={instanceVal}
              onChange={(e) => {
                const next = e.target.value;
                setInstanceVal(next);
                void patch(
                  { courtInstance: next === "" ? null : next },
                  "courtInstance",
                );
              }}
              disabled={saving === "courtInstance"}
              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Не указана</option>
              {COURT_INSTANCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {saving === "courtInstance" && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
          </div>
          <p className="text-[10px] text-zinc-400">
            Сейчас: {courtInstanceLabel(courtInstance)}
          </p>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium uppercase text-zinc-500">Ответственный юрист</label>
          <div className="flex gap-2">
            <input
              value={lawyer}
              onChange={(e) => setLawyer(e.target.value)}
              onBlur={() => {
                if (lawyer === (assignedLawyer ?? "")) return;
                void patch({ assignedLawyer: lawyer.trim() || null }, "assignedLawyer");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void patch({ assignedLawyer: lawyer.trim() || null }, "assignedLawyer");
                }
              }}
              placeholder="ФИО юриста"
              disabled={saving === "assignedLawyer"}
              className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            {saving === "assignedLawyer" && <Loader2 className="h-4 w-4 animate-spin self-center" />}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
