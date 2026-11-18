import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantsService } from './participants.service';
import { PrismaService } from '../prisma/prisma.service';
import { FraudRulesService } from '../fraud-rules/fraud-rules.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MeetingsService } from '../meetings/meetings.service';
import { createPrismaMock } from '../../test/prisma-mock';

describe('ParticipantsService - Fluxo Direto Sem Disparos', () => {
  let service: ParticipantsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let whatsappServiceMock: { enqueueMessage: jest.Mock };
  let fraudRulesServiceMock: { findByEvent: jest.Mock; isWhitelisted: jest.Mock };
  let meetingsServiceMock: { getNextAvailableSlot: jest.Mock; bookMeeting: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    whatsappServiceMock = {
      enqueueMessage: jest.fn().mockResolvedValue(true),
    };
    fraudRulesServiceMock = {
      findByEvent: jest.fn().mockResolvedValue([]),
      isWhitelisted: jest.fn().mockResolvedValue(false),
    };
    meetingsServiceMock = {
      getNextAvailableSlot: jest.fn().mockResolvedValue(null),
      bookMeeting: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FraudRulesService, useValue: fraudRulesServiceMock },
        { provide: WhatsappService, useValue: whatsappServiceMock },
        { provide: MeetingsService, useValue: meetingsServiceMock },
      ],
    }).compile();

    service = module.get<ParticipantsService>(ParticipantsService);
  });

  it('deve registrar participante como APPROVED e validado SEM disparar WhatsApp', async () => {
    const eventMock = {
      id: 1,
      name: 'Finora Experience',
      slug: 'finora-exp',
      status: 'ACTIVE',
      participation_enabled: true,
      whatsapp_message: null,
      whatsapp_channel_link: null,
    };
    prismaMock.events.findUnique.mockResolvedValue(eventMock);
    prismaMock.participants.findFirst.mockResolvedValue(null);

    const txMock = {
      participants: {
        create: jest.fn().mockResolvedValue({
          id: 101,
          full_name: 'Dra. Mariana Costa',
          phone_normalized: '11988887777',
          email_normalized: 'mariana@clinica.com.br',
          cpf_last_digits: '3456',
          clinic_name: 'Clínica Mariana',
        }),
      },
      event_participants: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      participations: {
        create: jest.fn().mockResolvedValue({
          id: 202,
          event_id: 1,
          participant_id: 101,
          status: 'APPROVED',
          whatsapp_token: 'valid-token-123',
          whatsapp_validated: true,
        }),
      },
      vip_codes: {
        updateMany: jest.fn(),
      },
      fraud_checks: {
        create: jest.fn(),
      },
      audit_logs: {
        create: jest.fn(),
      },
    };

    prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(txMock));

    const result = await service.register({
      eventId: 1,
      fullName: 'Dra. Mariana Costa',
      cpf: '52998224725', // CPF válido algorítmico
      phone: '11988887777',
      email: 'mariana@clinica.com.br',
      deviceId: 'DEVICE-E2E-TEST',
      marketingConsent: true,
      privacyConsent: true,
    });

    expect(result.success).toBe(true);
    expect(result.participation.status).toBe('APPROVED');
    expect(result.participation.canDraw).toBe(true);
    expect(txMock.participations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          whatsapp_validated: true,
        }),
      }),
    );

    // Garante que o WhatsApp NÃO foi enfileirado na hora
    expect(whatsappServiceMock.enqueueMessage).not.toHaveBeenCalled();
  });

  it('findPendingDraws deve listar participantes aprovados que aguardam o giro da roleta', async () => {
    prismaMock.participations.findMany.mockResolvedValue([
      {
        id: 202,
        event_id: 1,
        participant_id: 101,
        status: 'APPROVED',
        created_at: new Date(),
        vip_codes: null,
        participants: {
          id: 101,
          full_name: 'Dra. Mariana Costa',
          phone_normalized: '11988887777',
          cpf_last_digits: '3456',
          clinic_name: 'Clínica Mariana',
          cro_number: '12345',
          cro_state: 'SP',
          city: 'São Paulo',
          state: 'SP',
        },
      },
    ]);

    const pending = await service.findPendingDraws(1);

    expect(pending).toHaveLength(1);
    expect(pending[0].participationId).toBe(202);
    expect(pending[0].fullName).toBe('Dra. Mariana Costa');
    expect(pending[0].clinicName).toBe('Clínica Mariana');
    expect(prismaMock.participations.findMany).toHaveBeenCalledWith({
      where: {
        event_id: 1,
        status: { in: ['PENDING', 'APPROVED', 'REVIEW'] },
        draws: null,
      },
      include: {
        participants: {
          include: {
            meetings: {
              where: {
                event_id: 1,
                status: { in: ['SCHEDULED', 'COMPLETED'] },
              },
              take: 1,
            },
          },
        },
        vip_codes: { select: { id: true } },
      },
      orderBy: { id: 'desc' },
      take: 30,
    });
  });
});

