export const EVENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  DRAFT: "Rascunho",
  CLOSED: "Finalizado",
  ARCHIVED: "Arquivado",
};

type Listable = { status: string };

// Ativos primeiro; arquivados ficam fora das telas de escolha.
export function listableEvents<T extends Listable>(events: T[]): T[] {
  return events
    .filter((e) => e.status !== "ARCHIVED")
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE"));
}
