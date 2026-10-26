import { Subject } from 'rxjs';

// Avisos "algo mudou neste evento" para as telas ao vivo (telão, roleta,
// dashboard). Sem dados no aviso: cada tela refaz o fetch que já faz.
// ponytail: em memória, vale só com 1 instância da API (PM2 fork); com várias
// instâncias trocar por Redis pub/sub.
export const liveEvents = new Subject<number>();

export function notifyLive(eventId: number | null | undefined) {
  if (eventId) liveEvents.next(eventId);
}
