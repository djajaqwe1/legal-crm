import Link from "next/link";
import { PortalAiChatPanel } from "@/components/portal/portal-ai-chat-panel";

export default function PortalChatPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">ИИ-консультант</h1>
        <Link href="/portal/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
          К делам
        </Link>
      </div>
      <PortalAiChatPanel
        endpoint="/api/portal/ai/chat"
        title="Общие вопросы"
        subtitle="Не привязано к конкретному делу. Лимит сообщений обновляется каждый день (UTC)."
      />
    </main>
  );
}
