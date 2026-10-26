import { Test, TestingModule } from '@nestjs/testing';
import { FraudRulesService } from './fraud-rules.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('FraudRulesService', () => {
  let service: FraudRulesService;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudRulesService,
        AuditService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<FraudRulesService>(FraudRulesService);
  });

  it('deve instanciar o FraudRulesService', () => {
    expect(service).toBeDefined();
  });
});
