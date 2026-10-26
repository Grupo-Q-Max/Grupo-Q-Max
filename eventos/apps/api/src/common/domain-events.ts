import { Subject } from 'rxjs';

// Eventos de domínio em memória (1 instância da API, ver live/live.ts).
// Quem reage (CRM, resumo pós-evento) assina aqui sem acoplar os serviços.
export type LeadEvent = { participationId: number; type: 'lead' | 'prize' };

export const leadEvents = new Subject<LeadEvent>();
export const eventClosedEvents = new Subject<number>();
