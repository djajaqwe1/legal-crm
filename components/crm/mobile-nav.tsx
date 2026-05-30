"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { CrmSidebar } from "@/components/crm/sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — visible only on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-shadow"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="relative h-full">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Закрыть меню"
          >
            <X className="h-4 w-4" />
          </button>
          <CrmSidebar />
        </div>
      </div>
    </>
  );
}
