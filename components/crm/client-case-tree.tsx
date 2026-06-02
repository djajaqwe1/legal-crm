import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { caseStatusToRu } from "@/lib/case-status";
import { statusColorMap } from "@/lib/crm-data";
import { CASE_KIND_LABELS, type CaseTreeNode } from "@/lib/case-tree";
import { ChevronRight, GitBranch, ExternalLink } from "lucide-react";

function CaseTreeItem({ node, depth = 0 }: { node: CaseTreeNode; depth?: number }) {
  const statusLabel = caseStatusToRu[node.status] ?? node.status;
  const kindLabel = CASE_KIND_LABELS[node.kind] ?? node.kind;

  return (
    <li className="space-y-1">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-100 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
        style={{ marginLeft: depth * 16 }}
      >
        {depth > 0 && <GitBranch className="h-3 w-3 text-violet-400 shrink-0" />}
        <span className="font-mono text-[10px] text-zinc-400">{node.code}</span>
        <Link
          href={`/admin/cases/${node.id}`}
          className="flex-1 min-w-0 text-sm font-medium hover:text-blue-600 truncate"
        >
          {node.title}
        </Link>
        <Badge variant="outline" className="text-[9px] shrink-0">{kindLabel}</Badge>
        <Badge className={`${statusColorMap[statusLabel] ?? statusColorMap["Новый"]} border-0 text-[9px] shrink-0`}>
          {statusLabel}
        </Badge>
        <Link href={`/admin/cases/${node.id}/assistant`} className="text-zinc-400 hover:text-blue-600 shrink-0" title="AI по делу">
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      {node.children.length > 0 && (
        <ul className="space-y-1 border-l border-zinc-200 ml-4 dark:border-zinc-800">
          {node.children.map(child => (
            <CaseTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ClientCaseTree({ roots }: { roots: CaseTreeNode[] }) {
  if (!roots.length) {
    return (
      <p className="px-6 pb-6 text-sm text-zinc-500 italic">
        Дел пока нет — создайте из реестра или через Джарвис.
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-4 pb-4">
      {roots.map(root => (
        <CaseTreeItem key={root.id} node={root} />
      ))}
    </ul>
  );
}

export function ClientCaseTreeLegend() {
  return (
    <p className="flex items-center gap-1 px-4 pb-2 text-[10px] text-zinc-400">
      <ChevronRight className="h-3 w-3" />
      Консультации могут перейти в судебные дела (ветка ниже)
    </p>
  );
}
