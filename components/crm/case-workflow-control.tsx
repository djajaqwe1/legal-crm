"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ListChecks } from "lucide-react";
import {
  CASE_WORKFLOW_CATALOG,
  type CaseWorkflowId,
  workflowsForCase,
} from "@/lib/case-workflows";
import type { CaseKind } from "@/lib/generated-client";

type CaseWorkflowControlProps = {
  caseId: string;
  kind: CaseKind;
  taskCount: number;
};

export function CaseWorkflowControl({ caseId, kind, taskCount }: CaseWorkflowControlProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<CaseWorkflowId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workflows = workflowsForCase(kind);
  const extras = CASE_WORKFLOW_CATALOG.filter(
    (w) => w.id === "pretension_flow" && !workflows.some((x) => x.id === w.id),
  );
  const all = [...workflows, ...extras];

  async function apply(workflowId: CaseWorkflowId) {
    setLoading(workflowId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/apply-workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        created?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Ошибка");
      setMessage(data.message ?? "Готово");
      if (data.created && data.created > 0) router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
          Автоматизация: типовые чеклисты
        </p>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {taskCount > 0
          ? `В деле ${taskCount} задач. Добавьте стандартный план — дубликаты не создаются.`
          : "Задач пока нет — примените чеклист одним нажатием."}
      </p>
      <div className="flex flex-wrap gap-2">
        {all.map((w) => (
          <Button
            key={w.id}
            type="button"
            variant="outline"
            size="sm"
            disabled={loading !== null}
            onClick={() => void apply(w.id)}
            className="relative text-left h-auto py-2 px-3 flex flex-col items-start gap-0.5 max-w-[220px]"
          >
            <span className="font-medium text-xs">{w.label}</span>
            <span className="text-[10px] text-zinc-500 font-normal">{w.description}</span>
            {loading === w.id && <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-2" />}
          </Button>
        ))}
      </div>
      {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
