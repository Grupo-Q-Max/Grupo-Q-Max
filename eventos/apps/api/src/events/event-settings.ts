import { BadRequestException } from '@nestjs/common';
import { EventSettingsDto } from './dto/event-settings.dto';

// Slug vira URL pública (/finora-experience/<slug>): não pode colidir com rotas fixas do web.
const RESERVED_SLUGS = new Set(['admin', 'api', 'tv', 'v', 'validar-whatsapp']);

export function assertRoutableSlug(slug?: string) {
  if (slug === undefined) return;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || RESERVED_SLUGS.has(slug)) {
    throw new BadRequestException(
      'Slug inválido: use letras minúsculas, números e hífens (ele vira o endereço do evento).',
    );
  }
}

// undefined = não mexe; null/'' = limpa.
const optional = <T>(value: T | null | undefined) =>
  value === undefined ? undefined : value || null;

export function eventSettingsData(dto: EventSettingsDto) {
  return {
    accent_color: optional(dto.accentColor),
    accent_ink_color: optional(dto.accentInkColor),
    experience: dto.experience,
    alert_phone: optional(dto.alertPhone),
    stock_alert_percent: dto.stockAlertPercent,
    crm_webhook_url: optional(dto.crmWebhookUrl),
  };
}

// Campos que não podem sair na listagem pública de eventos (GET /events).
export const PRIVATE_EVENT_FIELDS = {
  alert_phone: true,
  crm_webhook_url: true,
} as const;
