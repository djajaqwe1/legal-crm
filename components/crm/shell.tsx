import { CrmSidebar } from "@/components/crm/sidebar";

type CrmShellProps = {
  children: React.ReactNode;
};

export function CrmShell({ children }: CrmShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex min-h-screen">
        <div className="hidden lg:block w-[280px] fixed h-full">
          <CrmSidebar />
        </div>
        <main className="flex-1 lg:ml-[280px] p-6 md:p-10 max-w-[1400px] mx-auto w-full">
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
