import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { UpdateFraudRuleDto } from './dto/update-fraud-rule.dto';

@Injectable()
export class FraudRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findByEvent(eventId: number) {
    const event = await this.prisma.events.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const rules = await this.prisma.fraud_rules.findMany({
      where: {
        event_id: eventId,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (rules.length === 0) {
      const defaultRules = [
        {
          type: 'CPF',
          max_allowed: 1,
          action: 'BLOCK' as const,
          enabled: true,
          description: '1 participação por CPF',
        },
        {
          type: 'PHONE',
          max_allowed: 1,
          action: 'BLOCK' as const,
          enabled: true,
          description: '1 participação por WhatsApp',
        },
        {
          type: 'DEVICE',
          max_allowed: 2,
          action: 'BLOCK' as const,
          enabled: true,
          description: 'Até 2 participações por dispositivo',
        },
        {
          type: 'IP',
          max_allowed: 9999,
          action: 'ALLOW_WITH_ALERT' as const,
          enabled: false,
          description: 'Ilimitado por IP do estande',
        },
        {
          type: 'EMAIL',
          max_allowed: 1,
          action: 'BLOCK' as const,
          enabled: true,
          description: '1 participação por e-mail',
        },
      ];

      for (const dr of defaultRules) {
        await this.prisma.fraud_rules.create({
          data: {
            event_id: eventId,
            type: dr.type as any,
            max_allowed: dr.max_allowed,
            action: dr.action as any,
            enabled: dr.enabled,
            description: dr.description,
          },
        });
      }

      return this.prisma.fraud_rules.findMany({
        where: { event_id: eventId },
        orderBy: { id: 'asc' },
      });
    }

    return rules;
  }

  async findOne(id: number) {
    const rule = await this.prisma.fraud_rules.findUnique({
      where: {
        id,
      },
      include: {
        events: true,
      },
    });

    if (!rule) {
      throw new NotFoundException('Regra antifraude não encontrada.');
    }

    return rule;
  }

  async update(
    id: number,
    dto: UpdateFraudRuleDto,
    context?: {
      adminUserId?: number | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const current = await this.findOne(id);

    const before = {
      enabled: current.enabled,
      maxAllowed: current.max_allowed,
      action: current.action,
      description: current.description,
    };

    const updated = await this.prisma.fraud_rules.update({
      where: {
        id,
      },

      data: {
        enabled: dto.enabled,
        max_allowed: dto.maxAllowed,
        action: dto.action,
        description: dto.description,
      },
    });

    const after = {
      enabled: updated.enabled,
      maxAllowed: updated.max_allowed,
      action: updated.action,
      description: updated.description,
    };

    await this.auditService.log({
      adminUserId: context?.adminUserId ?? null,
      eventId: updated.event_id,

      actorType: 'ADMIN',

      action: 'FRAUD_RULE_UPDATED',

      entityType: 'FRAUD_RULE',
      entityId: updated.id,

      description: `Regra antifraude ${updated.type} alterada.`,

      beforeData: before,
      afterData: after,

      metadata: {
        ruleType: updated.type,
      },

      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
    });

    return updated;
  }

  async getWhitelist(eventId: number) {
    const rule = await this.prisma.fraud_rules.findFirst({
      where: { event_id: eventId, type: 'IP' },
    });
    if (!rule || !rule.description) return [];

    const match = rule.description.match(/\[WHITELIST_JSON:(.*?)\]/s);
    if (!match || !match[1]) return [];

    try {
      return JSON.parse(match[1]);
    } catch {
      return [];
    }
  }

  async addWhitelistItem(
    eventId: number,
    dto: { identifier: string; note?: string },
  ) {
    const current = await this.getWhitelist(eventId);
    const cleanId = dto.identifier.trim();
    if (!cleanId) {
      throw new Error('Identificador de teste inválido.');
    }

    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      identifier: cleanId,
      note: dto.note?.trim() || 'Usuário de teste / Isenção Antifraude',
      created_at: new Date().toISOString(),
    };

    const updated = [newItem, ...current];
    await this.saveWhitelist(eventId, updated);
    return updated;
  }

  async removeWhitelistItem(eventId: number, itemId: string) {
    const current = await this.getWhitelist(eventId);
    const updated = current.filter(
      (item: any) => item.id !== itemId && item.identifier !== itemId,
    );
    await this.saveWhitelist(eventId, updated);
    return updated;
  }

  private async saveWhitelist(eventId: number, items: any[]) {
    let rule = await this.prisma.fraud_rules.findFirst({
      where: { event_id: eventId, type: 'IP' },
    });

    if (!rule) {
      rule = await this.prisma.fraud_rules.create({
        data: {
          event_id: eventId,
          type: 'IP',
          enabled: false,
          max_allowed: 9999,
          action: 'ALLOW_WITH_ALERT',
          description: 'Regra de teste [WHITELIST_JSON:[]]',
        },
      });
    }

    const baseDesc = (rule.description || '')
      .replace(/\[WHITELIST_JSON:.*?\]/s, '')
      .trim();
    const jsonStr = JSON.stringify(items);
    const newDesc = baseDesc
      ? `${baseDesc} [WHITELIST_JSON:${jsonStr}]`
      : `[WHITELIST_JSON:${jsonStr}]`;

    await this.prisma.fraud_rules.update({
      where: { id: rule.id },
      data: { description: newDesc },
    });
  }

  async isWhitelisted(
    eventId: number,
    info: { cpf?: string; phone?: string; email?: string; fullName?: string },
  ): Promise<boolean> {
    const whitelist = await this.getWhitelist(eventId);
    if (whitelist.length === 0) return false;

    const cleanCpf = (info.cpf || '').replace(/\D/g, '');
    const cleanPhone = (info.phone || '').replace(/\D/g, '');
    const cleanEmail = (info.email || '').toLowerCase().trim();
    const cleanName = (info.fullName || '').toLowerCase().trim();

    for (const item of whitelist) {
      const raw = (item.identifier || '').trim();
      if (!raw) continue;
      const cleanItemDigits = raw.replace(/\D/g, '');
      const cleanItemLower = raw.toLowerCase();

      if (
        cleanCpf &&
        cleanItemDigits.length >= 8 &&
        cleanCpf.includes(cleanItemDigits)
      ) {
        return true;
      }
      if (
        cleanPhone &&
        cleanItemDigits.length >= 8 &&
        cleanPhone.includes(cleanItemDigits)
      ) {
        return true;
      }
      if (
        cleanEmail &&
        cleanItemLower.includes('@') &&
        cleanEmail === cleanItemLower
      ) {
        return true;
      }
      if (
        cleanName &&
        cleanItemLower.length >= 3 &&
        cleanName.includes(cleanItemLower)
      ) {
        return true;
      }
      if (
        raw &&
        (raw === info.cpf ||
          raw === info.phone ||
          raw === info.email ||
          raw === info.fullName)
      ) {
        return true;
      }
    }

    return false;
  }
}
