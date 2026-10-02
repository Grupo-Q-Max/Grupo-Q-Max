import type {
  ActivityType,
  AutomationCondition,
  DelayUnit,
  HttpMethod,
  TriggerType,
  WebhookHeader,
} from "@/lib/crm-automation-shared";

export type AutomationRule = {
  id: string;
  name: string;
  actionType: "WEBHOOK";
  delayAmount: number;
  delayUnit: DelayUnit;
  webhookUrl: string;
  webhookMethod: HttpMethod;
  webhookBody: string | null;
  headers: WebhookHeader[];
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

/** Fixed palette for stage headers (stages have no color of their own yet). */
export const STAGE_COLORS = ["#8bc34a", "#f8bbd0", "#fff176", "#ffe0a3", "#4fc3f7", "#2e7d32", "#ef5350", "#b388ff", "#4db6ac", "#ffb74d"];

export const stageColor = (index: number) => STAGE_COLORS[index % STAGE_COLORS.length];

/** Dark text on light stage colors, white on dark ones. */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const luminance = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? "#1a1a1c" : "#fff";
}
