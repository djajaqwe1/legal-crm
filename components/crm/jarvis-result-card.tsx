"use client";

import Link from "next/link";
import { DownloadPdfButton } from "@/components/crm/download-pdf-button";
import { DownloadDocxButton } from "@/components/crm/download-docx-button";

type ToolResult = Record<string, unknown> | unknown[] | null;

function DocumentDraftBlock({
  exportTitle,
  docType,
  text,
}: {
  exportTitle: string;
  docType: string;
  text: string;
}) {
  return (
    <>
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">Черновик {docType}</p>
      <div className="mb-2 flex flex-wrap gap-2">
        <DownloadPdfButton title={exportTitle} text={text} />
        <DownloadDocxButton title={exportTitle} text={text} />
      </div>
      <pre className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/30">
        {text}
      </pre>
    </>
  );
}

/** Карточка результата intake / документов — общая для полного и плавающего Джarvis. */
export function JarvisIntakeResultCard({
  data,
  compact,
}: {
  data: ToolResult;
  compact?: boolean;
}) {
  if (!data || typeof data !== "object" || !("case" in data)) return null;

  const d = data as {
    case: { id?: string; code?: string; title?: string };
    document?: { type?: string; text?: string; isFallback?: boolean } | null;
    documentError?: string;
  };

  const exportTitle = `${d.case.code ?? "document"}-${d.document?.type ?? "doc"}`;

  return (
    <div className={`space-y-2 ${compact ? "mt-2" : "mt-3"}`}>
      {d.case.code && (
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium text-emerald-800 dark:text-emerald-200 ${compact ? "text-xs" : "text-[13px]"}`}>
            Дело {d.case.code} — {d.case.title}
          </p>
          {d.case.id && (
            <Link
              href={`/admin/cases/${d.case.id}`}
              className="text-[11px] text-violet-600 hover:underline"
            >
              Открыть карточку →
            </Link>
          )}
        </div>
      )}
      {d.document?.text ? (
        <>
          {d.document.isFallback && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              AI временно недоступен — показан структурный черновик. Отредактируйте перед отправкой.
            </p>
          )}
          <DocumentDraftBlock
            exportTitle={exportTitle}
            docType={d.document.type ?? "документа"}
            text={d.document.text}
          />
          <p className="text-[10px] text-zinc-400">
            Также сохранено в карточке дела → раздел «Документы».
          </p>
        </>
      ) : (
        <p className="text-[12px] text-amber-800 dark:text-amber-200">
          {d.documentError ?? "Черновик документа не создан. Откройте дело и сгенерируйте документ заново («Сгенерируй претензию»)."}
        </p>
      )}
    </div>
  );
}

export function JarvisResultCard({
  toolName,
  data,
  compact,
}: {
  toolName: string;
  data: ToolResult;
  compact?: boolean;
}) {
  if (toolName === "intake_new_case") {
    return <JarvisIntakeResultCard data={data} compact={compact} />;
  }
  if (toolName === "generate_document" && data && typeof data === "object" && "text" in data) {
    const d = data as { type: string; text: string };
    return (
      <div className="mt-3 space-y-2">
        <DocumentDraftBlock exportTitle={d.type} docType={d.type} text={d.text} />
      </div>
    );
  }
  if (toolName === "generate_for_case" && data && typeof data === "object" && "document" in data) {
    const d = data as { caseCode?: string; document?: { type?: string; text?: string } | null };
    if (!d.document?.text) return null;
    const exportTitle = `${d.caseCode ?? "case"}-${d.document.type ?? "doc"}`;
    return (
      <div className="mt-3 space-y-2">
        <DocumentDraftBlock exportTitle={exportTitle} docType={d.document.type ?? "документа"} text={d.document.text} />
      </div>
    );
  }
  return null;
}
