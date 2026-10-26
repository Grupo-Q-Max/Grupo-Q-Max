import { Test, TestingModule } from '@nestjs/testing';
import { PrizeQueueService } from './prize-queue.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('PrizeQueueService', () => {
  let service: PrizeQueueService;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

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
});
