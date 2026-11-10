import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrizeQueueService } from './prize-queue.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('PrizeQueueService', () => {
  let service: PrizeQueueService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrizeQueueService,
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PrizeQueueService>(PrizeQueueService);
  });

  it('deve instanciar o PrizeQueueService', () => {
    expect(service).toBeDefined();
  });

  it('não usa prêmios de outros eventos ao gerar fila automática', async () => {
    prismaMock.events.findUnique.mockResolvedValue({ id: 7 });
    prismaMock.prizes.findMany.mockResolvedValue([]);

    await expect(service.generateAutoQueue(7)).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.prizes.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.prizes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ event_id: 7 }),
      }),
    );
  });

  it('recusa evento inexistente em vez de criar ou trocar de evento', async () => {
    prismaMock.events.findUnique.mockResolvedValue(null);

    await expect(service.generateAutoQueue(99)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.events.create).not.toHaveBeenCalled();
  });

  it('recusa prêmio de outro evento ou sem estoque', async () => {
    prismaMock.events.findUnique.mockResolvedValue({ id: 7 });
    prismaMock.prizes.findFirst.mockResolvedValue(null);

    await expect(
      service.add({ eventId: 7, prizeId: 3 } as never),
    ).rejects.toThrow(NotFoundException);

    prismaMock.prizes.findFirst.mockResolvedValue({
      id: 3,
      event_id: 7,
      active: true,
      available_stock: 0,
    });

    await expect(
      service.add({ eventId: 7, prizeId: 3 } as never),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.prizes.update).not.toHaveBeenCalled();
  });
});
