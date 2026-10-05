import type { CrmArea } from "@prisma/client";

/** Areas a request is addressed to and a member belongs to (labels shown in the UI). Client-safe. */
export const AREAS: Record<CrmArea, string> = { MARKETING: "Marketing", TECHNOLOGY: "Tecnologia", OTHER: "Outros" };

export const isArea = (v: unknown): v is CrmArea => typeof v === "string" && v in AREAS;
