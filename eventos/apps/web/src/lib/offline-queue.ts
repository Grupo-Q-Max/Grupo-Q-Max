"use client";

// Fila local para quando a internet do estande cai. Cada item é reenviado até a
// API responder (2xx ou 4xx); 5xx/rede mantém na fila. localStorage pode falhar
// (modo privado, cota): nesse caso a fila fica vazia e o envio segue online.
// LGPD: os itens têm CPF e contato. Saem da fila assim que a API responde e são
// descartados após 24h sem envio. Nunca registrar o conteúdo em log.
export type QueuedRequest = { id: string; url: string; body: unknown; createdAt: number };

export const REGISTRATION_QUEUE = "finora-offline-registrations";
export const CLAIM_QUEUE = "finora-offline-claims";
export const OFFLINE_QUEUE_EVENT = "finora-offline-queue";

export const QUEUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function readQueue(key: string): QueuedRequest[] {
  let items: QueuedRequest[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
  const fresh = items.filter((q) => Date.now() - q.createdAt < QUEUE_MAX_AGE_MS);
  if (fresh.length !== items.length) writeQueue(key, fresh);
  return fresh;
}

function writeQueue(key: string, items: QueuedRequest[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}

export function enqueue(key: string, item: Omit<QueuedRequest, "createdAt">) {
  writeQueue(key, [...readQueue(key).filter((q) => q.id !== item.id), { ...item, createdAt: Date.now() }]);
}

// Erro de rede (sem resposta) — distinto de erro da API.
export function isNetworkError(err: unknown) {
  return err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
}

let flushing = false;

// Envia a fila em ordem. Devolve quantos itens ainda faltam.
export async function flushQueue(key: string): Promise<number> {
  if (flushing) return readQueue(key).length;
  flushing = true;
  try {
    for (const item of readQueue(key)) {
      try {
        const res = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (res.status >= 500) break;
      } catch {
        break;
      }
      writeQueue(key, readQueue(key).filter((q) => q.id !== item.id));
    }
  } finally {
    flushing = false;
  }
  return readQueue(key).length;
}

// Cadastro do visitante: sem rede (ou API fora do ar) vai para a fila local.
export async function postRegistration(body: Record<string, unknown>): Promise<Response | "queued"> {
  const clientRequestId = crypto.randomUUID();
  const url = "/finora-experience/api/v1/participants/register";
  const payload = { ...body, clientRequestId };
  const queue = () => {
    enqueue(REGISTRATION_QUEUE, { id: clientRequestId, url, body: payload });
    return "queued" as const;
  };

  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    // 502/503/504: o web respondeu mas a API não — mesmo caso de sem internet.
    return res.status >= 502 ? queue() : res;
  } catch (err) {
    if (isNetworkError(err)) return queue();
    throw err;
  }
}
