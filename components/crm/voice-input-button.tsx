"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

type ParsedCaseData = {
  title?: string;
  status?: string;
  deadline?: string;
  clientName?: string;
  clientId?: string;
  description?: string;
  suggestedCode?: string;
};

interface Props {
  clients: { id: string; name: string }[];
  onParsed: (data: ParsedCaseData) => void;
}

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

type Status = "idle" | "listening" | "parsing" | "done" | "error" | "unsupported";

export function VoiceInputButton({ clients, onParsed }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const clientsRef = useRef(clients);
  clientsRef.current = clients;

  // When transcript is ready → call parse API
  useEffect(() => {
    if (status !== "parsing" || !transcript.trim()) return;

    void (async () => {
      try {
        const res = await fetch("/api/ai/parse-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: transcript, clients: clientsRef.current }),
        });
        if (!res.ok) throw new Error("parse error");
        const data = (await res.json()) as ParsedCaseData;
        onParsed(data);
        setStatus("done");
        setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setErrorMsg("Не удалось распознать — попробуйте ещё раз");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, transcript]);

  function startListening() {
    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setStatus("unsupported"); return; }

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
      setTimeout(() => setStatus("idle"), 3000);
    };
    recognition.onend = () => {
      setStatus((prev) => (prev === "listening" ? "parsing" : prev));
    };

    setStatus("listening");
    setTranscript("");
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  const label: Record<Status, string> = {
    idle: "Голосовой ввод",
    listening: "Говорите... (нажмите чтобы остановить)",
    parsing: "Распознаю...",
    done: "✓ Поля заполнены",
    error: errorMsg || "Ошибка",
    unsupported: "Нужен Chrome или Edge",
  };

  const colors: Record<Status, string> = {
    idle: "border-zinc-200 text-zinc-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50",
    listening: "border-red-400 text-red-600 bg-red-50 animate-pulse",
    parsing: "border-blue-300 text-blue-600 bg-blue-50",
    done: "border-green-400 text-green-700 bg-green-50",
    error: "border-red-300 text-red-600 bg-red-50",
    unsupported: "border-zinc-200 text-zinc-400 cursor-not-allowed opacity-60",
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={status === "listening" ? stopListening : startListening}
        disabled={status === "parsing" || status === "unsupported" || status === "done"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${colors[status]}`}
      >
        {status === "parsing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "listening" ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {label[status]}
      </button>
      {transcript && status !== "idle" && (
        <p className="truncate rounded bg-zinc-50 px-2 py-1 text-[11px] text-zinc-500 italic">
          &laquo;{transcript}&raquo;
        </p>
      )}
    </div>
  );
}
