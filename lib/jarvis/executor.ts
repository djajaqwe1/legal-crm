import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { ruToCaseStatus, caseStatusToRu } from "@/lib/case-status";
import { CaseStatus, ContractStatus } from "@/lib/generated-client";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { buildDocSystemPrompt } from "@/lib/doc-templates";
import { getWorkspaceAnalytics } from "@/lib/analytics/workspace-analytics";
import { applyCaseWorkflow, autoApplyCaseWorkflow, type CaseWorkflowId } from "@/lib/case-workflows";
import { getLawyerDailyBrief, getOpenTasksForWorkspace } from "@/lib/lawyer-daily";
import { searchLegalGrounding } from "@/lib/legal-grounding/adilet-search";
import { generateTextFallback } from "@/lib/llm/router";
import { addDocument } from "@/lib/crm-repository";
import { FORBIDDEN_TOOLS, TOOL_LABELS } from "./types";
import type { JarvisAction, JarvisToolResult } from "./types";
import { buildFallbackDocument } from "./document-fallback";
import { JARVIS_CAPABILITIES_REPLY } from "./help";
import { guardOfflineTool } from "./offline-tools";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";

function resolveNavigatePath(page: string, id?: string, query?: string): JarvisAction | null {
  const q = query?.trim();
  const paths: Record<string, string> = {
    dashboard: "/admin/dashboard",
    cases: q ? `/admin/cases?q=${encodeURIComponent(q)}` : "/admin/cases",
    clients: q ? `/admin/clients?q=${encodeURIComponent(q)}` : "/admin/clients",
    contracts: q ? `/admin/contracts?q=${encodeURIComponent(q)}` : "/admin/contracts",
    jarvis: "/admin",
    "documents-builder": "/admin/documents-builder",
  };
  if (page === "case" && id) return { type: "navigate", path: `/admin/cases/${id}`, label: "Открыть дело" };
  if (page === "client" && id) return { type: "navigate", path: `/admin/clients/${id}`, label: "Открыть клиента" };
  const path = paths[page];
  return path ? { type: "navigate", path, label: page } : null;
}

async function findCaseByQuery(workspaceId: string, query: string) {
  const q = query.trim();
  if (!q) return null;
  return prisma.legalCase.findFirst({
    where: {
      workspaceId,
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { client: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function resolveCaseId(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ caseId: string; caseCode: string } | { error: string }> {
  if (typeof args.caseId === "string" && args.caseId.trim()) {
    const c = await prisma.legalCase.findFirst({
      where: { id: args.caseId.trim(), workspaceId },
      select: { id: true, code: true },
    });
    if (!c) return { error: "Дело не найдено" };
    return { caseId: c.id, caseCode: c.code };
  }
  const q = typeof args.caseQuery === "string" ? args.caseQuery : "";
  if (!q.trim()) return { error: "Укажите дело" };
  const found = await findCaseByQuery(workspaceId, q);
  if (!found) return { error: `Дело «${q}» не найдено` };
  return { caseId: found.id, caseCode: found.code };
}

export async function executeJarvisTool(
  workspaceId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<JarvisToolResult> {
  if (FORBIDDEN_TOOLS.has(toolName)) {
    return {
      success: false,
      message: `Операция «${toolName}» запрещена политикой безопасности. Удаление записей только вручную через интерфейс CRM.`,
    };
  }

  const offline = await guardOfflineTool(toolName, args);
  if (offline) return offline;

  const actions: JarvisAction[] = [];

  if (toolName === "search_adilet") {
    const { query, limit = 5 } = args as { query: string; limit?: number };
    const result = await searchLegalGrounding(query, typeof limit === "number" ? limit : 5);
    return {
      success: true,
      data: result,
      message: result.documents.length
        ? `Найдено ${result.documents.length} акт(ов) в базе Әділет`
        : "По запросу в Әділет ничего не найдено — уточните формулировку",
    };
  }

  if (toolName === "get_case_context") {
    const { caseId } = args as { caseId: string };
    const legalCase = await prisma.legalCase.findFirst({
      where: { id: caseId, workspaceId },
      include: {
        client: true,
        tasks: { orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!legalCase) return { success: false, message: "Дело не найдено" };

    const data = {
      id: legalCase.id,
      code: legalCase.code,
      title: legalCase.title,
      status: caseStatusToRu[legalCase.status as CaseStatus] ?? legalCase.status,
      kind: legalCase.kind,
      client: legalCase.client?.name ?? "—",
      description: legalCase.description,
      deadline: legalCase.deadline ? new Date(legalCase.deadline).toLocaleDateString("ru-RU") : null,
      tasks: legalCase.tasks.map(t => ({
        title: t.title,
        completed: t.completed,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : null,
      })),
      documents: legalCase.documents.map(d => ({
        name: d.name,
        category: d.category,
        textPreview: d.extractedText?.slice(0, 1500) ?? null,
        externalUrl: d.externalUrl,
      })),
    };

    return {
      success: true,
      data,
      message: `Контекст дела ${legalCase.code}: ${legalCase.tasks.length} задач, ${legalCase.documents.length} документов`,
    };
  }

  if (toolName === "get_analytics") {
    const data = await getWorkspaceAnalytics(workspaceId);
    return {
      success: true,
      data,
      message: `Дел: ${data.totals.cases}, консультаций: ${data.totals.consultations}, судебных: ${data.totals.courtCases}, документов: ${data.totals.documents}. Оплачено: ${data.totals.paymentsTotal.toLocaleString("ru-RU")} ₸`,
    };
  }

  if (toolName === "get_lawyer_daily") {
    const { lawyerName } = args as { lawyerName?: string };
    const data = await getLawyerDailyBrief(workspaceId, lawyerName);
    return { success: true, data, message: data.summary };
  }

  if (toolName === "get_open_tasks") {
    const { limit = 15 } = args as { limit?: number };
    const data = await getOpenTasksForWorkspace(workspaceId, typeof limit === "number" ? limit : 15);
    return {
      success: true,
      data,
      message: data.length ? `Открытых задач: ${data.length}` : "Открытых задач нет",
    };
  }

  if (toolName === "list_case_tasks") {
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const { caseId, caseCode } = resolved;
    const tasks = await prisma.task.findMany({
      where: { legalCaseId: caseId },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
    });
    const data = tasks.map(t => ({
      id: t.id,
      title: t.title,
      completed: t.completed,
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("ru-RU") : null,
    }));
    const open = data.filter(t => !t.completed);
    const list = open.length
      ? open.map(t => `• ${t.title}${t.dueDate ? ` (${t.dueDate})` : ""}`).join("\n")
      : "Все задачи выполнены.";
    return {
      success: true,
      data: { caseCode, tasks: data },
      message: `Задачи ${caseCode} (${open.length} открытых):\n${list}`,
      actions: [{ type: "navigate", path: `/admin/cases/${caseId}`, label: caseCode }],
    };
  }

  if (toolName === "complete_task") {
    const { taskQuery, taskId } = args as { taskQuery?: string; taskId?: string };
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const { caseId, caseCode } = resolved;

    let task = taskId
      ? await prisma.task.findFirst({ where: { id: taskId, legalCaseId: caseId } })
      : null;

    if (!task && taskQuery) {
      const q = taskQuery.toLowerCase();
      const candidates = await prisma.task.findMany({
        where: { legalCaseId: caseId, completed: false },
      });
      task =
        candidates.find(t => t.title.toLowerCase() === q) ??
        candidates.find(t => t.title.toLowerCase().includes(q)) ??
        candidates.find(t => q.includes(t.title.toLowerCase().slice(0, 12))) ??
        null;
    }

    if (!task) {
      return { success: false, message: `Задача «${taskQuery ?? taskId}» не найдена в ${caseCode}` };
    }

    await prisma.task.update({ where: { id: task.id }, data: { completed: true } });
    actions.push({ type: "navigate", path: `/admin/cases/${caseId}` });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: { id: task.id, title: task.title, caseCode },
      message: `Задача «${task.title}» отмечена выполненной (${caseCode})`,
      actions,
    };
  }

  if (toolName === "apply_case_checklist") {
    const { workflowId } = args as { caseId?: string; caseQuery?: string; workflowId: CaseWorkflowId };
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const { caseId } = resolved;
    const result = await applyCaseWorkflow(caseId, workflowId, { workspaceId });
    actions.push({ type: "navigate", path: `/admin/cases/${caseId}` });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: result,
      message:
        result.created > 0
          ? `Добавлено ${result.created} задач по чеклисту`
          : "Все задачи чеклиста уже были в деле",
      actions,
    };
  }

  if (toolName === "navigate_to") {
    const { page, id, query } = args as { page: string; id?: string; query?: string };
    const action = resolveNavigatePath(page, id, query);
    if (!action) return { success: false, message: `Неизвестный раздел: ${page}` };
    return {
      success: true,
      message: `Открываю: ${action.type === "navigate" ? action.path : page}`,
      data: { path: action.type === "navigate" ? action.path : "" },
      actions: [action],
    };
  }

  if (toolName === "jarvis_help") {
    return { success: true, data: null, message: JARVIS_CAPABILITIES_REPLY };
  }

  if (toolName === "get_stats") {
    const [cases, clients, contracts, overdue] = await Promise.all([
      prisma.legalCase.count({ where: { workspaceId } }),
      prisma.client.count({ where: { workspaceId } }),
      prisma.contract.count({ where: { workspaceId } }),
      prisma.legalCase.count({
        where: {
          workspaceId,
          deadline: { lt: new Date() },
          status: { not: CaseStatus.CLOSED },
        },
      }),
    ]);
    return {
      success: true,
      data: { cases, clients, contracts, overdue },
      message: `Дел: ${cases}, клиентов: ${clients}, договоров: ${contracts}, просрочено: ${overdue}`,
    };
  }

  if (toolName === "get_cases") {
    const { status, clientName, limit = 5 } = args as { status?: string; clientName?: string; limit?: number };
    const statusEnum = status ? ruToCaseStatus[status] : undefined;
    const cases = await prisma.legalCase.findMany({
      where: {
        workspaceId,
        ...(statusEnum ? { status: statusEnum } : {}),
        ...(clientName ? { client: { name: { contains: clientName, mode: "insensitive" } } } : {}),
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: typeof limit === "number" ? limit : 5,
    });
    return {
      success: true,
      data: cases.map(c => ({
        id: c.id,
        code: c.code,
        title: c.title,
        status: caseStatusToRu[c.status as CaseStatus] ?? c.status,
        client: c.client?.name ?? "—",
        deadline: c.deadline ? new Date(c.deadline).toLocaleDateString("ru-RU") : "Без срока",
      })),
      message: `Найдено ${cases.length} дел`,
    };
  }

  if (toolName === "get_overdue_cases") {
    const { limit = 10 } = args as { limit?: number };
    const cases = await prisma.legalCase.findMany({
      where: {
        workspaceId,
        deadline: { lt: new Date() },
        status: { not: CaseStatus.CLOSED },
      },
      include: { client: true },
      orderBy: { deadline: "asc" },
      take: typeof limit === "number" ? limit : 10,
    });
    return {
      success: true,
      data: cases.map(c => ({
        id: c.id,
        code: c.code,
        title: c.title,
        client: c.client?.name ?? "—",
        deadline: c.deadline ? new Date(c.deadline).toLocaleDateString("ru-RU") : "—",
      })),
      message: `Просроченных дел: ${cases.length}`,
    };
  }

  if (toolName === "find_case") {
    const { query } = args as { query: string };
    const found = await findCaseByQuery(workspaceId, query);
    if (!found) return { success: true, data: null, message: `Дело по запросу «${query}» не найдено` };
    const data = {
      id: found.id,
      code: found.code,
      title: found.title,
      status: caseStatusToRu[found.status as CaseStatus] ?? found.status,
      client: found.client?.name ?? "—",
    };
    return { success: true, data, message: `Найдено: ${found.code} — ${found.title}` };
  }

  if (toolName === "get_clients") {
    const { search, limit = 5 } = args as { search?: string; limit?: number };
    const clients = await prisma.client.findMany({
      where: {
        workspaceId,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: typeof limit === "number" ? limit : 5,
    });
    return {
      success: true,
      data: clients.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
      message: `Найдено ${clients.length} клиентов`,
    };
  }

  if (toolName === "get_contracts") {
    const { search, limit = 5 } = args as { search?: string; limit?: number };
    const contracts = await prisma.contract.findMany({
      where: {
        workspaceId,
        ...(search
          ? {
              OR: [
                { number: { contains: search, mode: "insensitive" } },
                { counterparty: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: typeof limit === "number" ? limit : 5,
    });
    return {
      success: true,
      data: contracts.map(c => ({
        id: c.id,
        number: c.number,
        counterparty: c.counterparty,
        type: c.type,
        status: c.status,
      })),
      message: `Найдено ${contracts.length} договоров`,
    };
  }

  if (toolName === "create_client") {
    const { name, phone = "", email } = args as { name: string; phone?: string; email?: string };
    const existing = await prisma.client.findFirst({
      where: { workspaceId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      actions.push({ type: "navigate", path: `/admin/clients/${existing.id}`, label: existing.name });
      return { success: true, data: existing, message: `Клиент «${name}» уже есть`, actions };
    }
    const client = await prisma.client.create({
      data: {
        workspaceId,
        name,
        phone,
        email: email ?? `client-${Date.now()}@crm.local`,
        manager: "Рустем Айкимбаев",
      },
    });
    actions.push({ type: "navigate", path: `/admin/clients/${client.id}`, label: client.name });
    actions.push({ type: "refresh" });
    return { success: true, data: { id: client.id, name: client.name }, message: `Клиент «${name}» создан`, actions };
  }

  if (toolName === "create_case") {
    const { title, clientName, status = "Новый", deadline, description } = args as {
      title: string; clientName: string; status?: string; deadline?: string; description?: string;
    };
    let client = await prisma.client.findFirst({
      where: { workspaceId, name: { equals: clientName, mode: "insensitive" } },
    });
    if (!client) {
      client = await prisma.client.findFirst({
        where: { workspaceId, name: { contains: clientName, mode: "insensitive" } },
      });
    }
    if (!client) {
      client = await prisma.client.create({
        data: {
          workspaceId,
          name: clientName,
          phone: "",
          email: `voice-${Date.now()}@crm.local`,
          manager: "Рустем Айкимбаев",
        },
      });
    }
    const count = await prisma.legalCase.count({ where: { workspaceId } });
    const code = `LC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    let deadlineDate: Date | null = null;
    if (deadline?.trim()) {
      const parsed = new Date(deadline);
      if (!isNaN(parsed.getTime())) deadlineDate = parsed;
    }
    const newCase = await prisma.legalCase.create({
      data: {
        workspaceId,
        clientId: client.id,
        code,
        title,
        status: ruToCaseStatus[status] ?? CaseStatus.NEW,
        description: description ?? null,
        deadline: deadlineDate,
      },
    });
    await autoApplyCaseWorkflow(newCase.id, newCase.kind, null, workspaceId);
    actions.push({ type: "navigate", path: `/admin/cases/${newCase.id}`, label: newCase.code });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: { id: newCase.id, code: newCase.code, title: newCase.title },
      message: `Дело «${title}» (${code}) создано для «${client.name}». Добавлен типовой чеклист задач.`,
      actions,
    };
  }

  if (toolName === "update_case") {
    const { field, value } = args as { caseId?: string; caseQuery?: string; field: string; value: string };
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const caseId = resolved.caseId;
    const existingCase = await prisma.legalCase.findFirst({
      where: { id: caseId, workspaceId },
    });
    if (!existingCase) return { success: false, message: "Дело не найдено" };
    const updateData: Record<string, unknown> = {};
    if (field === "status") {
      const newStatus = ruToCaseStatus[value];
      if (!newStatus) return { success: false, message: `Неизвестный статус: ${value}` };
      updateData.status = newStatus;
    } else if (field === "deadline") {
      if (!value?.trim()) updateData.deadline = null;
      else {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) return { success: false, message: "Неверная дата" };
        updateData.deadline = parsed;
      }
    } else {
      updateData[field] = value;
    }
    await prisma.legalCase.update({ where: { id: caseId }, data: updateData });
    actions.push({ type: "navigate", path: `/admin/cases/${caseId}` });
    actions.push({ type: "refresh" });
    return { success: true, data: { id: caseId }, message: `Обновлено: ${field} → «${value}»`, actions };
  }

  if (toolName === "add_task") {
    const { title, dueDate } = args as { caseId?: string; caseQuery?: string; title: string; dueDate?: string };
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const caseId = resolved.caseId;
    const legalCase = await prisma.legalCase.findFirst({
      where: { id: caseId, workspaceId },
    });
    if (!legalCase) return { success: false, message: "Дело не найдено" };
    const task = await prisma.task.create({
      data: {
        legalCaseId: caseId,
        title,
        dueDate: dueDate?.trim() ? new Date(dueDate) : null,
      },
    });
    actions.push({ type: "navigate", path: `/admin/cases/${caseId}` });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: { id: task.id, title: task.title, caseCode: legalCase.code },
      message: `Задача «${title}» добавлена в ${legalCase.code}`,
      actions,
    };
  }

  if (toolName === "create_contract") {
    const { number, counterparty, type = "Оказание юридических услуг", clientName } = args as {
      number: string; counterparty: string; type?: string; clientName?: string;
    };
    const existing = await prisma.contract.findFirst({ where: { workspaceId, number } });
    if (existing) return { success: false, message: `Договор ${number} уже существует` };
    let clientId: string | null = null;
    if (clientName) {
      const client = await prisma.client.findFirst({
        where: { workspaceId, name: { contains: clientName, mode: "insensitive" } },
      });
      if (client) clientId = client.id;
    }
    const contract = await prisma.contract.create({
      data: { workspaceId, number, counterparty, type, clientId, status: ContractStatus.DRAFT },
    });
    actions.push({ type: "navigate", path: "/admin/contracts" });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: { id: contract.id, number: contract.number },
      message: `Договор ${number} создан`,
      actions,
    };
  }

  if (toolName === "intake_new_case") {
    const {
      clientName,
      title,
      description,
      deadline,
      documentType,
      workflowId = "pretension_flow",
      adiletQuery,
    } = args as {
      clientName: string;
      title: string;
      description: string;
      deadline?: string;
      documentType?: string;
      workflowId?: CaseWorkflowId;
      adiletQuery?: string;
    };

    const createResult = await executeJarvisTool(workspaceId, "create_case", {
      title,
      clientName,
      status: "Новый",
      deadline,
      description,
    });
    if (!createResult.success || !createResult.data) {
      return createResult;
    }

    const caseId = (createResult.data as { id: string }).id;
    const caseCode = (createResult.data as { code?: string }).code;
    const caseTitle = (createResult.data as { title?: string }).title;
    if (createResult.actions) {
      for (const a of createResult.actions) {
        if (a.type === "refresh") actions.push(a);
      }
    }

    let checklistMsg = "";
    if (workflowId) {
      const checklist = await applyCaseWorkflow(caseId, workflowId, { workspaceId });
      checklistMsg =
        checklist.created > 0
          ? ` Добавлено ${checklist.created} задач по чеклисту.`
          : " Чеклист уже был применён.";
    }

    let documentData: {
      type: string;
      text: string;
      isFallback?: boolean;
      legalSources?: Array<{ title: string; url: string }>;
    } | null = null;
    let documentError: string | undefined;
    let documentMsg = "";

    if (documentType) {
      const docResult = await executeJarvisTool(workspaceId, "generate_document", {
        type: documentType,
        description: `${title}\n\n${description}`,
        clientName,
      });

      let docText = docResult.success
        ? (docResult.data as { text?: string })?.text?.trim()
        : undefined;
      let isFallback = false;

      if (!docText) {
        docText = buildFallbackDocument(documentType, clientName, description, title);
        isFallback = true;
        documentError = docResult.success
          ? "AI не вернул текст — показан структурный черновик."
          : docResult.message;
      }

      const legalSources = docResult.success
        ? (docResult.data as { legalSources?: Array<{ title: string; url: string }> })?.legalSources
        : undefined;

      documentData = {
        type: documentType,
        text: docText,
        isFallback,
        legalSources,
      };

      try {
        await addDocument(caseId, `${documentType}-${caseCode ?? caseId}.txt`, "#jarvis-generated", {
          category: "correspondence",
          storageProvider: "crm",
          mimeType: "text/plain",
          sizeBytes: Buffer.byteLength(docText, "utf8"),
          extractedText: docText,
        });
        documentMsg = isFallback
          ? ` Структурный черновик «${documentType}» сохранён в дело (AI недоступен).`
          : ` Черновик «${documentType}» готов и сохранён в дело.`;
      } catch {
        documentMsg = ` Черновик «${documentType}» готов (сохранение в карточку не удалось — скачайте PDF ниже).`;
      }
    }

    const grounding = adiletQuery ? await searchLegalGrounding(adiletQuery, 4) : null;

    actions.push({
      type: "navigate",
      path: `/admin/cases/${caseId}`,
      label: caseCode ?? "Открыть дело",
    });

    return {
      success: true,
      data: {
        case: { ...createResult.data as object, id: caseId, code: caseCode, title: caseTitle },
        document: documentData,
        documentError,
        legalSources: grounding?.sources ?? documentData?.legalSources ?? [],
      },
      message: `Готово: дело ${caseCode ?? caseId} для «${clientName}».${checklistMsg}${documentMsg}${documentData ? " Черновик — ниже, кнопки PDF и Word." : ""}`,
      actions,
    };
  }

  if (toolName === "generate_for_case") {
    const { documentType, extraNotes } = args as {
      caseId?: string;
      caseQuery?: string;
      documentType: string;
      extraNotes?: string;
    };
    const resolved = await resolveCaseId(workspaceId, args);
    if ("error" in resolved) return { success: false, message: resolved.error };
    const { caseId, caseCode } = resolved;

    const legalCase = await prisma.legalCase.findFirst({
      where: { id: caseId, workspaceId },
      include: { client: true, tasks: { where: { completed: false }, take: 5 } },
    });
    if (!legalCase) return { success: false, message: "Дело не найдено" };

    const context = [
      legalCase.description,
      legalCase.title,
      extraNotes,
      legalCase.tasks.length
        ? `Открытые задачи: ${legalCase.tasks.map(t => t.title).join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const docResult = await executeJarvisTool(workspaceId, "generate_document", {
      type: documentType,
      description: context,
      clientName: legalCase.client?.name,
    });
    if (!docResult.success || !docResult.data) return docResult;

    const docText = (docResult.data as { text?: string }).text;
    if (docText) {
      try {
        await addDocument(caseId, `${documentType}-${caseCode}.txt`, "#jarvis-generated", {
          category: "correspondence",
          storageProvider: "crm",
          mimeType: "text/plain",
          sizeBytes: Buffer.byteLength(docText, "utf8"),
          extractedText: docText,
        });
      } catch {
        /* generated but not saved */
      }
    }

    actions.push({ type: "navigate", path: `/admin/cases/${caseId}`, label: caseCode });
    actions.push({ type: "refresh" });
    return {
      success: true,
      data: { case: { id: caseId, code: caseCode, title: legalCase.title }, document: docResult.data },
      message: `«${documentType}» для ${caseCode} готов и сохранён в дело`,
      actions,
    };
  }

  if (toolName === "generate_document") {
    const { type, description, clientName } = args as {
      type: string; description: string; clientName?: string;
    };
    const typeKey = type.toLowerCase().includes("иск")
      ? "lawsuit"
      : type.toLowerCase().includes("претенз")
        ? "claim"
        : type.toLowerCase().includes("ходат")
          ? "petition"
          : "lawsuit";
    const templateHint = buildDocSystemPrompt(typeKey);

    const grounding = await searchLegalGrounding(`${type} ${description}`, 4);
    const docPrompt = `${templateHint}

${grounding.contextBlock || "Предупреждение: нормы из Әділет не найдены — используй только общую структуру без вымышленных статей."}

Ситуация: ${description}

Клиент (истец / отправитель документа): ${clientName ?? "[указать]"}
Документ готовит юрист ТОО «Конгломерат Алтай» от имени клиента.
НЕ называй клиента «ТОО», если это не указано явно в ситуации.
Поля без данных помечай [ЗАПОЛНИТЬ …].

Выведи только текст документа. Цитируй закон только если он указан в блоке Әділет выше.`;

    let docText = "";
    try {
      docText = await generateTextFallback(
        docPrompt,
        "Ты юрист РК. Пиши только по делу, без галлюцинаций в номерах статей.",
      );
    } catch {
      if (GEMINI_KEY) {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        for (const modelName of GEMINI_MODELS) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await Promise.race([
              model.generateContent(docPrompt),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 55000)),
            ]);
            docText = (result as Awaited<ReturnType<typeof model.generateContent>>).response.text();
            if (docText) break;
          } catch {
            continue;
          }
        }
      }
    }

    if (!docText) {
      return { success: false, message: "Не удалось сгенерировать документ. Попробуйте через минуту." };
    }
    return {
      success: true,
      data: { type, text: docText, clientName, legalSources: grounding.sources },
      message: `${type} готов (источники: ${grounding.sources.length || "уточните нормы вручную"})`,
    };
  }

  return { success: false, message: `Неизвестный инструмент: ${toolName}` };
}

export function buildConfirmText(toolName: string, args: Record<string, unknown>): string {
  const label = TOOL_LABELS[toolName] ?? toolName;

  if (toolName === "create_case") {
    return `🔒 Запрос на действие: ${label}\n\nСоздам дело «${args.title}» для «${args.clientName}»${args.status ? ` (${args.status})` : ""}${args.deadline ? `, дедлайн ${args.deadline}` : ""}.\n\nРазрешаете выполнить?`;
  }
  if (toolName === "create_client") {
    return `🔒 Запрос на действие: ${label}\n\nСоздам клиента «${args.name}»${args.phone ? `, тел. ${args.phone}` : ""}.\n\nРазрешаете?`;
  }
  if (toolName === "update_case") {
    return `🔒 Запрос на действие: ${label}\n\nИзменю поле «${args.field}» → «${args.value}» (дело id: ${args.caseId}).\n\nРазрешаете?`;
  }
  if (toolName === "add_task") {
    return `🔒 Запрос на действие: ${label}\n\nДобавлю задачу «${args.title}»${args.dueDate ? ` до ${args.dueDate}` : ""}.\n\nРазрешаете?`;
  }
  if (toolName === "create_contract") {
    return `🔒 Запрос на действие: ${label}\n\nСоздам договор №${args.number} с «${args.counterparty}».\n\nРазрешаете?`;
  }
  if (toolName === "apply_case_checklist") {
    return `🔒 Запрос на действие: ${label}\n\nПрименю чеклист «${args.workflowId}» к делу.\n\nРазрешаете?`;
  }
  if (toolName === "generate_document") {
    return `🔒 Запрос на действие: ${label}\n\nСгенерирую «${args.type}» по описанию: «${String(args.description).slice(0, 120)}…»\n\nРазрешаете?`;
  }
  if (toolName === "intake_new_case") {
    const deadlineRu = args.deadline
      ? new Date(String(args.deadline)).toLocaleDateString("ru-RU")
      : "не указан";
    return `🔒 Полный intake дела\n\n• Клиент: «${args.clientName}»\n• Дело: «${args.title}»\n• Дедлайн: ${deadlineRu}${args.documentType ? `\n• Документ: ${args.documentType}` : ""}\n\nСоздам дело, чеклист и черновик документа.\n\nРазрешаете?`;
  }
  if (toolName === "generate_for_case") {
    return `🔒 ${label}\n\nПодготовлю «${args.documentType}» и сохраню в дело (id: ${args.caseId ?? args.caseQuery}).\n\nРазрешаете?`;
  }
  if (toolName === "complete_task") {
    return `🔒 ${label}\n\nОтмечу задачу «${args.taskQuery ?? args.taskId}» выполненной в деле «${args.caseQuery ?? args.caseId}».\n\nРазрешаете?`;
  }
  return `🔒 Запрос на действие: ${label}\n\nПараметры: ${JSON.stringify(args, null, 0).slice(0, 200)}\n\nРазрешаете?`;
}
