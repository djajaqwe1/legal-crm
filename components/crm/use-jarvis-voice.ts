"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isVoiceConfirm, isVoiceDeny } from "@/lib/jarvis/types";

type SpeechResultList = {
  length: number;
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
};

type SpeechResultEvent = {
  results: SpeechResultList;
  resultIndex?: number;
};

type SpeechErrorEvent = { error?: string };

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WindowWithSpeech = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

type Options = {
  /** Вызывается один раз после остановки записи — полный текст монолога */
  onRecordingComplete?: (text: string) => void;
  /** Мгновенная отправка каждого финального фрагмента (для подтверждений и legacy) */
  onTranscript?: (text: string) => void;
  /** accumulate — накапливать до кнопки «стоп»; instant — отправлять сразу */
  mode?: "accumulate" | "instant";
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mapSpeechError(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Доступ к микрофону запрещён — разрешите в настройках браузера.";
    case "no-speech":
      return "Не услышал речь. Попробуйте ещё раз.";
    case "audio-capture":
      return "Микрофон недоступен или занят другим приложением.";
    case "network":
      return "Сеть недоступна для распознавания речи.";
    case "aborted":
      return "Запись прервана.";
    default:
      return "Ошибка распознавания речи.";
  }
}

export function useJarvisVoice({
  onRecordingComplete,
  onTranscript,
  mode = "accumulate",
}: Options) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const finalBufferRef = useRef("");
  const latestTranscriptRef = useRef("");
  const finalizeOnceRef = useRef(false);
  const onCompleteRef = useRef(onRecordingComplete);
  const onTranscriptRef = useRef(onTranscript);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  onCompleteRef.current = onRecordingComplete;
  onTranscriptRef.current = onTranscript;

  const clearVoiceError = useCallback(() => setVoiceError(null), []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(() => {
    if (finalizeOnceRef.current) return;
    finalizeOnceRef.current = true;

    clearTimer();
    listeningRef.current = false;
    setIsListening(false);
    setRecordingSeconds(0);

    const full = (latestTranscriptRef.current || finalBufferRef.current).trim();
    finalBufferRef.current = "";
    latestTranscriptRef.current = "";
    setInterim("");

    if (full) {
      if (mode === "accumulate") {
        onCompleteRef.current?.(full);
      } else {
        onTranscriptRef.current?.(full);
      }
    }

    finalizeOnceRef.current = false;
  }, [clearTimer, mode]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceError("Голосовой ввод доступен в Chrome или Edge.");
      return;
    }

    setVoiceError(null);
    finalBufferRef.current = "";
    latestTranscriptRef.current = "";
    setInterim("");
    setRecordingSeconds(0);
    finalizeOnceRef.current = false;

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    listeningRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
      clearTimer();
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    };

    recognition.onerror = (event) => {
      const code = event?.error ?? "unknown";
      if (code === "no-speech") {
        if (listeningRef.current) {
          try {
            recognition.start();
          } catch {
            finalizeRecording();
          }
        }
        return;
      }
      if (code === "not-allowed" || code === "aborted" || code === "audio-capture") {
        setVoiceError(mapSpeechError(code));
        listeningRef.current = false;
        clearTimer();
        setIsListening(false);
        finalizeRecording();
        return;
      }
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          setVoiceError(mapSpeechError(code));
          finalizeRecording();
        }
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          finalizeRecording();
        }
        return;
      }
      finalizeRecording();
    };

    recognition.onresult = (event) => {
      let finalized = "";
      let interimText = "";
      const start = typeof event.resultIndex === "number" ? event.resultIndex : 0;

      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i];
        const transcript = (chunk[0]?.transcript ?? "").trim();
        if (!transcript) continue;
        if (chunk.isFinal) {
          finalized = finalized ? `${finalized} ${transcript}` : transcript;
          if (mode === "instant" && i >= start) {
            onTranscriptRef.current?.(transcript);
          }
        } else {
          interimText = transcript;
        }
      }

      finalBufferRef.current = finalized;
      const preview = interimText ? `${finalized} ${interimText}`.trim() : finalized;
      latestTranscriptRef.current = preview;
      setInterim(preview);
    };

    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setIsListening(false);
      setVoiceError("Не удалось запустить микрофон.");
    }
  }, [clearTimer, finalizeRecording, mode]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      clearTimer();
      recognitionRef.current?.abort();
    };
  }, [clearTimer]);

  return {
    isListening,
    interim,
    recordingSeconds,
    recordingDuration: formatDuration(recordingSeconds),
    voiceError,
    clearVoiceError,
    toggleListening,
    startListening,
    stopListening,
  };
}

export function isVoiceConfirmText(text: string): boolean {
  return isVoiceConfirm(text);
}

export function isVoiceDenyText(text: string): boolean {
  return isVoiceDeny(text);
}

/** Озвучить ответ по кнопке (не автоматически). */
export function speakJarvis(text: string, maxLen = 800) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  primeVoices();
  const clean = text.replace(/\*\*/g, "").replace(/^#+\s/gm, "").slice(0, maxLen);
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = "ru-RU";
  utter.rate = 0.98;
  utter.pitch = 1;
  const voice = pickRussianVoice();
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopJarvisSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeechActive(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}

function pickRussianVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const ranked = [
    (v: SpeechSynthesisVoice) => /Google.*Russian|Google\s+русский/i.test(v.name),
    (v: SpeechSynthesisVoice) => /Microsoft.*Irina|Microsoft.*Pavel|Natural.*Russian/i.test(v.name),
    (v: SpeechSynthesisVoice) => v.lang === "ru-RU" || v.lang.startsWith("ru"),
  ];
  for (const score of ranked) {
    const hit = voices.find(score);
    if (hit) return hit;
  }
  return null;
}

let voicesPrimed = false;
function primeVoices() {
  if (voicesPrimed || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
  voicesPrimed = true;
}

export { isVoiceConfirmText as isVoiceConfirm };
