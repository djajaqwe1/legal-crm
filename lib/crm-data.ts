export const cases = [
  {
    id: "LC-2026-014",
    client: "ТОО Алтай Инвест",
    caseTitle: "Взыскание задолженности",
    status: "В работе",
    deadline: "30.04.2026",
  },
  {
    id: "LC-2026-019",
    client: "ИП Бекенова",
    caseTitle: "Договорной спор",
    status: "Новый",
    deadline: "03.05.2026",
  },
  {
    id: "LC-2026-022",
    client: "ТОО KazExport",
    caseTitle: "Арбитражное сопровождение",
    status: "Суд",
    deadline: "11.05.2026",
  },
  {
    id: "LC-2026-026",
    client: "АО Eurasia Group",
    caseTitle: "Комплаенс-аудит",
    status: "Пауза",
    deadline: "15.05.2026",
  },
];

export const clients = [
  { name: "ТОО Алтай Инвест", activeCases: 3, manager: "А. Сагындык" },
  { name: "ИП Бекенова", activeCases: 1, manager: "Д. Ахметов" },
  { name: "ТОО KazExport", activeCases: 2, manager: "Н. Кожанов" },
];

export const statusColorMap: Record<string, string> = {
  Новый: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100 font-semibold",
  "В работе": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 font-semibold",
  Суд: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 font-semibold",
  Пауза: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 font-semibold",
  Завершено: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 font-semibold",
};
