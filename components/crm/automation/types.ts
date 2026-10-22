import type {
  ActionType,
  ActivityAction,
  ActivityType,
  AutomationCondition,
  CopyAction,
  EmailAction,
  Branch,
  DealUpdateAction,
  DelayUnit,
  Execution,
  HttpMethod,
  NotifyAction,
  StartOn,
  StepActionType,
  StepType,
  SubtaskAction,
  TriggerType,
  WebhookHeader,
} from "@/lib/crm-automation-shared";

/** Action of a flow step (a child rule holding only the action fields). */
export type StepActionRule = Pick<
  AutomationRule,
  | "id"
  | "name"
  | "webhookUrl"
  | "webhookMethod"
  | "webhookBody"
  | "headers"
  | "activity"
  | "dealUpdate"
  | "notify"
  | "subtask"
  | "checklist"
  | "email"
  | "copy"
> & { actionType: StepActionType };

/** Saved step of a FLOW rule, as a flat row (the editor builds the tree). */
export type AutomationStepRow = {
  id: string;
  parentId: string | null;
  branch: Branch | null;
  order: number;
  type: StepType;
  waitAmount: number | null;
  waitUnit: DelayUnit | null;
  conditions: AutomationCondition[];
  actions: StepActionRule[];
};

export type AutomationRule = {
  id: string;
  name: string;
  actionType: ActionType;
  /** Only for FLOW rules */
  steps: AutomationStepRow[];
  execution: Execution;
  delayAmount: number;
  delayUnit: DelayUnit;
  startOn: StartOn;
  startField: string | null;
  startActivityType: ActivityType | null;
  webhookUrl: string | null;
  webhookMethod: HttpMethod;
  webhookBody: string | null;
  headers: WebhookHeader[];
  /** Only for CREATE_ACTIVITY rules */
  activity: ActivityAction | null;
  /** Only for UPDATE_DEAL rules */
  dealUpdate: DealUpdateAction | null;
  /** Only for NOTIFY rules; members come from CrmAutomationNotifyMember (memberIds = legacy JSON, see notifyMemberIds) */
  notify: (Omit<NotifyAction, "memberIds"> & { memberIds: unknown; members: { memberId: string }[] }) | null;
  /** Only for CREATE_SUBTASK rules */
  subtask: SubtaskAction | null;
  /** Only for ADD_CHECKLIST rules */
  checklist: { title: string }[];
  /** Only for SEND_EMAIL rules */
  email: EmailAction | null;
  /** Only for COPY_CARD rules */
  copy: CopyAction | null;
  conditions: AutomationCondition[];
  active: boolean;
  order: number;
  stageId: string;
};

export type AutomationTrigger = {
  id: string;
  name: string;
  type: TriggerType;
  webhookToken: string | null;
  watchedField: string | null;
  activityType: ActivityType | null;
  allowBackwards: boolean;
  conditions: AutomationCondition[];
  active: boolean;
  order: number;
  stageId: string;
};

export type AutomationStage = {
  id: string;
  name: string;
  automations: AutomationRule[];
  triggers: AutomationTrigger[];
};

export type CustomField = { id: string; name: string; type: string };

export type Member = { id: string; name: string };

/** Fixed palette for stage headers (stages have no color of their own yet). */
export const STAGE_COLORS = ["#8bc34a", "#f8bbd0", "#fff176", "#ffe0a3", "#4fc3f7", "#2e7d32", "#ef5350", "#b388ff", "#4db6ac", "#ffb74d"];

export const stageColor = (index: number) => STAGE_COLORS[index % STAGE_COLORS.length];

/** Dark text on light stage colors, white on dark ones. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const luminance = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? "#1a1a1c" : "#fff";
}
