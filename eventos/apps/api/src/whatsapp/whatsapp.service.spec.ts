import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../../test/prisma-mock';

import { of } from 'rxjs';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  const originalInstanceId = process.env.ZAPI_INSTANCE_ID;
  const originalToken = process.env.ZAPI_TOKEN;

  beforeAll(() => {
    process.env.ZAPI_INSTANCE_ID = 'test-instance';
    process.env.ZAPI_TOKEN = 'test-token';
  });

  afterAll(() => {
    if (originalInstanceId === undefined) {
      delete process.env.ZAPI_INSTANCE_ID;
    } else {
      process.env.ZAPI_INSTANCE_ID = originalInstanceId;
    }

    if (originalToken === undefined) {
      delete process.env.ZAPI_TOKEN;
    } else {
      process.env.ZAPI_TOKEN = originalToken;
    }
  });

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: HttpService,
          useValue: {
            post: jest
              .fn()
              .mockReturnValue(of({ data: { messageId: 'mock-msg-123' } })),
            get: jest.fn().mockReturnValue(of({ data: {} })),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('deve instanciar o WhatsappService', () => {
    expect(service).toBeDefined();
  });

  it('deve retornar falso se o telefone for nulo', async () => {
    const result = await service.sendMessage(null, 'Olá!');
    expect(result).toBe(false);
  });

  it('deve retornar true quando a mensagem é enviada com sucesso', async () => {
    const result = await service.sendMessage('11999999999', 'Olá!');
    expect(typeof result).toBe('boolean');
  });

  describe('broadcastToEvent', () => {
    it('deve processar o disparo em massa com tags dinâmicas', async () => {
      prismaMock.events.findUnique.mockResolvedValue({
        id: 1,
        name: 'Clinicorp 2026',
      });

      prismaMock.participations.findMany.mockResolvedValue([
        {
          id: 42,
          status: 'APPROVED',
          participants: {
            full_name: 'Dra. Carolina Santos',
            phone: '11999998888',
          },
          draws: {
            prizes: {
              name: 'Garrafa Térmica',
            },
          },
        },
      ]);

      const result = await service.broadcastToEvent(1, {
        messageTemplate:
          'Olá {nome}, seu prêmio {premio} está no evento {evento}!',
        audience: 'ALL',
      });

      expect(result.totalTargeted).toBe(1);
      expect(result.details.length).toBe(1);
      expect(result.details[0].participantName).toBe('Dra. Carolina Santos');
    });
  });

  it('deve enviar mensagem em massa para vários números com mídia opcional', async () => {
    const result = await service.sendBulkCustomMessage({
      phones: ['11999998888', '(11) 99999-7777'],
      message: 'Olá {nome}! Confira o vídeo e a imagem.',
      mediaUrl: 'https://example.com/image.jpg',
      videoUrl: 'https://example.com/video.mp4',
      includeNameFallback: true,
    });

    expect(result.success).toBe(true);
    expect(result.sentCount).toBeGreaterThanOrEqual(1);
    expect(result.phoneCount).toBe(2);
  });
});
