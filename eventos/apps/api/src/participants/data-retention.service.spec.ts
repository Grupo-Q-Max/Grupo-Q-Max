import { ANON_NAME, DataRetentionService, retentionCutoff } from './data-retention.service';
import { maskParticipationContact } from './participants.service';

describe('DataRetentionService', () => {
  it('corte é 12 meses antes', () => {
    expect(retentionCutoff(new Date('2027-11-17T12:00:00Z')).toISOString()).toBe(
      '2026-11-17T12:00:00.000Z',
    );
  });

  it('anonimiza só quem não tem opt-in e cujo evento acabou antes do corte', async () => {
    const update = jest.fn((args: unknown) => args);
    const prisma = {
      participants: {
        findMany: jest.fn().mockResolvedValue([{ id: 7, participations: [{ id: 70 }] }]),
        update,
      },
      participations: { updateMany: jest.fn() },
      fraud_checks: { updateMany: jest.fn() },
      message_queue: { updateMany: jest.fn() },
      audit_logs: { updateMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new DataRetentionService(prisma as never);

    expect(await service.anonymizeExpired(new Date('2027-11-17T12:00:00Z'))).toBe(1);

    const where = prisma.participants.findMany.mock.calls[0][0].where;
    expect(where.marketing_consent).toBe(false);
    expect(where.participations.none.OR[0].events.ends_at.gte.toISOString()).toBe(
      '2026-11-17T12:00:00.000Z',
    );

    const data = update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.data).toMatchObject({
      full_name: ANON_NAME,
      cpf_encrypted: '',
      cpf_hash: 'anon:7',
      phone: '',
      email: null,
    });
    expect(prisma.participations.updateMany).toHaveBeenCalledWith({
      where: { participant_id: 7 },
      data: { ip_address: null, user_agent: null, device_id: null },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('maskParticipationContact', () => {
  it('mascara telefone, e-mail e IP', () => {
    const row = maskParticipationContact({
      ip_address: '10.0.0.1',
      participants: { phone: '11999998888', email: 'ana@clinica.com' },
    });
    expect(row.ip_address).toBe('***');
    expect(row.participants.phone).toBe('*******8888');
    expect(row.participants.email).not.toContain('ana@');
  });
});
