import type { ActionType } from "@/lib/crm-automation-shared";
import type { RuleDraft } from "./AutomationRuleModal";
import type { TriggerDraft } from "./TriggerModal";
import type { AutomationStage } from "./types";

/**
 * Ready-made automations ("Modelos"): each one opens the usual rule or trigger dialog pre-filled,
 * so the user reviews it (stage, members, URL) before saving. On task boards the last column is "done".
 */
export type AutomationTemplate =
  | { name: string; description: string; kind: "rule"; actionType: ActionType; preset: (stages: AutomationStage[]) => Partial<RuleDraft> }
  | { name: string; description: string; kind: "trigger"; preset: (stages: AutomationStage[]) => Partial<TriggerDraft> };

const first = (stages: AutomationStage[]) => stages[0]?.id;
const last = (stages: AutomationStage[]) => stages.at(-1)?.id;

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    name: "Concluída avisa a equipe",
    description: "Ao entrar na última coluna, notifica responsável, corresponsáveis e observadores.",
    kind: "rule",
    actionType: "NOTIFY",
    preset: (stages) => ({
      name: "Concluída avisa a equipe",
      stageId: last(stages),
      notify: { message: 'Tarefa #{{deal.number}} "{{deal.title}}" foi concluída', notifyResponsible: true, notifyAssignees: true, memberIds: [] },
    }),
  },
  {
    name: "Urgente notifica o responsável",
    description: "Tarefa criada com prioridade Urgente na primeira coluna avisa o responsável.",
    kind: "rule",
    actionType: "NOTIFY",
    preset: (stages) => ({
      name: "Urgente notifica o responsável",
      stageId: first(stages),
      conditions: [{ field: "priority", operator: "eq", value: "URGENT" }],
      notify: { message: 'Tarefa urgente: #{{deal.number}} "{{deal.title}}"', notifyResponsible: true, notifyAssignees: false, memberIds: [] },
    }),
  },
  {
    name: "Sem responsável recebe um padrão",
    description: "Tarefa sem responsável na primeira coluna ganha o responsável que você escolher.",
    kind: "rule",
    actionType: "UPDATE_DEAL",
    preset: (stages) => ({
      name: "Sem responsável recebe um padrão",
      stageId: first(stages),
      conditions: [{ field: "responsible", operator: "empty", value: null }],
    }),
  },
  {
    name: "Estimativa estourada",
    description: "Quando o tempo gasto passa da estimativa, move a tarefa para a coluna escolhida (ex.: revisão).",
    kind: "trigger",
    preset: (stages) => ({ name: "Estimativa estourada", type: "ESTIMATE_EXCEEDED", stageId: stages[1]?.id ?? first(stages), allowBackwards: true }),
  },
  {
    name: "Prazo chegou",
    description: "No dia do prazo, move a tarefa para a coluna escolhida (ex.: Atrasadas ou Em andamento).",
    kind: "trigger",
    preset: (stages) => ({ name: "Prazo chegou", type: "DUE_REACHED", stageId: stages[1]?.id ?? first(stages), allowBackwards: true }),
  },
  {
    name: "Concluída envia webhook",
    description: "Ao entrar na última coluna, envia os dados da tarefa para outro sistema (informe a URL).",
    kind: "rule",
    actionType: "WEBHOOK",
    preset: (stages) => ({ name: "Concluída envia webhook", stageId: last(stages), webhookMethod: "POST" }),
  },
];
