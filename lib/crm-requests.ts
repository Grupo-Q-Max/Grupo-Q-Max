import { prisma } from "@/lib/prisma";

const DEFAULT_COLUMNS = ["Backlog", "Em andamento", "Concluído", "Aguardando"];

/** Board columns in order; creates the default ones on first use. */
export async function requestColumns() {
  const columns = await prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
  if (columns.length) return columns;
  // ponytail: two first-ever requests at the same instant could seed twice; delete the extra columns if it happens
  await prisma.crmRequestColumn.createMany({ data: DEFAULT_COLUMNS.map((name, order) => ({ name, order })) });
  return prisma.crmRequestColumn.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });
}
