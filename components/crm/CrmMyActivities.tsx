"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_LABELS } from "./deal/types";
import { formatDateTime } from "./deal/ui";
import { useCan } from "./CrmAccess";
import type { ActivityBucket } from "@/lib/crm-activities-shared";

export type MyActivity = {
  id: string;
  type: keyof typeof ACTIVITY_LABELS;
  title: string;
  deadline: string | null;
  bucket: ActivityBucket;
  card: { number: number; title: string };
};

const SECTIONS: { bucket: ActivityBucket; title: string }[] = [
  { bucket: "overdue", title: "Atrasadas" },
  { bucket: "today", title: "Hoje" },
  { bucket: "upcoming", title: "Próximas" },
  { bucket: "noDeadline", title: "Sem prazo" },
];

export function CrmMyActivities({ activities }: { activities: MyActivity[] }) {
  const [list, setList] = useState(activities);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const can = useCan();

  async function complete(id: string) {
    setBusy(id);
    setError("");
    const res = await fetch("/api/crm/activity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, completed: true }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) setList((l) => l.filter((a) => a.id !== id));
    else setError("Não foi possível concluir a atividade.");
  }

  return (
    <>
      <header className="crm-header">
        <h1 className="crm-header__title">Minhas atividades</h1>
      </header>
      <div className="crm-content crm-access">
        {error && <p className="crm-activities__error" role="alert">{error}</p>}
        {!list.length && <p className="crm-contacts__empty">Nenhuma atividade em aberto. Tudo em dia!</p>}
        {SECTIONS.map(({ bucket, title }) => {
          const items = list.filter((a) => a.bucket === bucket);
          if (!items.length) return null;
          return (
            <section key={bucket} className={`crm-activities__section is-${bucket}`}>
              <h2>{title} ({items.length})</h2>
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Tipo</th>
                    <th>Prazo</th>
                    <th>Negócio</th>
                    {can("activity.edit") && <th aria-label="Concluir" />}
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{ACTIVITY_LABELS[a.type]}</td>
                      <td>{a.deadline ? formatDateTime(a.deadline) : "—"}</td>
                      <td>
                        <Link href={`/crm/deal/details/${a.card.number}`}>#{a.card.number} {a.card.title}</Link>
                      </td>
                      {can("activity.edit") && (
                        <td>
                          <button type="button" className="btn-secondary" disabled={busy === a.id} onClick={() => complete(a.id)}>
                            {busy === a.id ? "Concluindo..." : "Concluir"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </>
  );
}
