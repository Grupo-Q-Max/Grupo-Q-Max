import Link from "next/link";
import { cookies } from "next/headers";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { visiblePipelineWhere } from "@/lib/crm-access";
import { listMyTasks } from "@/lib/crm-my-tasks";
import { dueState } from "@/lib/crm-due";

export const dynamic = "force-dynamic";

const STATE_LABELS = { overdue: "Atrasada", today: "Hoje", upcoming: "", none: "" };

function formatDue(due: string, dateOnly: boolean) {
  const date = new Date(due);
  return dateOnly
    ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

/** /crm/me — "Minhas tarefas": open cards and pending activities of the signed-in member. */
export default async function MyTasksPage() {
  const memberId = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  const items = memberId ? await listMyTasks(memberId, await visiblePipelineWhere()) : [];

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Minhas tarefas</h1>
      </header>
      <div className="crm-list-view">
        {items.length === 0 ? (
          <p className="crm-my-tasks__empty">Nada pendente com você.</p>
        ) : (
          <table className="crm-table crm-my-tasks">
            <thead>
              <tr>
                <th>Prazo</th>
                <th>Tipo</th>
                <th>Título</th>
                <th>Onde</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const state = dueState(item.due ? new Date(item.due) : null, item.dateOnly);
                return (
                  <tr key={item.key} className={`is-${state}`}>
                    <td className="crm-my-tasks__due">
                      {item.due ? formatDue(item.due, item.dateOnly) : "Sem prazo"}
                      {STATE_LABELS[state] && <span className="crm-my-tasks__state">{STATE_LABELS[state]}</span>}
                    </td>
                    <td>
                      <span className="crm-badge">{item.label}</span>
                    </td>
                    <td>
                      <Link href={`/crm/deal/details/${item.number}`}>{item.title}</Link>
                    </td>
                    <td className="crm-my-tasks__context">{item.context}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
