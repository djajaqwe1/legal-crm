export type JarvisPresetId =
  | "chat"
  | "register_case"
  | "consultation"
  | "analytics"
  | "report_employee";

export type JarvisPreset = {
  id: JarvisPresetId;
  label: string;
  description: string;
  /** Подсказка в поле ввода */
  placeholder: string;
  /** Системная подсказка для первого сообщения (если не загрузка файлов) */
  starterPrompt?: string;
  acceptsFiles?: boolean;
  fileHint?: string;
};

export const JARVIS_PRESETS: JarvisPreset[] = [
  {
    id: "chat",
    label: "Свободный чат",
    description: "Вопросы, команды, управление CRM",
    placeholder: "Сообщение Джарвису…",
  },
  {
    id: "register_case",
    label: "Зарегистрировать дело",
    description: "Загрузите материалы — создам карточку дела в базе",
    placeholder: "Комментарий к материалам (необязательно)…",
    acceptsFiles: true,
    fileHint: "Решения, иски, договоры, переписка (.txt, .pdf до 10 МБ)",
  },
  {
    id: "consultation",
    label: "Консультационное дело",
    description: "Новая консультация (может перейти в судебное)",
    placeholder: "Опишите ситуацию клиента…",
    starterPrompt: "Создай консультационное дело. Спроси недостающие данные и подготовь карточку.",
  },
  {
    id: "analytics",
    label: "Аналитика и отчёт",
    description: "Статистика дел, выигрыши, просрочки, финансы",
    placeholder: "Какой отчёт нужен?",
    starterPrompt: "Покажи расширенную аналитику: дела по стадиям, просрочки, консультации vs суд, итоги если есть.",
  },
  {
    id: "report_employee",
    label: "Эффективность юриста",
    description: "Сводка по делам, документам, консультациям",
    placeholder: "ФИО юриста или «все»",
    starterPrompt: "Сформируй отчёт эффективности юриста по делам в CRM.",
  },
];

export function getPreset(id: JarvisPresetId): JarvisPreset {
  return JARVIS_PRESETS.find(p => p.id === id) ?? JARVIS_PRESETS[0];
}
