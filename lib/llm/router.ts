/**
 * Маршрутизатор LLM: Gemini (основной) + опциональный OpenAI fallback для текста.
 * Tool-calling агента работает через Gemini; OpenAI — резерв без инструментов.
 */

import {
  GoogleGenerativeAI,
  type ChatSession,
  type FunctionDeclaration,
  type GenerativeModel,
} from "@google/generative-ai";
import { GEMINI_MODELS, isGeminiRetryableError } from "@/lib/gemini-models";

export type LlmHistoryMessage = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

export type LlmChatResult = {
  response: Awaited<ReturnType<ChatSession["sendMessage"]>>["response"];
  chat: ChatSession;
  provider: "gemini" | "openai";
  modelUsed: string;
};

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export function getAvailableProviders(): string[] {
  const list: string[] = [];
  if (GEMINI_KEY) list.push("gemini");
  if (OPENAI_KEY) list.push("openai");
  return list;
}

/** Gemini chat с function calling и fallback по моделям. */
export async function createGeminiToolChat(
  systemInstruction: string,
  tools: FunctionDeclaration[],
  history: LlmHistoryMessage[],
  lastMessage: string,
): Promise<LlmChatResult> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY не настроен");

  let lastError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
      });
      const chat = model.startChat({ history: history.slice(-12) });
      const response = (await chat.sendMessage(lastMessage)).response;
      return { response, chat, provider: "gemini", modelUsed: modelName };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!isGeminiRetryableError(lastError.message)) throw lastError;
      if (lastError.message.includes("429")) await new Promise(r => setTimeout(r, 1200));
    }
  }

  throw lastError ?? new Error("Все модели Gemini недоступны");
}

/** Простая генерация текста без tools — OpenAI если Gemini недоступен. */
export async function generateTextFallback(prompt: string, system?: string): Promise<string> {
  if (GEMINI_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      for (const modelName of GEMINI_MODELS.slice(0, 2)) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: system,
          });
          const result = await model.generateContent(prompt);
          const text = result.response.text();
          if (text?.trim()) return text;
        } catch {
          continue;
        }
      }
    } catch {
      /* fall through to OpenAI */
    }
  }

  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (text?.trim()) return text;
    }
  }

  throw new Error("Нет доступного LLM-провайдера");
}
