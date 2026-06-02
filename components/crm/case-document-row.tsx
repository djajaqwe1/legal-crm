import { FileText, Download } from "lucide-react";
import { documentStorageHint, isDownloadableDocument } from "@/lib/document-utils";

type Props = {
  name: string;
  path: string;
};

export function CaseDocumentRow({ name, path }: Props) {
  const hint = documentStorageHint(path);
  const downloadable = isDownloadableDocument(path);

  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="truncate text-sm" title={name}>{name}</span>
      </div>
      {downloadable ? (
        <a
          href={path}
          download={name}
          className="shrink-0 text-xs text-blue-600 hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      ) : hint ? (
        <span className="shrink-0 text-[10px] text-zinc-400">{hint}</span>
      ) : null}
    </li>
  );
}
