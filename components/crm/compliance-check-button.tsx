"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

interface ComplianceCheckButtonProps {
  contractId: string;
  contractNumber: string;
}

export function ComplianceCheckButton({ contractId, contractNumber }: ComplianceCheckButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleCheck = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setAnalysis(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Произошла ошибка при анализе");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={() => {
            if (!analysis) handleCheck();
          }}
        >
          <Bot className="h-4 w-4" />
          AI Проверка
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Compliance-анализ договора {contractNumber}
          </DialogTitle>
          <DialogDescription>
            ИИ-агент анализирует текст на соответствие ГК РК и выявляет риски
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm">Офицер комплаенс изучает условия...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={handleCheck} className="ml-auto">
                Повторить
              </Button>
            </div>
          ) : analysis ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
