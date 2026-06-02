"use client";

import { useCallback, useRef, useState } from "react";
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
};

type WindowWithSpeech = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

type Options = {
  onTranscript: (text: string) => void;
};

export function useJarvisVoice({ onTranscript }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\n+/g, " ").slice(0, 350);
    if (!clean.trim()) return;
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = "ru-RU";
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterim("");
  }, []);

  const startListening = useCallback(() => {
    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("Голос работает в Chrome или Edge.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setInterim("");
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterim("");
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim("");
    };

    recognition.onresult = (event) => {
      const idx = event.results.length - 1;
      const chunk = event.results[idx];
      const transcript = chunk[0]?.transcript ?? "";
      if (chunk.isFinal) {
        setInterim("");
        if (transcript.trim()) onTranscriptRef.current(transcript.trim());
      } else {
        setInterim(transcript);
      }
    };

    recognition.start();
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  return { isListening, interim, speak, startListening, stopListening, toggleListening };
}

export function isVoiceConfirm(text: string): boolean {
  return VOICE_CONFIRM_RE.test(text.trim());
}
