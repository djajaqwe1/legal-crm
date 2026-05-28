import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Рустем Айкимбаев | ТОО «Конгломерат Алтай» — Юридические услуги",
  description: "Экспертная юридическая помощь, представительство в суде и LegalTech решения для вашего бизнеса.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900">
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-zinc-900">CONGLOMERATE</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#about" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Обо мне</a>
            <a href="#services" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Услуги</a>
            <a href="#results" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Кейсы</a>
            <a href="#contacts" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">Контакты</a>
          </nav>
          <div className="flex items-center gap-4">
            <a 
              href="/login" 
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Вход
            </a>
            <a 
              href="#contacts" 
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Консультация
            </a>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-100 bg-zinc-50 py-12">
        <div className="container mx-auto px-4 text-center md:px-6">
          <p className="text-sm text-zinc-500">© 2026 ТОО «Конгломерат Алтай». Все права защищены.</p>
        </div>
      </footer>
    </div>
  );
}
