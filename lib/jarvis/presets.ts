export type JarvisPresetId =
  | "chat"
  | "register_case"
  | "attach_documents"
  | "consultation"
  | "analytics"
  | "report_employee"
  | "daily_routine"
  | "pretension";

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

export const PRESET_FILE_ACCEPT: Partial<Record<JarvisPresetId, string>> = {
  register_case: ".txt,.pdf,text/plain,application/pdf",
  attach_documents:
    ".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png",
};

export const JARVIS_PRESETS: JarvisPreset[] = [
  {
    id: "chat",
    label: "Голосовой оператор",
    description: "Говорите — система выполняет: дела, задачи, документы",
    placeholder: "Или нажмите микрофон и говорите до остановки…",
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
    id: "attach_documents",
    label: "Прикрепить к делу",
    description: "Загрузите файлы в существующую карточку дела",
    placeholder: "Комментарий (необязательно)…",
    acceptsFiles: true,
    fileHint: "PDF, Word, фото — сохранятся в документы дела",
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
  {
    id: "daily_routine",
    label: "Мой рабочий день",
    description: "Задачи на сегодня, просрочки, дедлайны",
    placeholder: "ФИО юриста или оставьте пустым",
    starterPrompt: "Покажи мой рабочий день: просрочки, задачи на сегодня, дедлайны дел.",
  },
  {
    id: "pretension",
    label: "Досудебная претензия",
    description: "Чеклист претензии + черновик документа",
    placeholder: "Опишите спор и контрагента…",
    starterPrompt:
      "Помоги с досудебной претензией: найди дело или создай задачи по чеклисту претензии, предложи структуру документа.",
  },
];

export function getPreset(id: JarvisPresetId): JarvisPreset {
  return JARVIS_PRESETS.find(p => p.id === id) ?? JARVIS_PRESETS[0];
}

/** Мгновенная команда без Gemini при отправке пресета без текста */
export const PRESET_FAST_COMMAND: Partial<Record<JarvisPresetId, string>> = {
  daily_routine: "мой рабочий день",
  analytics: "покажи расширенную аналитику дел",
  report_employee: "отчёт эффективности юриста",
};
