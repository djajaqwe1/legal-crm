"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text: string;
  className?: string;
};

export function DownloadDocxButton({ title, text, className }: Props) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents/download-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, text }),
      });
      if (!res.ok) throw new Error("docx failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Не удалось сформировать Word-документ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`h-7 gap-1 text-[11px] ${className ?? ""}`}
      onClick={() => void download()}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      Word
    </Button>
  );
}
