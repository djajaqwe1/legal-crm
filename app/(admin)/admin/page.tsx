import { Suspense } from "react";
import { JarvisWorkspace } from "@/components/crm/jarvis-workspace";

export default function JarvisPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500">Загрузка Джарвис…</p>
      </div>
    }>
      <JarvisWorkspace />
    </Suspense>
  );
}
