import { SchemaType, type FunctionDeclaration } from "@google/generative-ai";

export const CASE_AGENT_TOOLS: FunctionDeclaration[] = [
  {
    name: "add_task",
    description: "Добавить одну задачу в текущее дело CRM.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Название задачи" },
        dueDate: { type: SchemaType.STRING, description: "Срок YYYY-MM-DD или пусто" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_tasks",
    description: "Добавить несколько задач в текущее дело за один вызов.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        tasks: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING },
              dueDate: { type: SchemaType.STRING },
            },
            required: ["title"],
          },
        },
      },
      required: ["tasks"],
    },
  },
  {
    name: "update_case",
    description: "Обновить статус или описание текущего дела.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Новый | В работе | Суд | Пауза | Завершено" },
        description: { type: SchemaType.STRING },
      },
    },
  },
  {
    name: "list_tasks",
    description: "Показать задачи по текущему делу.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

export const CASE_AGENT_TOOL_NAMES = new Set(CASE_AGENT_TOOLS.map(t => t.name!));
