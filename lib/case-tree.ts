import type { CaseKind, CaseStatus } from "@/lib/generated-client";

export const CASE_KIND_LABELS: Record<CaseKind, string> = {
  CONSULTATION: "Консультация",
  COURT: "Судебное",
  PROJECT: "Проект",
};

export const CLIENT_CATEGORY_LABELS = {
  INDIVIDUAL: "Физлицо",
  LEGAL_ENTITY: "Юрлицо",
} as const;

export type CaseTreeNode = {
  id: string;
  code: string;
  title: string;
  status: CaseStatus;
  kind: CaseKind;
  parentCaseId: string | null;
  objectName?: string | null;
  children: CaseTreeNode[];
};

export type FlatCaseForTree = {
  id: string;
  code: string;
  title: string;
  status: CaseStatus;
  kind: CaseKind;
  parentCaseId: string | null;
  object?: { name: string } | null;
};

export function buildCaseTree(cases: FlatCaseForTree[]): CaseTreeNode[] {
  const nodes = new Map<string, CaseTreeNode>();

  for (const c of cases) {
    nodes.set(c.id, {
      id: c.id,
      code: c.code,
      title: c.title,
      status: c.status,
      kind: c.kind,
      parentCaseId: c.parentCaseId,
      objectName: c.object?.name ?? null,
      children: [],
    });
  }

  const roots: CaseTreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentCaseId && nodes.has(node.parentCaseId)) {
      nodes.get(node.parentCaseId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
