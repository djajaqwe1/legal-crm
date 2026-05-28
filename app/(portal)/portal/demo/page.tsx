import Link from "next/link";

const DEMO_CASES = [
  {
    id: "demo-1",
    code: "DEMO-2024-001",
    title: "Взыскание задолженности по договору займа",
    status: "На рассмотрении суда",
    deadline: "15 июня 2026",
    object: "Кредитный договор №12345",
    lastUpdate: "Подана апелляционная жалоба. Заседание назначено.",
  },
  {
    id: "demo-2",
    code: "DEMO-2024-002",
    title: "Расторжение договора аренды",
    status: "В работе",
    deadline: "30 июля 2026",
    object: "Договор аренды ТРЦ «Мегацентр»",
    lastUpdate: "Подготовлена досудебная претензия. Ожидаем ответа.",
  },
  {
    id: "demo-3",
    code: "DEMO-2024-003",
    title: "Регистрация ТОО и оформление учредительных документов",
    status: "Завершено",
    deadline: null,
    object: null,
    lastUpdate: "Все документы зарегистрированы. Свидетельство получено.",
  },
];

const STATUS_COLORS: Record<string, string> = {
  "На рассмотрении суда": "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  "В работе": "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  "Завершено": "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300",
};

export default function PortalDemoPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Demo banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Демо-режим</p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            Это предварительный просмотр личного кабинета клиента. Данные демонстрационные.
            После подключения к базе данных вы увидите свои реальные дела.
          </p>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Ваши дела</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Статусы обновляет юрист в CRM. ИИ по делу доступен на странице дела.
        </p>
      </div>

      {/* Demo AI consultation widget */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Задать вопрос ИИ-консультанту
        </p>
        <div className="mt-3 flex gap-2">
          <input
            disabled
            placeholder="Введите ваш вопрос… (доступно при подключении к БД)"
            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            disabled
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Отправить
          </button>
        </div>
      </div>

      {/* Cases list */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {DEMO_CASES.map((c) => (
            <li key={c.id}>
              <div className="block px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-400">{c.code}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[c.status] ?? "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{c.title}</p>
                {c.object ? (
                  <p className="mt-0.5 text-xs text-zinc-500">Объект: {c.object}</p>
                ) : null}
                {c.deadline ? (
                  <p className="mt-0.5 text-xs text-zinc-500">Срок: {c.deadline}</p>
                ) : null}
                <p className="mt-2 text-xs text-zinc-500 italic">📋 {c.lastUpdate}</p>

                {/* Demo AI chat stub */}
                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs font-medium text-zinc-500">ИИ по делу</p>
                  <p className="mt-1 text-xs text-zinc-400 italic">
                    Здесь будет контекстный чат с ИИ, который знает все подробности вашего дела.
                    После подключения к базе данных функция станет активной.
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/portal/login" className="font-medium text-blue-600 hover:underline">
          Войти в личный кабинет
        </Link>
        {" · "}
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          На сайт
        </Link>
      </p>
    </main>
  );
}
