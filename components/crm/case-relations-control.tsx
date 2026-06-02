"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Scale, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CASE_KIND_LABELS } from "@/lib/case-tree";
import type { CaseKind } from "@/lib/generated-client";

type RelatedCase = {
  id: string;
  code: string;
  title: string;
  kind: CaseKind;
};

type CaseRelationsControlProps = {
  caseId: string;
  kind: CaseKind;
  parentCase: RelatedCase | null;
  childCases: RelatedCase[];
};

const KIND_OPTIONS: CaseKind[] = ["CONSULTATION", "COURT", "PROJECT"];

export function CaseRelationsControl({
  caseId,
  kind,
  parentCase,
  childCases,
}: CaseRelationsControlProps) {
  const router = useRouter();
  const [currentKind, setCurrentKind] = useState(kind);
  const [savingKind, setSavingKind] = useState(false);
  const [spawning, setSpawning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courtChild = childCases.find((c) => c.kind === "COURT");

  async function changeKind(next: CaseKind) {
    setCurrentKind(next);
    setSavingKind(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Не удалось сохранить тип");
      }
      router.refresh();
    } catch (e) {
      setCurrentKind(kind);
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingKind(false);
    }
  }

  async function spawnCourtCase() {
    setSpawning(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/spawn-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        error?: string;
        caseId?: string;
        navigate?: string;
        case?: { id: string };
      };

      if (res.status === 409 && data.caseId) {
        router.push(`/admin/cases/${data.caseId}`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Не удалось создать судебное дело");
      }

      const target = data.navigate ?? (data.case ? `/admin/cases/${data.case.id}` : null);
      if (target) {
        router.push(target);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSpawning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-100 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium uppercase text-zinc-500">Тип дела</p>
        <select
          value={currentKind}
          onChange={(e) => void changeKind(e.target.value as CaseKind)}
          disabled={savingKind || spawning}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {CASE_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        {savingKind && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      {parentCase && (
        <div className="text-sm">
          <p className="text-xs font-medium uppercase text-zinc-500 mb-1">Родительское дело</p>
          <Link
            href={`/admin/cases/${parentCase.id}`}
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
          >
            {parentCase.code} — {parentCase.title}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {childCases.length > 0 && (
        <div className="text-sm space-y-2">
          <p className="text-xs font-medium uppercase text-zinc-500">Связанные дела</p>
          <ul className="space-y-1">
            {childCases.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/admin/cases/${child.id}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <span className="font-mono text-xs">{child.code}</span>
                  <span>{CASE_KIND_LABELS[child.kind]}:</span>
                  <span>{child.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {currentKind === "CONSULTATION" && !courtChild && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void spawnCourtCase()}
          disabled={spawning}
          className="gap-2"
        >
          {spawning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Scale className="h-4 w-4" />
          )}
          Создать судебное дело
        </Button>
      )}

      {currentKind === "CONSULTATION" && courtChild && (
        <p className="text-xs text-zinc-500">
          Судебное дело уже создано:{" "}
          <Link href={`/admin/cases/${courtChild.id}`} className="text-blue-600 hover:underline">
            {courtChild.code}
          </Link>
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
