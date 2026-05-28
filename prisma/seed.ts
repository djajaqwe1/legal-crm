import { CaseStatus } from "../lib/generated-client";
import { prisma } from "../lib/prisma";
import { DEFAULT_WORKSPACE_SLUG } from "../lib/workspace-scope";
import { hashPassword } from "../lib/password";

async function main() {
  const ws = await prisma.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: { name: "ТОО «Конгломерат Алтай»" },
    create: {
      slug: DEFAULT_WORKSPACE_SLUG,
      name: "ТОО «Конгломерат Алтай»",
      settings: {
        tagline: "Legal CRM + лендинг",
        consultCta: "Записаться на консультацию к юристу",
      },
    },
  });

  /** ЛК: пароль `Demo2026!` — только для локальной демонстрации. */
  const demoPortalHash = hashPassword("Demo2026!");

  const altai = await prisma.client.upsert({
    where: { id: "seed-altai-client" },
    update: {
      workspaceId: ws.id,
      email: "client-demo@example.kz",
      portalPasswordHash: demoPortalHash,
    },
    create: {
      id: "seed-altai-client",
      workspaceId: ws.id,
      name: "ТОО Алтай Инвест",
      manager: "А. Сагындык",
      phone: "+7 (701) 123-45-67",
      email: "client-demo@example.kz",
      portalPasswordHash: demoPortalHash,
    },
  });

  const bek = await prisma.client.upsert({
    where: { id: "seed-bek-client" },
    update: {
      workspaceId: ws.id,
      email: "client-claim@example.kz",
      portalPasswordHash: null,
    },
    create: {
      id: "seed-bek-client",
      workspaceId: ws.id,
      name: "ИП Бекенова",
      manager: "Д. Ахметов",
      phone: "+7 (707) 987-65-43",
      email: "client-claim@example.kz",
      portalPasswordHash: null,
    },
  });

  const altaiPlaza = await prisma.legalObject.upsert({
    where: { id: "seed-altai-object-plaza" },
    update: { workspaceId: ws.id, clientId: altai.id },
    create: {
      id: "seed-altai-object-plaza",
      workspaceId: ws.id,
      name: "ТЦ «Алтай Плаза»",
      clientId: altai.id,
    },
  });

  await prisma.legalObject.upsert({
    where: { id: "seed-bek-object-office" },
    update: { workspaceId: ws.id, clientId: bek.id },
    create: {
      id: "seed-bek-object-office",
      workspaceId: ws.id,
      name: "Офис / торговая точка №1",
      clientId: bek.id,
    },
  });

  await prisma.legalCase.upsert({
    where: {
      workspaceId_code: { workspaceId: ws.id, code: "LC-2026-014" },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      code: "LC-2026-014",
      title: "Взыскание задолженности",
      status: CaseStatus.IN_PROGRESS,
      deadline: new Date("2026-04-30"),
      clientId: altai.id,
      objectId: altaiPlaza.id,
    },
  });

  await prisma.legalCase.upsert({
    where: {
      workspaceId_code: { workspaceId: ws.id, code: "LC-2026-019" },
    },
    update: {},
    create: {
      workspaceId: ws.id,
      code: "LC-2026-019",
      title: "Договорной спор",
      status: CaseStatus.NEW,
      deadline: new Date("2026-05-03"),
      clientId: bek.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
