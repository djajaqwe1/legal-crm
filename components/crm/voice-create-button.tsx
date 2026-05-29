"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SpeechRecognitionEvent = {
  results: { [key: number]: { [key: number]: { transcript: string } } };
};
type SpeechRecognitionErrorEvent = { error: string };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type WindowWithSpeech = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

type Status = "idle" | "listening" | "creating" | "done" | "error";

type CreatedResult = {
  isNewClient: boolean;
  client: { id: string; name: string };
  case: { id: string; code: string; title: string };
};

export function VoiceCreateButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status !== "creating" || !transcript.trim()) return;

    void (async () => {
      try {
        const res = await fetch("/api/ai/voice-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript }),
        });
        const data = (await res.json()) as CreatedResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Ошибка");
        setResult(data);
        setStatus("done");
        router.refresh();
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Не удалось создать");
        setStatus("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transcript]);

  function startListening() {
    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("Используйте Chrome или Edge");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
      return;
    }

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      setTranscript(e.results[0][0].transcript);
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setErrorMsg(`Ошибка микрофона: ${e.error}`);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    };
    recognition.onend = () => {
      setStatus((prev) => (prev === "listening" ? "creating" : prev));
    };

    setStatus("listening");
    setTranscript("");
    setResult(null);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function reset() {
    setStatus("idle");
    setResult(null);
    setTranscript("");
    setErrorMsg("");
  }

  if (status === "done" && result) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Дело создано успешно!
            </p>
            <p className="mt-0.5 text-xs text-green-700 dark:text-green-400">
              {result.case.code} — {result.case.title}
            </p>
            {result.isNewClient && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-500">
                + Создан новый клиент: <strong>{result.client.name}</strong>
              </p>
            )}
            <div className="mt-2 flex items-center gap-3">
              <Link
                href={`/admin/cases/${result.case.id}`}
                className="text-xs font-medium text-green-700 underline hover:text-green-900"
              >
                Открыть дело →
              </Link>
              <button
                onClick={reset}
                className="text-xs text-green-600 hover:text-green-800"
              >
                Создать ещё
              </button>
            </div>
          </div>
        </div>
        {transcript && (
          <p className="mt-2 text-[11px] italic text-green-600 truncate">
            &laquo;{transcript}&raquo;
          </p>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
          <button onClick={reset} className="ml-auto text-xs font-medium text-red-600 hover:text-red-800">
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "creating"}
        className={`group flex w-full items-center gap-3 rounded-xl border-2 px-5 py-3.5 text-sm font-semibold transition-all ${
          status === "listening"
            ? "animate-pulse border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20"
            : status === "creating"
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20"
            : "border-dashed border-zinc-300 text-zinc-600 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 dark:border-zinc-700 dark:hover:border-violet-600"
        }`}
      >
        {status === "creating" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : status === "listening" ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5 transition-transform group-hover:scale-110" />
        )}
        <span>
          {status === "listening"
            ? "Говорите... (нажмите чтобы остановить)"
            : status === "creating"
            ? "Создаю дело..."
            : "Создать дело голосом"}
        </span>
      </button>

      {status === "idle" && (
        <p className="text-[11px] text-zinc-400 text-center">
          Скажите: &laquo;Клиент Иванов, дело по взысканию долга, статус в работе&raquo;
        </p>
      )}

      {transcript && status === "creating" && (
        <p className="truncate rounded bg-zinc-50 px-2 py-1 text-[11px] italic text-zinc-500">
          &laquo;{transcript}&raquo;
        </p>
      )}
    </div>
  );
}
