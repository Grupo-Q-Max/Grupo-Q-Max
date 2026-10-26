import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { computeStockChange, PrizesService } from './prizes.service';
import { StockOperationDto } from './dto/update-prize-stock.dto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('PrizesService', () => {
  let service: PrizesService;

  beforeEach(async () => {
    const prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<PrizesService>(PrizesService);
  });

  it('deve instanciar o PrizesService', () => {
    expect(service).toBeDefined();
  });
});

describe('computeStockChange', () => {
  it('calcula ADD, REMOVE e SET', () => {
    expect(computeStockChange(5, StockOperationDto.ADD, 3)).toEqual({
      stockAfter: 8,
      movementType: 'MANUAL_ADD',
    });
    expect(computeStockChange(5, StockOperationDto.REMOVE, 5).stockAfter).toBe(0);
    expect(computeStockChange(5, StockOperationDto.SET, 2)).toEqual({
      stockAfter: 2,
      movementType: 'ADJUSTMENT',
    });
  });

  it('não deixa REMOVE negativar', () => {
    expect(() => computeStockChange(2, StockOperationDto.REMOVE, 3)).toThrow(
      BadRequestException,
    );
  });
});
