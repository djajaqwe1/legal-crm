"use client";

import { useCallback, useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { isSpeechActive, speakJarvis, stopJarvisSpeech } from "@/components/crm/use-jarvis-voice";

type Props = {
  text: string;
  compact?: boolean;
};

export function JarvisSpeakButton({ text, compact }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive(isSpeechActive());
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  const handleClick = useCallback(() => {
    if (isSpeechActive()) {
      stopJarvisSpeech();
      setActive(false);
      return;
    }
    speakJarvis(text);
    setActive(true);
  }, [text]);

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={active ? "Остановить озвучку" : "Озвучить ответ"}
      className={`inline-flex items-center gap-1 rounded-lg border transition-colors ${
        compact
          ? "border-zinc-200 px-2 py-1 text-[10px] dark:border-zinc-700"
          : "border-zinc-200 px-2.5 py-1 text-[11px] dark:border-zinc-700"
      } ${
        active
          ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
          : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {active ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {active ? "Стоп" : "Озвучить"}
    </button>
  );
}
