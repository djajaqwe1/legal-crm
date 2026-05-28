"use server";

import { askGeminiByCase } from "@/lib/ai-service";
import { LEGAL_TEAM_CONFIG, AgentRole } from "./config";

export interface AgentResponse {
  role: AgentRole;
  agentName: string;
  content: string;
}

export interface TeamReport {
  userRequest: string;
  responses: AgentResponse[];
  finalVerdict: string;
}

/**
 * Workflow многоагентного взаимодействия
 */
export async function runTeamWorkflow(userRequest: string, context?: string): Promise<TeamReport> {
  const responses: AgentResponse[] = [];
  
  // 1. Аналитик (RESEARCHER) - Ищет законы
  const researcherPrompt = `СИТУАЦИЯ: ${userRequest}\n\nКОНТЕКСТ: ${context || 'Нет данных'}\n\nЗАДАЧА: Найди применимые статьи законов РК.`;
  const researcherText = await askGeminiByCase(researcherPrompt, LEGAL_TEAM_CONFIG.RESEARCHER.systemPrompt);
  responses.push({
    role: 'RESEARCHER',
    agentName: LEGAL_TEAM_CONFIG.RESEARCHER.name,
    content: researcherText
  });

  // 2. Офицер риска (COMPLIANCE) - Ищет дыры на основе законов
  const compliancePrompt = `СИТУАЦИЯ: ${userRequest}\n\nАНАЛИЗ ЗАКОНОВ: ${researcherText}\n\nЗАДАЧА: Найди риски и слабые места.`;
  const complianceText = await askGeminiByCase(compliancePrompt, LEGAL_TEAM_CONFIG.COMPLIANCE.systemPrompt);
  responses.push({
    role: 'COMPLIANCE',
    agentName: LEGAL_TEAM_CONFIG.COMPLIANCE.name,
    content: complianceText
  });

  // 3. Оформитель (DRAFTER) - Готовит набросок позиции/документа
  const drafterPrompt = `СИТУАЦИЯ: ${userRequest}\n\nЗАКОНЫ: ${researcherText}\n\nЗАДАЧА: Сформулируй краткую структуру искового заявления или договора.`;
  const drafterText = await askGeminiByCase(drafterPrompt, LEGAL_TEAM_CONFIG.DRAFTER.systemPrompt);
  responses.push({
    role: 'DRAFTER',
    agentName: LEGAL_TEAM_CONFIG.DRAFTER.name,
    content: drafterText
  });

  // 4. Секретарь (SECRETARY) - Планирует шаги
  const secretaryPrompt = `СИТУАЦИЯ: ${userRequest}\n\nПОЗИЦИЯ: ${drafterText}\n\nЗАДАЧА: Составь план действий и черновик письма клиенту.`;
  const secretaryText = await askGeminiByCase(secretaryPrompt, LEGAL_TEAM_CONFIG.SECRETARY.systemPrompt);
  responses.push({
    role: 'SECRETARY',
    agentName: LEGAL_TEAM_CONFIG.SECRETARY.name,
    content: secretaryText
  });

  // 5. Главный юрист (CEO) - Финальное заключение
  const allReports = responses.map(r => `[${r.agentName}]: ${r.content}`).join('\n\n');
  const ceoPrompt = `ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userRequest}\n\nОТЧЕТЫ КОМАНДЫ:\n${allReports}\n\nЗАДАЧА: Проверь всё и выдай итоговое решение для клиента.`;
  const finalVerdict = await askGeminiByCase(ceoPrompt, LEGAL_TEAM_CONFIG.CEO.systemPrompt);

  return {
    userRequest,
    responses,
    finalVerdict
  };
}
