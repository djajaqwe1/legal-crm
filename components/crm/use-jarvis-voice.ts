"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VOICE_CONFIRM_RE } from "@/lib/jarvis/types";

type SpeechResultList = {
  length: number;
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
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

export function useJarvisVoice({
  onRecordingComplete,
  onTranscript,
  mode = "accumulate",
}: Options) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const listeningRef = useRef(false);
  const finalBufferRef = useRef("");
  const onCompleteRef = useRef(onRecordingComplete);
  const onTranscriptRef = useRef(onTranscript);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  onCompleteRef.current = onRecordingComplete;
  onTranscriptRef.current = onTranscript;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(() => {
    clearTimer();
    listeningRef.current = false;
    setIsListening(false);
    setRecordingSeconds(0);

    const full = finalBufferRef.current.trim();
    finalBufferRef.current = "";
    setInterim("");

    if (full) {
      if (mode === "accumulate") {
        onCompleteRef.current?.(full);
      } else {
        onTranscriptRef.current?.(full);
      }
    }
  }, [clearTimer, mode]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("Голосовой ввод доступен в Chrome или Edge.");
      return;
    }

    finalBufferRef.current = "";
    setInterim("");
    setRecordingSeconds(0);

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

    recognition.onerror = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
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
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i];
        const transcript = chunk[0]?.transcript ?? "";
        if (chunk.isFinal) {
          const piece = transcript.trim();
          if (piece) {
            finalBufferRef.current = `${finalBufferRef.current} ${piece}`.trim();
            if (mode === "instant") {
              onTranscriptRef.current?.(piece);
            }
          }
        } else {
          interimText = transcript;
        }
      }
      const preview = `${finalBufferRef.current} ${interimText}`.trim();
      setInterim(preview);
    };

    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setIsListening(false);
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
    toggleListening,
    startListening,
    stopListening,
  };
}

export function isVoiceConfirm(text: string): boolean {
  return VOICE_CONFIRM_RE.test(text.trim());
}
