import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const JARVIS_TOOLS = [
  {
    name: "get_stats",
    description: "Статистика CRM: дела, клиенты, договоры, просроченные дела.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_cases",
    description: "Список дел с фильтрами. Для «последние N дел» укажи limit.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Новый | В работе | Суд | Пауза | Завершено" },
        clientName: { type: SchemaType.STRING, description: "Фильтр по клиенту" },
        limit: { type: SchemaType.NUMBER, description: "Сколько записей, по умолчанию 5" },
      },
    },
  },
  {
    name: "get_clients",
    description: "Список клиентов.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "get_contracts",
    description: "Список договоров.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: "Поиск по номеру или контрагенту" },
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "get_overdue_cases",
    description: "Просроченные дела (дедлайн прошёл, не завершены).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "find_case",
    description: "Найти дело по коду (LC-2026-001), названию или клиенту. Вернёт id для других операций.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Код, название или имя клиента" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_analytics",
    description: "Расширенная аналитика: исходы дел, консультации vs суд, финансы, юристы, документы.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_lawyer_daily",
    description: "Рабочий день юриста: просрочки, задачи на сегодня, дедлайны дел на неделю.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        lawyerName: { type: SchemaType.STRING, description: "ФИО юриста или пусто для всех" },
      },
    },
  },
  {
    name: "get_open_tasks",
    description: "Все открытые задачи по делам в CRM.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER },
      },
    },
  },
  {
    name: "search_adilet",
    description:
      "Поиск норм права РК в базе Әділет (adilet.zan.kz). ОБЯЗАТЕЛЬНО перед юридическими выводами, цитатами закона, составлением исков/претензий.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Ключевые слова: кодекс, статья, тема спора" },
        limit: { type: SchemaType.NUMBER, description: "Сколько документов, по умолчанию 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_case_context",
    description:
      "Полный контекст дела из CRM: описание, задачи, документы (извлечённый текст). Для анализа и подготовки процессуальных документов.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        caseId: { type: SchemaType.STRING, description: "ID дела (сначала find_case)" },
      },
      required: ["caseId"],
    },
  },
  {
    name: "apply_case_checklist",
    description: "Применить типовой чеклист задач к делу (консультация, суд, претензия). Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        caseId: { type: SchemaType.STRING },
        workflowId: {
          type: SchemaType.STRING,
          enum: [
            "consultation_intake",
            "court_first_instance",
            "court_appeal",
            "project_documents",
            "consultation_to_court",
            "pretension_flow",
          ],
        },
      },
      required: ["caseId", "workflowId"],
    },
  },
  {
    name: "navigate_to",
    description: "Открыть раздел CRM или карточку. Выполняется сразу — переводит юриста на нужный экран.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        page: {
          type: SchemaType.STRING,
          enum: ["dashboard", "cases", "clients", "contracts", "documents-builder", "jarvis", "case", "client"],
        },
        id: { type: SchemaType.STRING, description: "ID для page=case или page=client" },
        query: { type: SchemaType.STRING, description: "Поисковый запрос для списков" },
      },
      required: ["page"],
    },
  },
  {
    name: "create_case",
    description: "Создать дело. Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        clientName: { type: SchemaType.STRING },
        status: { type: SchemaType.STRING, enum: ["Новый", "В работе", "Суд", "Пауза", "Завершено"] },
        deadline: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
        description: { type: SchemaType.STRING },
      },
      required: ["title", "clientName"],
    },
  },
  {
    name: "create_client",
    description: "Создать клиента. Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        phone: { type: SchemaType.STRING },
        email: { type: SchemaType.STRING },
      },
      required: ["name"],
    },
  },
  {
    name: "update_case",
    description: "Обновить поле дела. Сначала find_case если нет id. Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        caseId: { type: SchemaType.STRING },
        field: { type: SchemaType.STRING, enum: ["status", "description", "deadline", "title"] },
        value: { type: SchemaType.STRING },
      },
      required: ["caseId", "field", "value"],
    },
  },
  {
    name: "add_task",
    description: "Добавить задачу в дело. Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        caseId: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        dueDate: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
      },
      required: ["caseId", "title"],
    },
  },
  {
    name: "create_contract",
    description: "Создать договор. Требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        number: { type: SchemaType.STRING },
        counterparty: { type: SchemaType.STRING },
        type: { type: SchemaType.STRING },
        clientName: { type: SchemaType.STRING },
      },
      required: ["number", "counterparty"],
    },
  },
  {
    name: "generate_document",
    description:
      "Сгенерировать юридический документ по шаблону РК. Сначала search_adilet. Требует подтверждения юриста.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, description: "иск | претензия | ходатайство | договор | жалоба" },
        description: { type: SchemaType.STRING },
        clientName: { type: SchemaType.STRING },
      },
      required: ["type", "description"],
    },
  },
] as any as FunctionDeclaration[];
