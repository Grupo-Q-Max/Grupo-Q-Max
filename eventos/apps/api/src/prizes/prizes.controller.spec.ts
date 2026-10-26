import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrizesController } from './prizes.controller';
import { PrizesService } from './prizes.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('PrizesController', () => {
  let controller: PrizesController;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrizesController],
      providers: [
        { provide: StockAlertsService, useValue: { check: jest.fn() } },
        PrizesService,
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<PrizesController>(PrizesController);
  });

  it('deve instanciar o PrizesController', () => {
    expect(controller).toBeDefined();
  });
});
