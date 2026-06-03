import { CaseOutcome, CourtInstance } from "./generated-client";

export const OUTCOME_OPTIONS: { value: CaseOutcome; label: string }[] = [
  { value: "PENDING", label: "В процессе" },
  { value: "WON_FULL", label: "Иск удовлетворён полностью" },
  { value: "WON_PARTIAL", label: "Иск удовлетворён частично" },
  { value: "DISMISSED", label: "Отказ в иске" },
  { value: "REJECTED", label: "Отказано" },
  { value: "LEFT_WITHOUT_CONSIDERATION", label: "Оставлено без рассмотрения" },
  { value: "TERMINATED", label: "Производство прекращено" },
  { value: "SETTLED", label: "Мировое соглашение" },
  { value: "IN_APPEAL", label: "Апелляция" },
  { value: "IN_CASSATION", label: "Кассация" },
  { value: "IN_SUPREME", label: "Верховный суд" },
];

export const COURT_INSTANCE_OPTIONS: { value: CourtInstance; label: string }[] = [
  { value: "FIRST", label: "Первая инстанция" },
  { value: "APPEAL", label: "Апелляция" },
  { value: "CASSATION", label: "Кассация" },
  { value: "SUPREME", label: "Верховный суд" },
];

const OUTCOME_LABEL_MAP = Object.fromEntries(
  OUTCOME_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CaseOutcome, string>;

const INSTANCE_LABEL_MAP = Object.fromEntries(
  COURT_INSTANCE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CourtInstance, string>;

export function outcomeLabel(outcome: CaseOutcome | null | undefined): string {
  if (!outcome) return "Не указан";
  return OUTCOME_LABEL_MAP[outcome] ?? outcome;
}

export function courtInstanceLabel(instance: CourtInstance | null | undefined): string {
  if (!instance) return "Не указана";
  return INSTANCE_LABEL_MAP[instance] ?? instance;
}
