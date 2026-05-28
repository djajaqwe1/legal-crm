import { CaseStatus } from "./generated-client";

export const ruToCaseStatus: Record<string, CaseStatus> = {
  Новый: CaseStatus.NEW,
  "В работе": CaseStatus.IN_PROGRESS,
  Суд: CaseStatus.COURT,
  Пауза: CaseStatus.ON_HOLD,
  Завершено: CaseStatus.CLOSED,
};

export const caseStatusToRu: Record<CaseStatus, string> = {
  NEW: "Новый",
  IN_PROGRESS: "В работе",
  COURT: "Суд",
  ON_HOLD: "Пауза",
  CLOSED: "Завершено",
};

export const caseStatusOptions = Object.keys(ruToCaseStatus);
