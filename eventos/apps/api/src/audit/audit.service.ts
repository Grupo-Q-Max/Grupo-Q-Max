import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  eventId?: number | null;
  adminUserId?: number | null;

  actorType: string;
  action: string;

  entityType?: string | null;
  entityId?: string | number | null;

  description?: string | null;

  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;

  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    return this.prisma.audit_logs.create({
      data: {
        event_id: input.eventId ?? null,
        admin_user_id: input.adminUserId ?? null,

        actor_type: input.actorType,
        action: input.action,

        entity_type: input.entityType ?? null,
        entity_id:
          input.entityId !== undefined && input.entityId !== null
            ? String(input.entityId)
            : null,

        description: input.description ?? null,

        before_data:
          input.beforeData !== undefined
            ? JSON.stringify(input.beforeData)
            : null,

        after_data:
          input.afterData !== undefined
            ? JSON.stringify(input.afterData)
            : null,

        metadata:
          input.metadata !== undefined ? JSON.stringify(input.metadata) : null,

        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      },
    });
  }

  async findAll(eventId?: number) {
    const logs = await this.prisma.audit_logs.findMany({
      where: eventId
        ? {
            event_id: eventId,
          }
        : undefined,

      orderBy: {
        created_at: 'desc',
      },

      take: 500,

      include: {
        admin_users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        events: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      ...log,
      id: log.id.toString(),

      before_data: this.parseJson(log.before_data),
      after_data: this.parseJson(log.after_data),
      metadata: this.parseJson(log.metadata),
    }));
  }

  private parseJson(value: string | null) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
