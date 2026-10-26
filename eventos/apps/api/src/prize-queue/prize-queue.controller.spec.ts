import { Test, TestingModule } from '@nestjs/testing';
import { PrizeQueueController } from './prize-queue.controller';
import { PrizeQueueService } from './prize-queue.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('PrizeQueueController', () => {
  let controller: PrizeQueueController;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrizeQueueController],
      providers: [
        PrizeQueueService,
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<PrizeQueueController>(PrizeQueueController);
  });

  it('deve instanciar o PrizeQueueController', () => {
    expect(controller).toBeDefined();
  });
});
