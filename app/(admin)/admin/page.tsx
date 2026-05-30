import { CrmShell } from "@/components/crm/shell";
import { JarvisChat } from "@/components/crm/jarvis-chat";
import { Sparkles } from "lucide-react";

export default function JarvisPage() {
  return (
    <CrmShell hideAssistant>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        <header className="mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Джарвис</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                AI-помощник · дела, клиенты, договоры · генерация документов · голосовое управление
              </p>
            </div>
          </div>
        </header>

        {/* Chat — fills remaining height */}
        <div className="flex-1 min-h-0">
          <JarvisChat />
        </div>
      </div>
    </CrmShell>
  );
}
