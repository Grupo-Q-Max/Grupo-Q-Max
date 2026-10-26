import { Test, TestingModule } from '@nestjs/testing';
import { FraudRulesController } from './fraud-rules.controller';
import { FraudRulesService } from './fraud-rules.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('FraudRulesController', () => {
  let controller: FraudRulesController;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FraudRulesController],
      providers: [
        FraudRulesService,
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    controller = module.get<FraudRulesController>(FraudRulesController);
  });

  it('deve instanciar o FraudRulesController', () => {
    expect(controller).toBeDefined();
  });
});
