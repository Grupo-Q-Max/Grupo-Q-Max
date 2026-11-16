import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DrawsService } from './draws.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('DrawsService', () => {
  let service: DrawsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: StockAlertsService, useValue: { check: jest.fn() } },
        DrawsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: WhatsappService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<DrawsService>(DrawsService);
  });

  it('deve instanciar o DrawsService com sucesso', () => {
    expect(service).toBeDefined();
  });

  describe('claimPrize', () => {
    it('deve marcar o prêmio como entregue com sucesso', async () => {
      // O giro já deixa a participação COMPLETED; a entrega é draws.claimed_at.
      prismaMock.participations.findUnique.mockResolvedValue({
        id: 42,
        event_id: 1,
        status: 'COMPLETED',
        draws: {
          id: 7,
          claimed_at: null,
          prizes: { name: 'Garrafa Térmica Finora' },
        },
        participants: { full_name: 'Dr. Rodrigo' },
      });
      prismaMock.draws.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.claimPrize(42);

      expect(result.success).toBe(true);
      expect(result.alreadyClaimed).toBe(false);
      expect(prismaMock.draws.updateMany).toHaveBeenCalledWith({
        where: { id: 7, claimed_at: null },
        data: { claimed_at: expect.any(Date) },
      });
      expect(result.prize).toBe('Garrafa Térmica Finora');
    });

    it('deve alertar se o prêmio já foi resgatado anteriormente', async () => {
      prismaMock.participations.findUnique.mockResolvedValue({
        id: 42,
        status: 'COMPLETED',
        draws: {
          id: 7,
          claimed_at: new Date('2026-08-26T12:00:00Z'),
          prizes: { name: 'Garrafa Térmica Finora' },
        },
        participants: { full_name: 'Dr. Rodrigo' },
      });

      const result = await service.claimPrize(42);

      expect(result.success).toBe(true);
      expect(result.alreadyClaimed).toBe(true);
      expect(result.message).toContain('já havia sido resgatado');
    });
  });

  describe('performGrandDraw', () => {
    it('deve realizar o grande sorteio entre participantes elegíveis', async () => {
      prismaMock.participations.findMany.mockResolvedValue([
        {
          id: 1,
          created_at: new Date(),
          participants: {
            id: 10,
            full_name: 'Dr. Lucas',
            cpf_last_digits: '1234',
            phone: '11999999999',
            clinic_name: 'Clínica Sorriso',
            city: 'São Paulo',
            state: 'SP',
          },
        },
      ]);

      const result = await service.performGrandDraw(1, 'iPhone 16 Pro');

      expect(result.success).toBe(true);
      expect(result.drawType).toBe('GRAND_EVENT_DRAW');
      expect(result.prize).toBe('iPhone 16 Pro');
      expect(result.winner.fullName).toBe('Dr. Lucas');
    });

    it('não deve sortear participantes que já ganharam o Grande Sorteio anteriormente (antiduplicidade)', async () => {
      // Simula que o participante 10 já ganhou anteriormente
      prismaMock.audit_logs.findMany.mockResolvedValue([
        {
          id: 1,
          event_id: 1,
          action: 'GRAND_DRAW_COMPLETED',
          entity_id: '10',
        },
      ]);

      // Participante 10 (já ganhou) e Participante 20 (elegível)
      prismaMock.participations.findMany.mockResolvedValue([
        {
          id: 1,
          created_at: new Date(),
          participants: {
            id: 10,
            full_name: 'Dr. Lucas Já Ganhou',
            phone: '11999999999',
            clinic_name: 'Clínica 1',
          },
        },
        {
          id: 2,
          created_at: new Date(),
          participants: {
            id: 20,
            full_name: 'Dra. Beatriz Nova',
            phone: '11888888888',
            clinic_name: 'Clínica 2',
          },
        },
      ]);

      const result = await service.performGrandDraw(1, 'Câmera Intraoral');

      expect(result.success).toBe(true);
      expect(result.winner.participantId).toBe(20);
      expect(result.winner.fullName).toBe('Dra. Beatriz Nova');
      expect(result.totalCompetitors).toBe(1);
    });

    it('deve deduplicar múltiplos cupons com o mesmo telefone', async () => {
      prismaMock.audit_logs.findMany.mockResolvedValue([]);
      prismaMock.participations.findMany.mockResolvedValue([
        {
          id: 1,
          created_at: new Date(),
          participants: {
            id: 10,
            full_name: 'Dr. Carlos 1',
            phone: '(11) 97777-6666',
            clinic_name: 'Clínica A',
          },
        },
        {
          id: 2,
          created_at: new Date(),
          participants: {
            id: 11,
            full_name: 'Dr. Carlos 2 (Duplicado)',
            phone: '11977776666',
            clinic_name: 'Clínica B',
          },
        },
      ]);

      const eligible = await service.getEligibleForGrandDraw(1);
      expect(eligible.totalEligible).toBe(1);
      expect(eligible.participants[0].participantId).toBe(10);
    });
  });

  describe('draw', () => {
    const prize = (id: number, isVip: boolean) => ({
      id,
      name: isVip ? 'Prêmio VIP' : 'Brinde',
      description: null,
      image_url: null,
      probability: 10,
      available_stock: 5,
      active: true,
      is_vip: isVip,
    });

    const buildTx = (opts: { vip: boolean; queue?: unknown[]; consumed?: number }) => ({
      participations: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          event_id: 1,
          participant_id: 3,
          status: 'APPROVED',
          draws: null,
          vip_codes: opts.vip ? { id: 1 } : null,
          events: { status: 'ACTIVE', participation_enabled: true, slug: 'invictus' },
          participants: { id: 3, full_name: 'Dra. Ana', phone_normalized: '11999999999' },
        }),
        update: jest.fn(),
      },
      meetings: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
      prize_queue: {
        findMany: jest.fn().mockResolvedValue(opts.queue ?? []),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: opts.consumed ?? 1 }),
        update: jest.fn(),
      },
      prizes: {
        findMany: jest.fn().mockResolvedValue([prize(opts.vip ? 2 : 1, opts.vip)]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ available_stock: 4 }),
      },
      draws: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 99, drawn_at: new Date() }),
      },
      prize_stock_movements: { create: jest.fn() },
      audit_logs: { create: jest.fn() },
      message_queue: { create: jest.fn() },
    });

    const run = (tx: ReturnType<typeof buildTx>) => {
      prismaMock.$transaction.mockImplementation((cb: (t: unknown) => unknown) => cb(tx));
      return service.draw(7);
    };

    it('participação com cartão VIP sorteia só o pool VIP', async () => {
      const tx = buildTx({ vip: true });
      const result = await run(tx);

      expect(tx.prizes.findMany.mock.calls[0][0].where.is_vip).toBe(true);
      expect(result.vip).toBe(true);
      expect(result.prize.id).toBe(2);
    });

    it('participação sem cartão nunca usa item VIP da fila', async () => {
      const tx = buildTx({
        vip: false,
        queue: [{ id: 50, position: 1, prize_id: 2, prizes: prize(2, true) }],
      });
      const result = await run(tx);

      expect(tx.prizes.findMany.mock.calls[0][0].where.is_vip).toBe(false);
      expect(result.prize.id).toBe(1);
      expect(tx.prize_queue.updateMany).not.toHaveBeenCalled();
    });

    it('item da fila já consumido por giro concorrente gera conflito', async () => {
      const tx = buildTx({
        vip: false,
        queue: [{ id: 50, position: 1, prize_id: 1, prizes: prize(1, false) }],
        consumed: 0,
      });

      await expect(run(tx)).rejects.toThrow(ConflictException);
    });
  });
});
