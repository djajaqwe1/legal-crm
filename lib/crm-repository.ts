import {
  CaseStatus,
  ContractStatus,
  Prisma,
  type Client,
  type LegalCase,
  type LegalObject,
} from "./generated-client";
import { prisma } from "@/lib/prisma";
import { cases as mockCases, clients as mockClients } from "@/lib/crm-data";
import { generateDraftContract, saveContractAsPdf } from "./contract-generator";
import { ruToCaseStatus } from "./case-status";
import {
  invalidateDatabaseReachability,
  isDatabaseReachable,
} from "./db-health";
import { resolveWorkspaceId } from "./workspace-scope";

const caseDetailInclude = {
  client: true,
  object: true,
  tasks: { orderBy: { createdAt: "desc" as const } },
  documents: { orderBy: { createdAt: "desc" as const } },
  contracts: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.LegalCaseInclude;

export type CaseDetailRecord = Prisma.LegalCaseGetPayload<{
  include: typeof caseDetailInclude;
}>;

const clientDetailInclude = {
  objects: { orderBy: { createdAt: "desc" as const } },
  cases: {
    orderBy: { createdAt: "desc" as const },
    include: { object: true },
  },
} satisfies Prisma.ClientInclude;

export type ClientDetailRecord = Prisma.ClientGetPayload<{
  include: typeof clientDetailInclude;
}>;

function isLikelyDbConnectionError(e: unknown): boolean {
  const s = String(e);
  return (
    s.includes("PrismaClientInitializationError") ||
    s.includes("Can't reach database") ||
    s.includes("P1001") ||
    s.includes("P1000") ||
    s.includes("ENOTFOUND") ||
    s.includes("ECONNREFUSED")
  );
}

function parseMockDeadline(value: string): Date | null {
  if (!value || value === "Без срока") return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function buildOfflineCaseDetail(id: string): CaseDetailRecord | null {
  const row = mockCases.find((c) => c.id === id);
  if (!row) return null;

  const manager =
    mockClients.find((c) => c.name === row.client)?.manager ?? "—";
  const clientId = `offline-${row.client}`;

  const client: Client = {
    id: clientId,
    workspaceId: "offline-workspace",
    name: row.client,
    manager,
    email: null,
    phone: "+7 (777) 000-00-00",
    portalPasswordHash: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  const base: LegalCase = {
    id: row.id,
    workspaceId: "offline-workspace",
    code: row.id,
    title: row.caseTitle,
    status: ruToCaseStatus[row.status] ?? CaseStatus.NEW,
    deadline: parseMockDeadline(row.deadline),
    clientId,
    objectId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    description:
      "Демо-данные: PostgreSQL недоступен. Укажите рабочий DATABASE_URL в .env для полного CRUD.",
  };

  return {
    ...base,
    client,
    object: null,
    tasks: [],
    documents: [],
    contracts: [],
  } as CaseDetailRecord;
}

function buildOfflineClientDetail(id: string): ClientDetailRecord | null {
  const row = mockClients.find((c) => c.name === id);
  if (!row) return null;

  const clientRow: Client = {
    id: row.name,
    workspaceId: "offline-workspace",
    name: row.name,
    manager: row.manager,
    email: null,
    phone: "+7 (777) 000-00-00",
    portalPasswordHash: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };

  const casesForClient = mockCases
    .filter((c) => c.client === row.name)
    .map((c) => ({
      id: c.id,
      workspaceId: "offline-workspace",
      code: c.id,
      title: c.caseTitle,
      status: ruToCaseStatus[c.status] ?? CaseStatus.NEW,
      deadline: parseMockDeadline(c.deadline),
      clientId: row.name,
      objectId: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      description: null,
      object: null as LegalObject | null,
    }));

  return {
    ...clientRow,
    objects: [],
    cases: casesForClient,
  } as ClientDetailRecord;
}

export type CaseView = {
  id: string;
  code: string;
  client: string;
  caseTitle: string;
  status: string;
  deadline: string;
  /** Название связанного объекта (имущество, актив и т.д.), если есть */
  objectLabel?: string;
};

export type CaseAssistantContext = {
  caseId: string;
  code: string;
  title: string;
  status: string;
  deadline: string;
  client: string;
  tasks: Array<{ title: string; completed: boolean; dueDate: string }>;
  documents: Array<{ name: string; path: string }>;
};

const statusMap: Record<CaseStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  COURT: "Суд",
  ON_HOLD: "Пауза",
  CLOSED: "Завершено",
};

const fallbackCases: CaseView[] = mockCases.map((item) => ({
  id: item.id,
  code: item.id,
  client: item.client,
  caseTitle: item.caseTitle,
  status: item.status,
  deadline: item.deadline,
  objectLabel: "",
}));

export async function getCaseDetails(
  id: string,
): Promise<CaseDetailRecord | null> {
  if (!(await isDatabaseReachable())) {
    return buildOfflineCaseDetail(id);
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return buildOfflineCaseDetail(id);
  }
  try {
    return await prisma.legalCase.findFirst({
      where: { id, workspaceId: wid },
      include: caseDetailInclude,
    });
  } catch (error) {
    invalidateDatabaseReachability();
    if (!isLikelyDbConnectionError(error)) {
      console.error("Failed to get case details:", error);
    }
    return buildOfflineCaseDetail(id);
  }
}

export async function getLegalObjectsForClient(clientId: string) {
  if (!(await isDatabaseReachable())) {
    return [];
  }
  const wid = await resolveWorkspaceId();
  if (!wid) return [];
  try {
    return await prisma.legalObject.findMany({
      where: { clientId, workspaceId: wid },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    invalidateDatabaseReachability();
    if (!isLikelyDbConnectionError(error)) {
      console.error("Failed to list legal objects:", error);
    }
    return [];
  }
}

export async function createLegalObject(clientId: string, name: string) {
  if (!(await isDatabaseReachable())) {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: wid },
  });
  if (!client) {
    throw new Error("CLIENT_NOT_IN_WORKSPACE");
  }
  return await prisma.legalObject.create({
    data: {
      workspaceId: wid,
      clientId,
      name: name.trim(),
    },
  });
}

export async function addTask(caseId: string, title: string, dueDate?: string) {
  const wid = await resolveWorkspaceId();
  if (!wid) throw new Error("WORKSPACE_UNAVAILABLE");
  const k = await prisma.legalCase.findFirst({
    where: { id: caseId, workspaceId: wid },
  });
  if (!k) throw new Error("CASE_NOT_FOUND");
  try {
    return await prisma.task.create({
      data: {
        legalCaseId: caseId,
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
  } catch (error) {
    console.error("Failed to add task:", error);
    throw error;
  }
}

export async function addDocument(caseId: string, name: string, path: string) {
  const wid = await resolveWorkspaceId();
  if (!wid) throw new Error("WORKSPACE_UNAVAILABLE");
  const k = await prisma.legalCase.findFirst({
    where: { id: caseId, workspaceId: wid },
  });
  if (!k) throw new Error("CASE_NOT_FOUND");
  try {
    return await prisma.caseDocument.create({
      data: {
        legalCaseId: caseId,
        name,
        path,
      },
    });
  } catch (error) {
    console.error("Failed to add document:", error);
    throw error;
  }
}

export async function getClients() {
  if (!(await isDatabaseReachable())) {
    return mockClients.map((client) => ({
      id: client.name,
      name: client.name,
      email: null,
      phone: "+7 (777) 000-00-00",
      manager: client.manager,
      portalPasswordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { cases: client.activeCases, objects: 0 },
    }));
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return mockClients.map((client) => ({
      id: client.name,
      name: client.name,
      email: null,
      phone: "+7 (777) 000-00-00",
      manager: client.manager,
      portalPasswordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { cases: client.activeCases, objects: 0 },
    }));
  }
  try {
    return await prisma.client.findMany({
      where: { workspaceId: wid },
      include: { _count: { select: { cases: true, objects: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    invalidateDatabaseReachability();
    return mockClients.map((client) => ({
      id: client.name,
      name: client.name,
      email: null,
      phone: "+7 (777) 000-00-00",
      manager: client.manager,
      portalPasswordHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { cases: client.activeCases, objects: 0 },
    }));
  }
}

export async function getClientById(
  id: string,
): Promise<ClientDetailRecord | null> {
  if (!(await isDatabaseReachable())) {
    return buildOfflineClientDetail(id);
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return buildOfflineClientDetail(id);
  }
  try {
    return await prisma.client.findFirst({
      where: { id, workspaceId: wid },
      include: clientDetailInclude,
    });
  } catch (error) {
    invalidateDatabaseReachability();
    if (!isLikelyDbConnectionError(error)) {
      console.error("Failed to get client:", error);
    }
    return buildOfflineClientDetail(id);
  }
}

export async function getCases(): Promise<CaseView[]> {
  if (!(await isDatabaseReachable())) {
    return fallbackCases;
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return fallbackCases;
  }
  try {
    const dbCases = await prisma.legalCase.findMany({
      where: { workspaceId: wid },
      include: { client: true, object: true },
      orderBy: { createdAt: "desc" },
    });
    return dbCases.map(mapCaseToView);
  } catch {
    invalidateDatabaseReachability();
    return fallbackCases;
  }
}

export async function getContracts() {
  if (!(await isDatabaseReachable())) {
    return [];
  }
  try {
    await updateExpiringContracts();

    const wid = await resolveWorkspaceId();
    if (!wid) {
      return [];
    }
    return await prisma.contract.findMany({
      where: { workspaceId: wid },
      include: {
        client: { select: { name: true } },
        legalCase: { select: { title: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    invalidateDatabaseReachability();
    if (!isLikelyDbConnectionError(error)) {
      console.error("Failed to get contracts:", error);
    }
    return [];
  }
}

async function updateExpiringContracts() {
  const wid = await resolveWorkspaceId();
  if (!wid) return;
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // SIGNED -> EXPIRING если до конца менее 30 дней
    await prisma.contract.updateMany({
      where: {
        workspaceId: wid,
        status: ContractStatus.SIGNED,
        endDate: {
          lte: thirtyDaysFromNow,
          gt: new Date(),
        },
      },
      data: {
        status: ContractStatus.EXPIRING,
      },
    });
  } catch (error) {
    invalidateDatabaseReachability();
    if (!isLikelyDbConnectionError(error)) {
      console.error("Failed to update expiring contracts:", error);
    }
  }
}

export async function createLead(data: { name: string, phone: string, email?: string, summary: string }) {
  if (!(await isDatabaseReachable())) {
    return { id: "mock-lead-id", code: "LEAD-MOCK" };
  }
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return { id: "mock-lead-id", code: "LEAD-MOCK" };
  }
  try {
    const email = data.email || `lead-${data.phone}@example.com`;
    let client = await prisma.client.findFirst({
      where: { workspaceId: wid, email },
    });
    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: {
          name: data.name,
          phone: data.phone,
        },
      });
    } else {
      client = await prisma.client.create({
        data: {
          workspaceId: wid,
          name: data.name,
          email,
          phone: data.phone,
          manager: "Рустем Айкимбаев",
        },
      });
    }

    const legalCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        clientId: client.id,
        code: `LEAD-${Math.floor(Math.random() * 1000)}`,
        title: `Заявка с лендинга: ${data.summary.substring(0, 50)}...`,
        status: CaseStatus.NEW,
        description: `Суть дела: ${data.summary}\n\nКонтактные данные: ${data.phone}`,
      },
    });

    const { text: contractText, number: contractNumber } = await generateDraftContract(data);

    const pdfPath = await saveContractAsPdf(legalCase.id, contractText);

    await prisma.caseDocument.create({
      data: {
        legalCaseId: legalCase.id,
        name: `Договор №${contractNumber} (авто).pdf`,
        path: pdfPath,
      },
    });

    await prisma.contract.create({
      data: {
        workspaceId: wid,
        number: `CNT-${contractNumber}`,
        counterparty: data.name,
        type: "Оказание юридических услуг",
        status: ContractStatus.DRAFT,
        clientId: client.id,
        legalCaseId: legalCase.id,
        startDate: new Date(),
      },
    });

    return legalCase;
  } catch (error) {
    invalidateDatabaseReachability();
    console.error("Failed to create lead:", error);
    return { id: "mock-lead-id", code: "LEAD-MOCK" };
  }
}

export async function getCaseAssistantContext(
  caseId: string,
  options?: { workspaceId: string; clientId?: string },
): Promise<CaseAssistantContext | null> {
  if (!(await isDatabaseReachable())) {
    const fallback = fallbackCases.find((entry) => entry.id === caseId);
    if (!fallback) return null;
    return {
      caseId: fallback.id,
      code: fallback.code,
      title: fallback.caseTitle,
      status: fallback.status,
      deadline: fallback.deadline,
      client: fallback.client,
      tasks: [],
      documents: [],
    };
  }
  const wid = options?.workspaceId ?? (await resolveWorkspaceId());
  if (!wid) {
    const fallback = fallbackCases.find((entry) => entry.id === caseId);
    if (!fallback) return null;
    return {
      caseId: fallback.id,
      code: fallback.code,
      title: fallback.caseTitle,
      status: fallback.status,
      deadline: fallback.deadline,
      client: fallback.client,
      tasks: [],
      documents: [],
    };
  }
  try {
    const item = await prisma.legalCase.findFirst({
      where: {
        id: caseId,
        workspaceId: wid,
        ...(options?.clientId ? { clientId: options.clientId } : {}),
      },
      include: { client: true, tasks: true, documents: true },
    });

    if (!item) return null;

    return {
      caseId: item.id,
      code: item.code,
      title: item.title,
      status: statusMap[item.status],
      deadline: item.deadline
        ? item.deadline.toLocaleDateString("ru-RU")
        : "Без срока",
      client: item.client.name,
      tasks: item.tasks.map((task) => ({
        title: task.title,
        completed: task.completed,
        dueDate: task.dueDate ? task.dueDate.toLocaleDateString("ru-RU") : "Без срока",
      })),
      documents: item.documents.map((document) => ({
        name: document.name,
        path: document.path,
      })),
    };
  } catch {
    invalidateDatabaseReachability();
    const fallback = fallbackCases.find((entry) => entry.id === caseId);
    if (!fallback) return null;
    return {
      caseId: fallback.id,
      code: fallback.code,
      title: fallback.caseTitle,
      status: fallback.status,
      deadline: fallback.deadline,
      client: fallback.client,
      tasks: [],
      documents: [],
    };
  }
}

export type DashboardStats = {
  totalCases: number;
  activeCases: number;
  closedCases: number;
  courtCases: number;
  overdueCases: Array<{ id: string; code: string; title: string; client: string; deadline: string }>;
  upcomingCases: Array<{ id: string; code: string; title: string; client: string; deadline: string }>;
  openTasksCount: number;
  totalClients: number;
  totalContracts: number;
  urgentCase: { id: string; code: string; title: string; client: string } | null;
  newLeadsToday: number;
  courtCasesList: Array<{ id: string; code: string; title: string; client: string }>;
  isOffline: boolean;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const offline: DashboardStats = {
    totalCases: mockCases.length,
    activeCases: mockCases.filter((c) => c.status !== "Завершено").length,
    closedCases: mockCases.filter((c) => c.status === "Завершено").length,
    courtCases: mockCases.filter((c) => c.status === "Суд").length,
    overdueCases: [],
    upcomingCases: [],
    openTasksCount: 0,
    totalClients: mockClients.length,
    totalContracts: 0,
    urgentCase: null,
    newLeadsToday: 0,
    courtCasesList: [],
    isOffline: true,
  };

  if (!(await isDatabaseReachable())) return offline;
  const wid = await resolveWorkspaceId();
  if (!wid) return offline;

  try {
    const now = new Date();
    const in14days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [cases, openTasksCount, totalClients, totalContracts, newLeadsToday] =
      await Promise.all([
        prisma.legalCase.findMany({
          where: { workspaceId: wid },
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            deadline: true,
            client: { select: { name: true } },
          },
          orderBy: { deadline: "asc" },
        }),
        prisma.task.count({
          where: { legalCase: { workspaceId: wid }, completed: false },
        }),
        prisma.client.count({ where: { workspaceId: wid } }),
        prisma.contract.count({ where: { workspaceId: wid } }),
        prisma.legalCase.count({
          where: {
            workspaceId: wid,
            code: { startsWith: "LEAD-" },
            createdAt: { gte: todayStart },
          },
        }),
      ]);

    const activeCases = cases.filter((c) => c.status !== CaseStatus.CLOSED);
    const closedCases = cases.filter((c) => c.status === CaseStatus.CLOSED);
    const courtCases = cases.filter((c) => c.status === CaseStatus.COURT);

    const overdueCases = activeCases
      .filter((c) => c.deadline && c.deadline < now)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        client: c.client.name,
        deadline: c.deadline!.toLocaleDateString("ru-RU"),
      }));

    const upcomingCases = activeCases
      .filter((c) => c.deadline && c.deadline >= now && c.deadline <= in14days)
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        client: c.client.name,
        deadline: c.deadline!.toLocaleDateString("ru-RU"),
      }));

    const courtCasesList = courtCases.slice(0, 3).map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      client: c.client.name,
    }));

    const urgentCase =
      overdueCases[0] ??
      upcomingCases[0] ??
      courtCasesList[0] ??
      null;

    return {
      totalCases: cases.length,
      activeCases: activeCases.length,
      closedCases: closedCases.length,
      courtCases: courtCases.length,
      overdueCases,
      upcomingCases,
      openTasksCount,
      totalClients,
      totalContracts,
      urgentCase,
      newLeadsToday,
      courtCasesList,
      isOffline: false,
    };
  } catch {
    invalidateDatabaseReachability();
    return offline;
  }
}

function mapCaseToView(
  item: LegalCase & { client: Client; object?: LegalObject | null },
): CaseView {
  return {
    id: item.id,
    code: item.code,
    client: item.client.name,
    caseTitle: item.title,
    status: statusMap[item.status],
    deadline: item.deadline
      ? item.deadline.toLocaleDateString("ru-RU")
      : "Без срока",
    objectLabel: item.object?.name ?? "",
  };
}
