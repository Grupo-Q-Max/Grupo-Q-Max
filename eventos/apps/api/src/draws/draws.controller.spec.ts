import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { Test, TestingModule } from '@nestjs/testing';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('DrawsController', () => {
  let controller: DrawsController;
  let service: DrawsService;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrawsController],
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

    controller = module.get<DrawsController>(DrawsController);
    service = module.get<DrawsService>(DrawsService);
  });

  it('deve instanciar o DrawsController', () => {
    expect(controller).toBeDefined();
  });
});
